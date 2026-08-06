import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { isJsonMode, output, outputError } from '../output.js';
import { dim } from '../theme.js';
import { requirePayClient } from './pay.command.js';

// ---------------------------------------------------------------------------
// agenta subscriptions — manage recurring subscribers (list, cancel)
// ---------------------------------------------------------------------------

/** Format integer minor units for display. Platform currencies (EUR/USD) are 2-decimal. */
function formatAmount(minor: number, currency: string): string {
	try {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
	} catch {
		return `${(minor / 100).toFixed(2)} ${currency}`;
	}
}

export const subscriptionsCommand = new Command('subscriptions').description(
	'Subscription management (list, cancel)',
);

subscriptionsCommand
	.command('list')
	.description('List subscriptions')
	.option('--json', 'Output as JSON')
	.action(async () => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching subscriptions...', indent: 2 }).start();

		try {
			const subs = await client.subscriptions.list();
			spinner?.stop();

			if (json) {
				console.log(JSON.stringify(subs));
				return;
			}
			if (!subs.length) {
				console.log(dim('\n  No subscriptions found.\n'));
				return;
			}
			console.log(`\n  ${chalk.bold(`Subscriptions (${subs.length})`)}\n`);
			for (const s of subs) {
				const amt = `${formatAmount(s.unitAmountMinor, s.currency)}${s.billingInterval ? `/${s.billingInterval}` : ''}`;
				const who = s.customerEmail ?? s.customerName ?? '—';
				console.log(`  ${s.status.padEnd(10)} ${amt.padEnd(14)} ${who.padEnd(28)} ${dim(s.id)}`);
			}
			console.log('');
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			if (spinner) {
				spinner.fail(msg);
			} else {
				outputError(msg);
			}
			process.exitCode = 1;
		}
	});

subscriptionsCommand
	.command('cancel <id>')
	.description('Cancel a subscription (at period end by default)')
	.option('--now', 'Cancel immediately instead of at the end of the current period')
	.option('--json', 'Output as JSON')
	.action(async (id: string, opts: { now?: boolean }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Cancelling subscription...', indent: 2 }).start();

		try {
			const result = await client.subscriptions.cancel(id, { atPeriodEnd: !opts.now });
			spinner?.stop();

			output({
				status: result.status,
				cancelAtPeriodEnd: result.cancelAtPeriodEnd,
				effectiveCancelDate: result.effectiveCancelDate,
				currentPeriodEnd: result.currentPeriodEnd,
			});
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			if (spinner) {
				spinner.fail(msg);
			} else {
				outputError(msg);
			}
			process.exitCode = 1;
		}
	});
