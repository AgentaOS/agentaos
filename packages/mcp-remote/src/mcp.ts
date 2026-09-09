import { AgentaOS } from '@agentaos/pay';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerAgentaTools } from 'agentaos/mcp';

import type { ConnectionProps, Env } from './env.js';

/**
 * One stateless MCP server per request, with every merchant operation bound
 * to the key minted for this connection.
 */
export async function handleMcp(
	request: Request,
	env: Env,
	props: ConnectionProps,
): Promise<Response> {
	const server = new McpServer({ name: 'agentaos', version: '0.1.0' });
	registerAgentaTools(server, () => new AgentaOS(props.apiKey, { baseUrl: env.AGENTAOS_API_URL }));

	const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
	await server.connect(transport);
	return transport.handleRequest(request);
}
