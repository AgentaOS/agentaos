import { OAuthProvider } from '@cloudflare/workers-oauth-provider';

import { AgentaosApi } from './agentaos-api.js';
import { handleAuthorize, handleCallback } from './authorize.js';
import type { ConnectionProps, Env } from './env.js';
import { handleMcp } from './mcp.js';

const PUBLIC_URL = 'https://mcp.agentaos.ai';

/** Everything that is not the protected /mcp route: the OAuth approval leg and a landing line. */
const defaultHandler: ExportedHandler<Env> = {
	async fetch(request, env) {
		const url = new URL(request.url);
		const api = new AgentaosApi(env.AGENTAOS_API_URL);
		if (url.pathname === '/authorize') return handleAuthorize({ request, env, api });
		if (url.pathname === '/callback') return handleCallback({ request, env, api });
		if (url.pathname === '/') {
			return new Response(`AgentaOS MCP. Add ${PUBLIC_URL}/mcp as a connector.`, {
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

export default new OAuthProvider<Env>({
	apiRoute: '/mcp',
	apiHandler,
	defaultHandler,
	authorizeEndpoint: '/authorize',
	tokenEndpoint: '/token',
	clientRegistrationEndpoint: '/register',
	clientIdMetadataDocumentEnabled: true,
	scopesSupported: ['agentaos'],
	resourceMetadata: {
		resource: `${PUBLIC_URL}/mcp`,
		authorization_servers: [PUBLIC_URL],
		scopes_supported: ['agentaos'],
		resource_name: 'AgentaOS',
	},
});
