import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerPayCancelSubscription } from './tools/pay-cancel-subscription.js';
import { registerPayCreateCheckout } from './tools/pay-create-checkout.js';
import { registerPayGetCheckout } from './tools/pay-get-checkout.js';
import { registerPayListCheckouts } from './tools/pay-list-checkouts.js';
import { registerPayListCustomers } from './tools/pay-list-customers.js';
import { registerPayListSubscriptions } from './tools/pay-list-subscriptions.js';
import { registerPaySendReceipt } from './tools/pay-send-receipt.js';

/**
 * The AgentaOS MCP server, over stdio.
 *
 * Merchant tools only. The agent sub-account surface (MPC signers, on-chain
 * sends, contract calls, message signing, the signing audit log and x402) was
 * removed: it is the wallet-era product, not the merchant-of-record one, and
 * every one of those tools needed key material this server no longer holds.
 */
export async function runMcp() {
	const server = new McpServer({
		name: 'agenta',
		version: '0.1.0',
	});

	registerPayCreateCheckout(server);
	registerPayGetCheckout(server);
	registerPayListCheckouts(server);
	registerPayListSubscriptions(server);
	registerPayCancelSubscription(server);
	registerPayListCustomers(server);
	registerPaySendReceipt(server);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}
