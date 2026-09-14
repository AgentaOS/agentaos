import { describe, expect, it } from 'vitest';

import type { Env } from '../env.js';
import { handleMcp } from '../mcp.js';

const EXPECTED_TOOLS = [
	'agenta_status_get',
	'agenta_audit_request',
	'agenta_audit_show',
	'agenta_verify_declaration',
	'agenta_verify_submit',
	'agenta_verify_status',
	'agenta_verify_resubmit',
	'agenta_products_create',
	'agenta_products_list',
	'agenta_pay_checkout',
	'agenta_pay_get',
	'agenta_pay_list',
	'agenta_subscriptions_list',
	'agenta_subscriptions_cancel',
	'agenta_subscriptions_change_plan',
	'agenta_subscriptions_credit',
	'agenta_subscriptions_credits',
	'agenta_discounts_create',
	'agenta_discounts_list',
	'agenta_discounts_show',
	'agenta_discounts_archive',
	'agenta_customers_list',
	'agenta_invoices_list',
	'agenta_invoices_receipt',
	'agenta_invoices_send_receipt',
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
	it('lists every merchant operation as a tool for a connection', async () => {
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
