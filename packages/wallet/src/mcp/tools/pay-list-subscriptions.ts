import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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
		},
		async () => {
			try {
				const client = createPayClient();
				const subs = await client.subscriptions.list();

				if (!subs.length) {
					return { content: [{ type: 'text' as const, text: 'No subscriptions found.' }] };
				}

				const lines = [`Subscriptions (${subs.length})`, ''];
				for (const s of subs) {
					const amt = `${formatAmount(s.unitAmountMinor, s.currency)}${s.billingInterval ? `/${s.billingInterval}` : ''}`;
					const who = s.customerEmail ?? s.customerName ?? '—';
					lines.push(`• ${s.status.padEnd(10)} ${amt} — ${who}`);
					lines.push(`  ID: ${s.id}`);
					if (s.currentPeriodEnd) lines.push(`  Current period ends: ${s.currentPeriodEnd}`);
					lines.push('');
				}

				return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
			} catch (error) {
				return formatPayError(error, 'Failed to list subscriptions');
			}
		},
	);
}
