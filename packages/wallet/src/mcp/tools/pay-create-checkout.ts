import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPayCreateCheckout(server: McpServer) {
	server.registerTool(
		'agenta_pay_create_checkout',
		{
			description:
				'Create a payment checkout session. Returns a checkout URL (for human customers) and an x402 URL (for AI agent payments).',
			inputSchema: {
				amount: z.number().positive().describe('Amount in currency units (e.g. 10.00)'),
				currency: z
					.string()
					.optional()
					.describe("Currency code (e.g. 'EUR', 'USD'). Defaults to org setting."),
				description: z.string().optional().describe('Description shown on the checkout page.'),
				buyerEmail: z.string().email().optional().describe('Pre-populate buyer email for receipt.'),
				webhookUrl: z
					.string()
					.url()
					.optional()
					.describe('HTTPS webhook URL for payment notifications.'),
				successUrl: z.string().url().optional().describe('Redirect URL after successful payment.'),
				expiresIn: z
					.number()
					.int()
					.min(300)
					.max(86400)
					.optional()
					.describe('Session TTL in seconds (300-86400, default 1800).'),
			},
		},
		async ({ amount, currency, description, buyerEmail, webhookUrl, successUrl, expiresIn }) => {
			try {
				const client = createPayClient();
				const checkout = await client.checkouts.create({
					amount,
					currency,
					description,
					buyerEmail,
					webhookUrl,
					successUrl,
					expiresIn,
				});

				// x402Url exists at runtime but may not be in the published types yet
				const data = checkout as unknown as Record<string, unknown>;

				const lines = [
					'Checkout created',
					'',
					`  Session ID:   ${checkout.sessionId}`,
					`  Amount:       ${amount} ${checkout.currency}`,
					`  Status:       ${checkout.status}`,
					`  Checkout URL: ${checkout.checkoutUrl}`,
					data.x402Url ? `  x402 URL:     ${data.x402Url}` : null,
					`  Expires:      ${checkout.expiresAt}`,
				]
					.filter(Boolean)
					.join('\n');

				return { content: [{ type: 'text' as const, text: lines }] };
			} catch (error) {
				return formatPayError(error, 'Checkout creation failed');
			}
		},
	);
}
