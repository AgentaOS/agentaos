import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Merchant tools only: one per operation in the catalogue, `agenta_<group>_<op>`.
 *  The agent sub-account surface (MPC signers, on-chain sends, contract calls,
 *  message signing, the signing audit log and x402) was removed as wallet-era
 *  legacy — this list is the assertion that it stays removed, so a stray
 *  re-registration fails here rather than shipping. */
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
	'agenta_businesses_list',
	'agenta_businesses_get',
	'agenta_businesses_create',
	'agenta_businesses_invite',
	'agenta_businesses_revoke_invite',
	'agenta_businesses_id_link',
];

describe('AgentaOS Terminal MCP Server', () => {
	let client: Client;
	let transport: StdioClientTransport;

	beforeAll(async () => {
		transport = new StdioClientTransport({
			command: 'node',
			args: ['dist/index.js'],
			cwd: new URL('../../', import.meta.url).pathname,
			env: {
				...process.env,
				// Dummy values — tools/list doesn't invoke the signer
				AGENTA_API_SECRET: 'dGVzdA==',
				AGENTA_API_KEY: 'gw_test_dummy',
				AGENTA_SERVER: 'http://localhost:8080',
			},
		});

		client = new Client({ name: 'test-client', version: '1.0.0' });
		await client.connect(transport);
	}, 15_000);

	afterAll(async () => {
		await client?.close();
	});

	it(`lists exactly ${EXPECTED_TOOLS.length} tools`, async () => {
		const { tools } = await client.listTools();
		expect(tools).toHaveLength(EXPECTED_TOOLS.length);
	});

	it('registers all expected tool names', async () => {
		const { tools } = await client.listTools();
		const names = tools.map((t) => t.name).sort();
		expect(names).toEqual([...EXPECTED_TOOLS].sort());
	});

	it('each tool has a description longer than 10 chars', async () => {
		const { tools } = await client.listTools();
		for (const tool of tools) {
			expect(tool.description).toBeTruthy();
			expect(tool.description!.length).toBeGreaterThan(10);
		}
	});

	// The removal is the point, so assert it directly: anything needing key
	// material must not come back, because this server no longer holds any.
	it('exposes no wallet, signing or x402 tools', async () => {
		const { tools } = await client.listTools();
		const names = tools.map((t) => t.name);

		for (const gone of [
			'agenta_wallet_overview',
			'agenta_list_signers',
			'agenta_send_eth',
			'agenta_send_token',
			'agenta_call_contract',
			'agenta_execute',
			'agenta_sign_message',
			'agenta_sign_typed_data',
			'agenta_get_audit_log',
			'agenta_x402_check',
			'agenta_x402_discover',
			'agenta_x402_fetch',
		]) {
			expect(names).not.toContain(gone);
		}
	});

	it('every tool is named agenta_<group>_<op>', async () => {
		const { tools } = await client.listTools();
		for (const tool of tools) {
			expect(tool.name).toMatch(/^agenta_[a-z]+_[a-z_]+$/);
		}
	});
});
