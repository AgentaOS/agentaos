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
	.option('--json', 'Output as JSON')
	.action(async () => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching customers...', indent: 2 }).start();

		try {
			const customers = await client.customers.list();
			spinner?.stop();

			if (json) {
				console.log(JSON.stringify(customers));
				return;
			}
			if (!customers.length) {
				console.log(dim('\n  No customers found.\n'));
				return;
			}
			console.log(`\n  ${chalk.bold(`Customers (${customers.length})`)}\n`);
			for (const c of customers) {
				const name = c.name ?? '—';
				const country = c.country ?? '';
				console.log(
					`  ${(c.email ?? '—').padEnd(30)} ${name.padEnd(24)} ${country.padEnd(4)} ${dim(c.id)}`,
				);
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
