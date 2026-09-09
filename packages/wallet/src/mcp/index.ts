import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerAgentaTools } from './tools/index.js';
import { createPayClient } from './tools/pay-utils.js';

/**
 * The AgentaOS MCP server, over stdio.
 *
 * Merchant tools only, rendered from the same operations catalogue as the
 * CLI. The agent sub-account surface (MPC signers, on-chain sends, contract
 * calls, message signing, the signing audit log and x402) was removed: it is
 * the wallet-era product, not the merchant-of-record one, and every one of
 * those tools needed key material this server no longer holds.
 */
export async function runMcp() {
	const server = new McpServer({
		name: 'agenta',
		version: '0.1.0',
	});

	registerAgentaTools(server, createPayClient);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}
