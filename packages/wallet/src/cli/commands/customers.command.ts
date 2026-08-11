import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { isJsonMode, outputError } from '../output.js';
import { dim } from '../theme.js';
import { requirePayClient } from './pay.command.js';

// ---------------------------------------------------------------------------
// agenta customers — read the customers who have paid you (list)
// ---------------------------------------------------------------------------

export const customersCommand = new Command('customers').description('Customer management (list)');

customersCommand
	.command('list')
	.description('List customers')
	.option('--limit <n>', 'Results per page (default 10)', '10')
	.option('--json', 'Output as JSON')
	.action(async (opts: { limit: string }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching customers...', indent: 2 }).start();

		try {
			const data = await client.customers.list({ limit: Number.parseInt(opts.limit, 10) || 10 });
			spinner?.stop();

			if (json) {
				console.log(
					JSON.stringify({ total: data.total, hasMore: data.hasMore, items: data.items }),
				);
				return;
			}
			if (!data.items.length) {
				console.log(dim('\n  No customers found.\n'));
				return;
			}
			console.log(`\n  ${chalk.bold(`Customers (${data.total} total)`)}\n`);
			for (const c of data.items) {
				const name = c.name ?? '—';
				const country = c.country ?? '';
				console.log(
					`  ${(c.email ?? '—').padEnd(30)} ${name.padEnd(24)} ${country.padEnd(4)} ${dim(c.id)}`,
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
