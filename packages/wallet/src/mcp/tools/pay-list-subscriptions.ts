import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

/** Format integer minor units for display. Platform currencies (EUR/USD) are 2-decimal. */
function formatAmount(minor: number, currency: string): string {
	try {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
	} catch {
		return `${(minor / 100).toFixed(2)} ${currency}`;
	}
}

export function registerPayListSubscriptions(server: McpServer) {
	server.registerTool(
		'agenta_pay_list_subscriptions',
		{
			description: 'List subscriptions — status, amount, billing interval, and subscriber.',
			inputSchema: {
				limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.describe('Results per page (default 10)'),
				offset: z.number().int().min(0).optional().describe('Pagination offset'),
			},
		},
		async ({ limit, offset }) => {
			try {
				const client = createPayClient();
				const data = await client.subscriptions.list({
					limit: limit ?? 10,
					offset: offset ?? 0,
				});

				if (!data.items.length) {
					return { content: [{ type: 'text' as const, text: 'No subscriptions found.' }] };
				}

				const lines = [`Subscriptions (${data.total} total)`, ''];
				for (const s of data.items) {
					const amt = `${formatAmount(s.unitAmountMinor, s.currency)}${s.billingInterval ? `/${s.billingInterval}` : ''}`;
					const who = s.customerEmail ?? s.customerName ?? '—';
					lines.push(`• ${s.status.padEnd(10)} ${amt} — ${who}`);
					lines.push(`  ID: ${s.id}`);
					if (s.currentPeriodEnd) lines.push(`  Current period ends: ${s.currentPeriodEnd}`);
					lines.push('');
				}

				if (data.hasMore) {
					lines.push(
						`Showing ${data.items.length} of ${data.total}. Use offset=${(offset ?? 0) + (limit ?? 10)} for more.`,
					);
				}

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to list subscriptions');
			}
		},
	);
}
