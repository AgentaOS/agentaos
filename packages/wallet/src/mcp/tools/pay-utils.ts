import { AgentaOS } from '@agentaos/pay';

/**
 * Create an AgentaOS Pay SDK client from environment.
 * Requires AGENTAOS_GATEWAY_KEY (sk_live_... or sk_test_...).
 */
export function createPayClient(): AgentaOS {
	const apiKey = process.env.AGENTAOS_GATEWAY_KEY;
	if (!apiKey) {
		throw new Error(
			'Not authenticated for payment tools.\n' +
				'Set AGENTAOS_GATEWAY_KEY in your MCP server config or environment.\n' +
				'Get your key at: https://app.agentaos.ai → Settings → API Keys',
		);
	}
	const baseUrl = process.env.AGENTA_SERVER;
	return new AgentaOS(apiKey, baseUrl ? { baseUrl } : undefined);
}

/** Format SDK errors for MCP tool responses. */
export function formatPayError(error: unknown, prefix: string) {
	const msg = error instanceof Error ? error.message : String(error);
	return {
		content: [{ type: 'text' as const, text: `${prefix}: ${msg}` }],
		isError: true,
	};
}
