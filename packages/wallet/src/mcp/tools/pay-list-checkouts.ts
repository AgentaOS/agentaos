import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPayListCheckouts(server: McpServer) {
	server.registerTool(
		'agenta_pay_list_checkouts',
		{
			description:
				'List checkout sessions. Filter by status (open, completed, expired, cancelled).',
			inputSchema: {
				status: z
					.enum(['open', 'completed', 'expired', 'cancelled'])
					.optional()
					.describe('Filter by status'),
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
		async ({ status, limit, offset }) => {
			try {
				const client = createPayClient();
				const data = await client.checkouts.list({
					status,
					limit: limit ?? 10,
					offset: offset ?? 0,
				});

				if (!data.items.length) {
					return { content: [{ type: 'text' as const, text: 'No checkouts found.' }] };
				}

				const lines = [`Checkouts (${data.total} total)`, ''];
				for (const c of data.items) {
					const raw = c as unknown as Record<string, unknown>;
					const amt = raw.amount ?? c.amountOverride ?? '';
					const desc = raw.description ? ` — ${raw.description}` : '';
					lines.push(`• ${c.status.padEnd(10)} ${amt} ${c.currency}${desc}`);
					lines.push(`  ID: ${c.sessionId}`);
					lines.push(`  Checkout: ${c.checkoutUrl}`);
					lines.push('');
				}

				if (data.hasMore) {
					lines.push(
						`Showing ${data.items.length} of ${data.total}. Use offset=${(offset ?? 0) + (limit ?? 10)} for more.`,
					);
				}

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to list checkouts');
			}
		},
	);
}
