import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPayListCustomers(server: McpServer) {
	server.registerTool(
		'agenta_pay_list_customers',
		{
			description: 'List the customers who have paid you — email, name, country, and ID.',
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
				const data = await client.customers.list({
					limit: limit ?? 10,
					offset: offset ?? 0,
				});

				if (!data.items.length) {
					return { content: [{ type: 'text' as const, text: 'No customers found.' }] };
				}

				const lines = [`Customers (${data.total} total)`, ''];
				for (const c of data.items) {
					const name = c.name ?? '—';
					const country = c.country ?? '—';
					lines.push(`• ${c.email} — ${name} (${country})`);
					lines.push(`  ID: ${c.id}`);
					lines.push('');
				}

				if (data.hasMore) {
					lines.push(
						`Showing ${data.items.length} of ${data.total}. Use offset=${(offset ?? 0) + (limit ?? 10)} for more.`,
					);
				}

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to list customers');
			}
		},
	);
}
