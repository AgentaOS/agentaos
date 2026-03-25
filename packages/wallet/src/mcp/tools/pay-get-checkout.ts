import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPayGetCheckout(server: McpServer) {
	server.registerTool(
		'agenta_pay_get_checkout',
		{
			description:
				'Get checkout session details — status, amount, currency, expiry. Use to check if a payment was completed.',
			inputSchema: {
				sessionId: z.string().describe('The checkout session ID'),
			},
		},
		async ({ sessionId }) => {
			try {
				const client = createPayClient();
				const checkout = await client.checkouts.retrieve(sessionId);

				// amountOverride is for link-based checkouts; standalone checkouts use the session amount
				const displayAmount =
					checkout.amountOverride ?? (checkout as unknown as Record<string, unknown>).amount;
				const lines = [
					`Checkout: ${checkout.sessionId}`,
					`Status:   ${checkout.status}`,
					displayAmount
						? `Amount:   ${displayAmount} ${checkout.currency}`
						: `Currency: ${checkout.currency}`,
					`Expires:  ${checkout.expiresAt}`,
				];

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to get checkout');
			}
		},
	);
}
