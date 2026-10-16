import type { AgentaOS } from '@agentaos/pay';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { OPERATIONS } from '../../ops/index.js';
import { cliCommand, mcpToolName } from '../../ops/naming.js';
import { NO_CLIENT, type Operation } from '../../ops/types.js';
import { formatPayError } from './pay-utils.js';

export { formatPayError } from './pay-utils.js';
export { OPERATIONS, cliCommand, mcpToolName } from '../../ops/index.js';

/** Builds the Pay SDK client a tool call runs against. Called per tool invocation; `business`
 *  is the managed business the call acts for (Connect), when the caller named one. */
export type PayClientFactory = (opts?: { business?: string }) => AgentaOS;

/** Every tool can act for a business you manage (Connect, PRD §6.1 R9-3) — `--business` in the CLI. */
const businessInput = z
	.string()
	.min(1)
	.optional()
	.describe('Act for this business you manage (its id). Omit to act as yourself.');

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
		{
			title: op.title,
			description: `${op.description}. ${op.guidance}`,
			inputSchema: { ...op.input.shape, business: businessInput },
			annotations: toolAnnotations(op),
		},
		async (input) => {
			try {
				const { business, ...opInput } = input as Record<string, unknown> & { business?: string };
				const client = op.offline ? NO_CLIENT : getClient(business ? { business } : undefined);
				const result = await op.run(client, opInput);
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

/** MCP tool hints from the operation's effect. Every tool calls the AgentaOS API, so none is closed-world. */
function toolAnnotations(op: Operation): ToolAnnotations {
	return {
		title: op.title,
		readOnlyHint: op.effect === 'read',
		destructiveHint: op.effect === 'destructive',
		openWorldHint: true,
	};
}
