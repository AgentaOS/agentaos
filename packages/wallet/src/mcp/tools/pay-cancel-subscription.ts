import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPayCancelSubscription(server: McpServer) {
	server.registerTool(
		'agenta_pay_cancel_subscription',
		{
			description:
				'Cancel a subscription. Defaults to cancel-at-period-end (the subscriber keeps the current paid period, no refund); pass atPeriodEnd=false to cancel immediately.',
			inputSchema: {
				subscriptionId: z.string().describe('The subscription ID to cancel'),
				atPeriodEnd: z
					.boolean()
					.optional()
					.describe('Cancel at period end (default true); false = cancel immediately'),
			},
		},
		async ({ subscriptionId, atPeriodEnd }) => {
			try {
				const client = createPayClient();
				const result = await client.subscriptions.cancel(subscriptionId, {
					atPeriodEnd: atPeriodEnd ?? true,
				});

				const lines = [
					`Status:               ${result.status}`,
					`Cancel at period end: ${result.cancelAtPeriodEnd}`,
					result.effectiveCancelDate ? `Effective:            ${result.effectiveCancelDate}` : null,
					result.currentPeriodEnd ? `Current period ends:  ${result.currentPeriodEnd}` : null,
				].filter(Boolean);

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to cancel subscription');
			}
		},
	);
}
