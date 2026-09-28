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
	// A GET asks to open the server-initiated SSE stream. This server is stateless and every
	// tool is request/response, so there is nothing to push down it — and the transport would
	// answer with a ReadableStream nobody ever writes to. A Worker does not keep such a request
	// alive: it is torn down, the stream dies, and the client reconnects immediately. That loop
	// reached 21,000 requests an hour and spent the account's whole daily KV read allowance,
	// because the provider reads the token out of KV on the way in, before any of this runs.
	// The spec's answer for a server with nothing to push is 405, and a client that gets it
	// stops asking. See "Listening for Messages from the Server", point 3.
	if (request.method === 'GET') {
		return new Response(null, { status: 405, headers: { allow: 'POST' } });
	}

	const server = new McpServer({ name: 'agentaos', version: '0.1.0' });
	registerAgentaTools(server, () => new AgentaOS(props.apiKey, { baseUrl: env.AGENTAOS_API_URL }));

	// enableJsonResponse for the same reason: a stateless server has no use for a streamed
	// answer, and a plain JSON response completes inside the request instead of leaving a
	// stream open for the runtime to collect.
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}
