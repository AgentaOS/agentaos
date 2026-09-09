import type { AuthRequest, CompleteAuthorizationOptions } from '@cloudflare/workers-oauth-provider';
import { describe, expect, it } from 'vitest';

import { AgentaosApi } from '../agentaos-api.js';
import { handleAuthorize, handleCallback } from '../authorize.js';
import type { Env } from '../env.js';

const API = 'http://api.test';
const PUBLIC = 'http://mcp.test';
const RAW_KEY = 'sk_test_rawsecret';

const authRequest: AuthRequest = {
	responseType: 'code',
	clientId: 'client-1',
	redirectUri: 'https://chatgpt.com/cb',
	scope: ['agentaos'],
	state: 'client-state',
	codeChallenge: 'abc',
	codeChallengeMethod: 'S256',
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

interface Scenario {
	pollStatus: 'completed' | 'denied' | 'expired';
}

function fakeFetch(scenario: Scenario, calls: { url: string; init?: RequestInit }[]): typeof fetch {
	return (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		if (url.endsWith('/auth/device-code')) {
			return json({
				deviceCode: 'dev-1',
				userCode: 'A7KM-X9RD',
				verificationUrl: 'http://app.test/cli-auth?code=A7KM-X9RD',
				expiresIn: 600,
				interval: 5,
			});
		}
		if (url.endsWith('/auth/device-code/poll')) {
			return scenario.pollStatus === 'completed'
				? json({ status: 'completed', token: 'session-jwt', email: 'm@example.com' })
				: json({ status: scenario.pollStatus });
		}
		if (url.endsWith('/networks')) {
			return json([
				{ name: 'base', isTestnet: false },
				{ name: 'base-sepolia', isTestnet: true },
				{ name: 'arbitrum', isTestnet: false },
			]);
		}
		if (url.endsWith('/gateway/secret-keys')) {
			return json({ id: 'key-1', key_prefix: 'sk_test_raws', rawKey: RAW_KEY });
		}
		return new Response('unexpected', { status: 500 });
	}) as typeof fetch;
}

function fakeKv(): KVNamespace {
	const store = new Map<string, string>();
	return {
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
		get: async (key: string) => store.get(key) ?? null,
		delete: async (key: string) => {
			store.delete(key);
		},
	} as unknown as KVNamespace;
}

function fakeEnv(completed: CompleteAuthorizationOptions[]): Env {
	return {
		OAUTH_KV: fakeKv(),
		OAUTH_PROVIDER: {
			parseAuthRequest: async () => authRequest,
			lookupClient: async () => ({ clientId: 'client-1', redirectUris: [], clientName: 'ChatGPT' }),
			completeAuthorization: async (options: CompleteAuthorizationOptions) => {
				completed.push(options);
				return { redirectTo: 'https://chatgpt.com/cb?code=1' };
			},
		} as unknown as Env['OAUTH_PROVIDER'],
		AGENTAOS_API_URL: API,
		MCP_PUBLIC_URL: PUBLIC,
	};
}

describe('remote MCP authorization', () => {
	let env: Env;
	let completed: CompleteAuthorizationOptions[];
	let calls: { url: string; init?: RequestInit }[];

	function setup(scenario: Scenario = { pollStatus: 'completed' }) {
		calls = [];
		completed = [];
		env = fakeEnv(completed);
		return new AgentaosApi(API, fakeFetch(scenario, calls));
	}

	async function authorize(api: AgentaosApi): Promise<string> {
		const response = await handleAuthorize({
			request: new Request(`${PUBLIC}/authorize?client_id=client-1`),
			env,
			api,
		});
		expect(response.status).toBe(302);
		const location = new URL(response.headers.get('location') ?? '');
		return new URL(location.searchParams.get('return') ?? '').searchParams.get('state') ?? '';
	}

	function callback(api: AgentaosApi, state: string, mode: string) {
		return handleCallback({
			request: new Request(`${PUBLIC}/callback?state=${state}&mode=${mode}`),
			env,
			api,
		});
	}

	it('redirects to the approve page with return and client, keeping the user code', async () => {
		const api = setup();
		const response = await handleAuthorize({
			request: new Request(`${PUBLIC}/authorize?client_id=client-1`),
			env,
			api,
		});
		const location = new URL(response.headers.get('location') ?? '');
		expect(location.origin + location.pathname).toBe('http://app.test/cli-auth');
		expect(location.searchParams.get('code')).toBe('A7KM-X9RD');
		expect(location.searchParams.get('client')).toBe('ChatGPT');
		expect(location.searchParams.get('return')).toMatch(/^http:\/\/mcp\.test\/callback\?state=/);
	});

	it('stores the handoff so the callback can find the device code', async () => {
		const api = setup();
		const state = await authorize(api);
		const stored = await env.OAUTH_KV.get(`handoff:${state}`);
		expect(JSON.parse(stored ?? '{}')).toMatchObject({
			deviceCode: 'dev-1',
			clientName: 'ChatGPT',
			authRequest,
		});
	});

	it('mints a test key from testnet networks only and completes authorization', async () => {
		const api = setup();
		const state = await authorize(api);
		const response = await callback(api, state, 'test');
		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://chatgpt.com/cb?code=1');

		const keyCall = calls.find((c) => c.url.endsWith('/gateway/secret-keys'));
		expect(JSON.parse(String(keyCall?.init?.body))).toEqual({
			supportedNetworks: ['base-sepolia'],
		});
		expect(new Headers(keyCall?.init?.headers).get('authorization')).toBe('Bearer session-jwt');

		expect(completed).toHaveLength(1);
		expect(completed[0]).toMatchObject({
			request: authRequest,
			userId: 'm@example.com',
			scope: ['agentaos'],
			metadata: { clientName: 'ChatGPT', keyId: 'key-1', keyPrefix: 'sk_test_raws' },
			props: { apiKey: RAW_KEY, keyPrefix: 'sk_test_raws', mode: 'test' },
		});
	});

	it('picks mainnet networks for a live connection', async () => {
		const api = setup();
		const state = await authorize(api);
		await callback(api, state, 'live');
		const keyCall = calls.find((c) => c.url.endsWith('/gateway/secret-keys'));
		expect(JSON.parse(String(keyCall?.init?.body))).toEqual({
			supportedNetworks: ['base', 'arbitrum'],
		});
		expect(completed[0]?.props).toMatchObject({ mode: 'live' });
	});

	it('rejects an unknown state with 404', async () => {
		const api = setup();
		const response = await callback(api, 'nope', 'test');
		expect(response.status).toBe(404);
	});

	it('rejects an unknown mode with 400', async () => {
		const api = setup();
		const state = await authorize(api);
		const response = await callback(api, state, 'staging');
		expect(response.status).toBe(400);
	});

	it('answers a denied approval with 400 and never mints a key', async () => {
		const api = setup({ pollStatus: 'denied' });
		const state = await authorize(api);
		const response = await callback(api, state, 'test');
		expect(response.status).toBe(400);
		expect(calls.some((c) => c.url.endsWith('/gateway/secret-keys'))).toBe(false);
		expect(completed).toHaveLength(0);
	});

	it('uses the handoff once: a second callback with the same state is 404', async () => {
		const api = setup();
		const state = await authorize(api);
		await callback(api, state, 'test');
		const second = await callback(api, state, 'test');
		expect(second.status).toBe(404);
	});
});
