import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const EXPECTED_TOOLS = [
	// Discovery
	'agenta_wallet_overview',
	'agenta_list_networks',
	'agenta_list_signers',
	'agenta_resolve_address',
	// Common operations
	'agenta_send_eth',
	'agenta_send_token',
	'agenta_get_balances',
	// Advanced
	'agenta_call_contract',
	'agenta_read_contract',
	'agenta_execute',
	'agenta_simulate',
	// Signing
	'agenta_sign_message',
	'agenta_sign_typed_data',
	// Management
	'agenta_get_status',
	'agenta_get_audit_log',
	// x402
	'agenta_x402_check',
	'agenta_x402_discover',
	'agenta_x402_fetch',
	// Merchant payments
	'agenta_pay_create_checkout',
	'agenta_pay_get_checkout',
	'agenta_pay_list_checkouts',
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

	it('x402 tools have correct input schema', async () => {
		const { tools } = await client.listTools();

		const check = tools.find((t) => t.name === 'agenta_x402_check');
		expect(check).toBeDefined();
		const checkProps = check!.inputSchema.properties as Record<string, unknown>;
		expect(checkProps).toHaveProperty('url');

		const discover = tools.find((t) => t.name === 'agenta_x402_discover');
		expect(discover).toBeDefined();
		const discoverProps = discover!.inputSchema.properties as Record<string, unknown>;
		expect(discoverProps).toHaveProperty('domain');

		const fetchTool = tools.find((t) => t.name === 'agenta_x402_fetch');
		expect(fetchTool).toBeDefined();
		const fetchProps = fetchTool!.inputSchema.properties as Record<string, unknown>;
		expect(fetchProps).toHaveProperty('url');
		expect(fetchProps).toHaveProperty('maxAmount');
	});
});
