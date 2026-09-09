import { describe, expect, it } from 'vitest';

import type { Env } from '../env.js';
import { handleMcp } from '../mcp.js';

const EXPECTED_TOOLS = [
	'agenta_pay_create_checkout',
	'agenta_pay_get_checkout',
	'agenta_pay_list_checkouts',
	'agenta_pay_list_subscriptions',
	'agenta_pay_cancel_subscription',
	'agenta_pay_list_customers',
	'agenta_pay_send_receipt',
];

const env = {
	AGENTAOS_API_URL: 'http://api.test',
	MCP_PUBLIC_URL: 'http://mcp.test',
} as Env;

/** The transport answers JSON or SSE depending on negotiation; read either. */
async function readJsonRpcResult(response: Response): Promise<{ tools: { name: string }[] }> {
	const body = await response.text();
	const contentType = response.headers.get('content-type') ?? '';
	const payload = contentType.includes('text/event-stream')
		? (body
				.split('\n')
				.find((line) => line.startsWith('data:'))
				?.slice('data:'.length)
				.trim() ?? '')
		: body;
	return JSON.parse(payload).result;
}

describe('remote MCP endpoint', () => {
	it('lists the seven merchant tools for a connection', async () => {
		const request = new Request('http://mcp.test/mcp', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
			},
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
		});

		const response = await handleMcp(request, env, {
			apiKey: 'sk_test_dummy',
			keyPrefix: 'sk_test_dumm',
			mode: 'test',
		});

		expect(response.status).toBe(200);
		const { tools } = await readJsonRpcResult(response);
		expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
	});
});
