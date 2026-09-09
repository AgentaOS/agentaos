import type { AgentaOS } from '@agentaos/pay';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerPayCancelSubscription } from './pay-cancel-subscription.js';
import { registerPayCreateCheckout } from './pay-create-checkout.js';
import { registerPayGetCheckout } from './pay-get-checkout.js';
import { registerPayListCheckouts } from './pay-list-checkouts.js';
import { registerPayListCustomers } from './pay-list-customers.js';
import { registerPayListSubscriptions } from './pay-list-subscriptions.js';
import { registerPaySendReceipt } from './pay-send-receipt.js';

export { formatPayError } from './pay-utils.js';

/** Builds the Pay SDK client a tool call runs against. Called per tool invocation. */
export type PayClientFactory = () => AgentaOS;

/**
 * Register the seven merchant tools on any McpServer. The stdio CLI server
 * passes the env-based factory; the remote Worker passes one bound to the
 * key minted for that connection.
 */
export function registerPayTools(server: McpServer, getClient: PayClientFactory): void {
	registerPayCreateCheckout(server, getClient);
	registerPayGetCheckout(server, getClient);
	registerPayListCheckouts(server, getClient);
	registerPayListSubscriptions(server, getClient);
	registerPayCancelSubscription(server, getClient);
	registerPayListCustomers(server, getClient);
	registerPaySendReceipt(server, getClient);
}
