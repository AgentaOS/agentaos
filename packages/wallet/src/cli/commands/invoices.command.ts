import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { isJsonMode, output, outputError } from '../output.js';
import { dim } from '../theme.js';
import { requirePayClient } from './pay.command.js';

// ---------------------------------------------------------------------------
// agenta invoices — read invoices and manage receipts (list, receipt, send-receipt)
// ---------------------------------------------------------------------------

export const invoicesCommand = new Command('invoices').description(
	'Invoice & receipt management (list, receipt, send-receipt)',
);

invoicesCommand
	.command('list')
	.description('List invoices')
	.option('--limit <n>', 'Results per page (default 10)', '10')
	.option('--json', 'Output as JSON')
	.action(async (opts: { limit: string }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching invoices...', indent: 2 }).start();

		try {
			const data = await client.invoices.list({ limit: Number.parseInt(opts.limit, 10) || 10 });
			spinner?.stop();

			if (json) {
				console.log(JSON.stringify(data));
				return;
			}
			if (!data.items.length) {
				console.log(dim('\n  No invoices found.\n'));
				return;
			}
			console.log(`\n  ${chalk.bold(`Invoices (${data.total} total)`)}\n`);
			for (const inv of data.items) {
				console.log(
					`  ${inv.status.padEnd(10)} ${inv.invoiceNumber.padEnd(16)} ${String(inv.amount).padEnd(10)} ${inv.currency.padEnd(6)} ${(inv.buyerEmail ?? '—').padEnd(28)} ${dim(inv.id)}`,
				);
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

// ---------------------------------------------------------------------------
// agenta invoices receipt <id>
// ---------------------------------------------------------------------------

invoicesCommand
	.command('receipt <id>')
	.description('Download the receipt PDF for a paid invoice')
	.option('-o, --output <path>', 'File path to save the PDF to')
	.option('--json', 'Output as JSON')
	.action(async (id: string, opts: { output?: string }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching receipt...', indent: 2 }).start();
		const path = opts.output ?? `./receipt-${id}.pdf`;

		try {
			const pdf = await client.invoices.getReceipt(id);
			writeFileSync(path, pdf);
			spinner?.stop();

			output({ saved: path });
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

// ---------------------------------------------------------------------------
// agenta invoices send-receipt <id>
// ---------------------------------------------------------------------------

invoicesCommand
	.command('send-receipt <id>')
	.description('Re-send the receipt email to the buyer on file')
	.option('--json', 'Output as JSON')
	.action(async (id: string) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Sending receipt...', indent: 2 }).start();

		try {
			const result = await client.invoices.sendReceipt(id);
			spinner?.stop();

			if (json) {
				console.log(JSON.stringify(result));
				return;
			}
			console.log(`\n  Receipt sent to ${chalk.bold(result.sentTo)}\n`);
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
