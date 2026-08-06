import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPayListCustomers(server: McpServer) {
	server.registerTool(
		'agenta_pay_list_customers',
		{
			description: 'List the customers who have paid you — email, name, country, and ID.',
		},
		async () => {
			try {
				const client = createPayClient();
				const customers = await client.customers.list();

				if (!customers.length) {
					return { content: [{ type: 'text' as const, text: 'No customers found.' }] };
				}

				const lines = [`Customers (${customers.length})`, ''];
				for (const c of customers) {
					const name = c.name ?? '—';
					const country = c.country ?? '—';
					lines.push(`• ${c.email} — ${name} (${country})`);
					lines.push(`  ID: ${c.id}`);
					lines.push('');
				}

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to list customers');
			}
		},
	);
}
