import { type AuthRequest, AuthorizationError } from '@cloudflare/workers-oauth-provider';

import type { AgentaosApi } from './agentaos-api.js';
import type { ConnectionMode, ConnectionProps, Env } from './env.js';

const HANDOFF_TTL_SECONDS = 600;
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 1000;

interface HandlerInput {
	request: Request;
	env: Env;
	api: AgentaosApi;
}

/** What /authorize stores under the state until /callback picks it up. */
interface Handoff {
	deviceCode: string;
	authRequest: AuthRequest;
	clientName: string;
}

function handoffKey(state: string): string {
	return `handoff:${state}`;
}

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

function text(body: string, status: number): Response {
	return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function authorizationErrorResponse(error: AuthorizationError): Response {
	if (!error.redirectUri) return text(error.description, 400);
	const redirect = new URL(error.redirectUri);
	redirect.searchParams.set('error', error.code);
	redirect.searchParams.set('error_description', error.description);
	if (error.state) redirect.searchParams.set('state', error.state);
	if (error.issuer) redirect.searchParams.set('iss', error.issuer);
	return Response.redirect(redirect.toString(), 302);
}

/**
 * The OAuth authorize endpoint. Starts a device-code login on the platform,
 * parks the OAuth request in KV under a random state, and sends the merchant
 * to the existing approve page with a return address back to /callback.
 */
export async function handleAuthorize({ request, env, api }: HandlerInput): Promise<Response> {
	let authRequest: AuthRequest;
	try {
		authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
	} catch (error) {
		if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
		throw error;
	}

	const client = await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
	if (!client) return text('Unknown OAuth client', 400);
	const clientName = client.clientName ?? 'this assistant';

	const device = await api.createDeviceCode();
	const state = randomState();
	const handoff: Handoff = { deviceCode: device.deviceCode, authRequest, clientName };
	await env.OAUTH_KV.put(handoffKey(state), JSON.stringify(handoff), {
		expirationTtl: HANDOFF_TTL_SECONDS,
	});

	const approve = new URL(device.verificationUrl);
	approve.searchParams.set('return', `${env.MCP_PUBLIC_URL}/callback?state=${state}`);
	approve.searchParams.set('client', clientName);
	return Response.redirect(approve.toString(), 302);
}

function parseMode(value: string | null): ConnectionMode | null {
	return value === 'test' || value === 'live' ? value : null;
}

async function takeHandoff(env: Env, state: string): Promise<Handoff | null> {
	const key = handoffKey(state);
	const raw = await env.OAUTH_KV.get(key);
	if (!raw) return null;
	await env.OAUTH_KV.delete(key);
	return JSON.parse(raw) as Handoff;
}

type Approval = { token: string; email?: string } | { failure: string };

async function waitForApproval(api: AgentaosApi, deviceCode: string): Promise<Approval> {
	for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
		const poll = await api.pollDeviceCode(deviceCode);
		if (poll.status === 'completed' && poll.token) return { token: poll.token, email: poll.email };
		if (poll.status === 'expired')
			return { failure: 'This approval expired. Start the connection again.' };
		if (poll.status === 'denied') return { failure: 'The connection was declined in AgentaOS.' };
		if (attempt < POLL_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
	}
	return { failure: 'AgentaOS has not confirmed the approval yet. Try connecting again.' };
}

/**
 * Where the approve page returns the merchant. Redeems the device code for a
 * one-shot session, mints the secret key that becomes the connection's only
 * credential, and hands the OAuth flow back to the client.
 */
export async function handleCallback({ request, env, api }: HandlerInput): Promise<Response> {
	const url = new URL(request.url);
	const state = url.searchParams.get('state');
	const mode = parseMode(url.searchParams.get('mode'));
	if (!state || !mode) return text('Missing state or mode.', 400);

	const handoff = await takeHandoff(env, state);
	if (!handoff) return text('This approval link expired. Start the connection again.', 404);

	const approval = await waitForApproval(api, handoff.deviceCode);
	if ('failure' in approval) return text(approval.failure, 400);

	const wantTestnet = mode === 'test';
	const networks = (await api.listNetworks())
		.filter((n) => n.isTestnet === wantTestnet)
		.map((n) => n.name);
	if (networks.length === 0) return text(`No ${mode} networks are available right now.`, 400);

	const key = await api.createSecretKey(approval.token, networks);
	const props: ConnectionProps = { apiKey: key.rawKey, keyPrefix: key.key_prefix, mode };
	const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
		request: handoff.authRequest,
		userId: approval.email ?? 'unknown',
		metadata: { clientName: handoff.clientName, keyId: key.id, keyPrefix: key.key_prefix },
		scope: ['agentaos'],
		props,
	});
	return Response.redirect(redirectTo, 302);
}
