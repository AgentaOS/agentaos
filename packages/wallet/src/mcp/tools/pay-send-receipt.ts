import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPayClient, formatPayError } from './pay-utils.js';

export function registerPaySendReceipt(server: McpServer) {
	server.registerTool(
		'agenta_pay_send_receipt',
		{
			description:
				'Re-send the receipt email for a paid invoice to the buyer on file. Paid invoices only.',
			inputSchema: {
				invoiceId: z.string().describe('The invoice ID to send the receipt for'),
			},
		},
		async ({ invoiceId }) => {
			try {
				const client = createPayClient();
				const result = await client.invoices.sendReceipt(invoiceId);

				return { content: [{ type: 'text' as const, text: `Receipt sent to ${result.sentTo}` }] };
			} catch (error) {
				return formatPayError(error, 'Failed to send receipt');
			}
		},
	);
}
