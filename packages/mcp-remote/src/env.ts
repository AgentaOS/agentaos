import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

export interface Env {
	OAUTH_KV: KVNamespace;
	OAUTH_PROVIDER: OAuthHelpers;
	/** Platform API origin, e.g. https://api.agentaos.ai (paths are added per call). */
	AGENTAOS_API_URL: string;
	/** This Worker's public origin; the approve page returns the merchant here. */
	MCP_PUBLIC_URL: string;
}

export type ConnectionMode = 'test' | 'live';

/** Encrypted into every access token by the OAuth provider; the only credential a connection holds. */
export interface ConnectionProps {
	apiKey: string;
	keyPrefix: string;
	mode: ConnectionMode;
}
