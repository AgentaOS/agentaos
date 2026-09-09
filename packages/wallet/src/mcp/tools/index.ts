import type { AgentaOS } from '@agentaos/pay';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OPERATIONS } from '../../ops/index.js';
import { cliCommand, mcpToolName } from '../../ops/naming.js';
import type { Operation } from '../../ops/types.js';
import { formatPayError } from './pay-utils.js';

export { formatPayError } from './pay-utils.js';
export { OPERATIONS, cliCommand, mcpToolName } from '../../ops/index.js';

/** Builds the Pay SDK client a tool call runs against. Called per tool invocation. */
export type PayClientFactory = () => AgentaOS;

/**
 * Register every operation in the catalogue as an MCP tool on any McpServer:
 * `products.create` becomes `agenta_products_create`, with the operation's
 * zod input as the tool schema. The text content is the same merchant-facing
 * sentence the CLI prints; the JSON the CLI prints with `--json` is the
 * structured content. The stdio server passes the env-based client factory;
 * the remote Worker passes one bound to the key minted for that connection.
 */
export function registerAgentaTools(server: McpServer, getClient: PayClientFactory): void {
	for (const op of OPERATIONS) registerOperation(server, op, getClient);
}

/** The name the Worker imported before the catalogue existed. One release. */
export const registerPayTools = registerAgentaTools;

function registerOperation(server: McpServer, op: Operation, getClient: PayClientFactory): void {
	server.registerTool(
		mcpToolName(op),
		{ description: op.description, inputSchema: op.input.shape },
		async (input) => {
			try {
				const result = await op.run(getClient(), input);
				return {
					content: [{ type: 'text' as const, text: op.describe(result) }],
					structuredContent: result as Record<string, unknown>,
				};
			} catch (error) {
				return formatPayError(error, `${cliCommand(op)} failed`);
			}
		},
	);
}
