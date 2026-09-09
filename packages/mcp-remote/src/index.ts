import { OAuthProvider } from '@cloudflare/workers-oauth-provider';

import { AgentaosApi } from './agentaos-api.js';
import { handleAuthorize, handleCallback } from './authorize.js';
import type { ConnectionProps, Env } from './env.js';
import { handleMcp } from './mcp.js';

/** Everything that is not the protected /mcp route: the OAuth approval leg and a landing line. */
const defaultHandler: ExportedHandler<Env> = {
	async fetch(request, env) {
		const url = new URL(request.url);
		const api = new AgentaosApi(env.AGENTAOS_API_URL);
		if (url.pathname === '/authorize') return handleAuthorize({ request, env, api });
		if (url.pathname === '/callback') return handleCallback({ request, env, api });
		if (url.pathname === '/') {
			return new Response(`AgentaOS MCP. Add ${env.MCP_PUBLIC_URL}/mcp as a connector.`, {
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			});
		}
		return new Response('Not found', { status: 404 });
	},
};

/**
 * Reached only with a valid access token; the provider decrypts the grant's
 * props into ctx.props. Its handler type leaves props `unknown`, hence the cast.
 */
const apiHandler: ExportedHandler<Env> & Required<Pick<ExportedHandler<Env>, 'fetch'>> = {
	fetch(request, env, ctx) {
		return handleMcp(request, env, ctx.props as ConnectionProps);
	},
};

/**
 * Built from the request's env rather than at module load: the issuer and the
 * resource URL must match where the Worker is actually reached (local
 * `wrangler dev` runs on localhost:8788, production on mcp.agentaos.ai), and
 * the MCP client refuses tokens whose audience does not match.
 */
function buildProvider(publicUrl: string): OAuthProvider<Env> {
	return new OAuthProvider<Env>({
		apiRoute: '/mcp',
		apiHandler,
		defaultHandler,
		authorizeEndpoint: '/authorize',
		tokenEndpoint: '/token',
		clientRegistrationEndpoint: '/register',
		clientIdMetadataDocumentEnabled: true,
		scopesSupported: ['agentaos'],
		resourceMetadata: {
			resource: `${publicUrl}/mcp`,
			authorization_servers: [publicUrl],
			scopes_supported: ['agentaos'],
			resource_name: 'AgentaOS',
		},
	});
}

let cached: { publicUrl: string; provider: OAuthProvider<Env> } | undefined;

export default {
	fetch(request, env, ctx) {
		if (!cached || cached.publicUrl !== env.MCP_PUBLIC_URL) {
			cached = { publicUrl: env.MCP_PUBLIC_URL, provider: buildProvider(env.MCP_PUBLIC_URL) };
		}
		return cached.provider.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
