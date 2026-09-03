import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { isJsonMode, output, outputError } from '../output.js';
import { dim } from '../theme.js';
import { requirePayClient } from './pay.command.js';

// ---------------------------------------------------------------------------
// agenta subscriptions — manage recurring subscribers (list, cancel, change-plan)
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
	'Subscription management (list, cancel, change-plan)',
);

// ---------------------------------------------------------------------------
// agenta subscriptions change-plan <id> --to <linkId> [--dry-run]
//
// Two API calls behind one command: the quote, then the apply with the
// quote's prorationDate echoed back so what is charged is what was shown.
// --dry-run stops after the quote. An upgrade charges the prorated difference
// on the saved card NOW; a downgrade switches at the period end and charges
// nothing today.
// ---------------------------------------------------------------------------

subscriptionsCommand
	.command('change-plan <id>')
	.description('Move a subscription to another plan (upgrade charges now, downgrade at period end)')
	.requiredOption('--to <linkId>', 'Target plan: the product id (same currency and interval)')
	.option('--dry-run', 'Show the quote only; apply nothing')
	.action(async (id: string, opts: { to: string; dryRun?: boolean }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Quoting plan change...', indent: 2 }).start();

		try {
			const quote = await client.subscriptions.previewPlanChange(id, opts.to);
			if (opts.dryRun) {
				spinner?.stop();
				output({ applied: false, ...quote });
				return;
			}
			if (spinner) spinner.text = 'Applying plan change...';
			const result = await client.subscriptions.changePlan(id, {
				targetLinkId: opts.to,
				prorationDate: quote.prorationDate,
			});
			spinner?.stop();
			output({ ...result, quote });
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
	.command('list')
	.description('List subscriptions')
	.option('--limit <n>', 'Results per page (default 10)', '10')
	.action(async (opts: { limit: string }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching subscriptions...', indent: 2 }).start();

		try {
			const data = await client.subscriptions.list({
				limit: Number.parseInt(opts.limit, 10) || 10,
			});
			spinner?.stop();

			if (json) {
				console.log(
					JSON.stringify({ total: data.total, hasMore: data.hasMore, items: data.items }),
				);
				return;
			}
			if (!data.items.length) {
				console.log(dim('\n  No subscriptions found.\n'));
				return;
			}
			console.log(`\n  ${chalk.bold(`Subscriptions (${data.total} total)`)}\n`);
			for (const s of data.items) {
				const amt = `${formatAmount(s.unitAmountMinor, s.currency)}${s.billingInterval ? `/${s.billingInterval}` : ''}`;
				const who = s.customerEmail ?? s.customerName ?? '—';
				console.log(`  ${s.status.padEnd(10)} ${amt.padEnd(14)} ${who.padEnd(28)} ${dim(s.id)}`);
			}
			if (data.hasMore) console.log(dim(`\n  ${data.items.length} of ${data.total} shown.`));
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
