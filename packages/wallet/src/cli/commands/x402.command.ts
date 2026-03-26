import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { isJsonMode, output, outputError } from '../output.js';

export const x402Command = new Command('x402').description(
	'x402 payment protocol — check, discover, and pay for resources',
);

// ---------------------------------------------------------------------------
// agenta sub x402 check <url>
// ---------------------------------------------------------------------------

x402Command
	.command('check <url>')
	.description('Check if a URL requires x402 payment')
	.option('--json', 'Output as JSON')
	.action(async (url: string) => {
		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Checking...', indent: 2 }).start();

		try {
			const { checkX402 } = await import('../../lib/x402-client.js');
			const result = await checkX402(url);
			spinner?.stop();

			if (json) {
				console.log(JSON.stringify(result));
			} else {
				if (!result.requires402) {
					console.log(`\n  ${chalk.green('Free')} — ${url} is freely accessible.\n`);
				} else {
					console.log(`\n  ${chalk.yellow('Payment required')} (HTTP 402)\n`);
					if (result.paymentRequired?.accepts?.length) {
						for (const req of result.paymentRequired.accepts) {
							console.log(`  ${chalk.bold('Scheme:')}  ${req.scheme}`);
							console.log(`  ${chalk.bold('Network:')} ${req.network}`);
							console.log(`  ${chalk.bold('Amount:')}  ${req.amount}`);
							console.log(`  ${chalk.bold('Asset:')}   ${req.asset}`);
							console.log(`  ${chalk.bold('Pay to:')}  ${req.payTo}`);
							console.log('');
						}
					}
				}
			}
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
// agenta sub x402 discover <domain>
// ---------------------------------------------------------------------------

x402Command
	.command('discover <domain>')
	.description('Discover x402-protected endpoints on a domain')
	.option('--json', 'Output as JSON')
	.action(async (domain: string) => {
		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Discovering...', indent: 2 }).start();

		try {
			const { discoverX402 } = await import('../../lib/x402-client.js');
			const result = await discoverX402(domain);
			spinner?.stop();

			if (json) {
				console.log(JSON.stringify(result));
			} else {
				if (result.endpoints.length === 0) {
					console.log(`\n  No x402 endpoints found on ${domain}.\n`);
				} else {
					console.log(`\n  Found ${result.endpoints.length} x402 endpoint(s) on ${domain}:\n`);
					for (const ep of result.endpoints) {
						console.log(`  ${chalk.bold(ep.method)} ${ep.path}`);
						if (ep.scheme) console.log(`    Scheme: ${ep.scheme}`);
						if (ep.amount) console.log(`    Amount: ${ep.amount} ${ep.asset ?? ''}`);
						if (ep.description) console.log(`    ${ep.description}`);
						console.log('');
					}
				}
			}
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
// agenta sub x402 fetch <url>
// ---------------------------------------------------------------------------

x402Command
	.command('fetch <url>')
	.description('Fetch a 402-protected resource, automatically paying with your sub-account')
	.option('--max-amount <amount>', 'Maximum willing to pay in atomic units (e.g. 1000000 = 1 USDC)')
	.option('--json', 'Output as JSON')
	.action(async (url: string, opts: { maxAmount?: string }) => {
		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching...', indent: 2 }).start();

		try {
			const { SignerManager } = await import('../../lib/signer-manager.js');
			const { fetchWithX402 } = await import('../../lib/x402-client.js');

			const signerManager = new SignerManager();
			const signer = await signerManager.getSigner();

			const result = await fetchWithX402(url, signer, {
				maxAmount: opts.maxAmount,
			});

			spinner?.stop();

			if (json) {
				console.log(
					JSON.stringify({
						paid: result.paid,
						scheme: result.scheme ?? null,
						transaction: result.transaction ?? null,
						payer: result.payer ?? null,
						status: result.status,
						contentType: result.contentType ?? null,
						body: result.body.length > 10000 ? result.body.slice(0, 10000) : result.body,
						truncated: result.body.length > 10000,
					}),
				);
			} else {
				if (result.paid) {
					console.log(`\n  ${chalk.green('Paid')} via ${result.scheme ?? 'exact'} scheme`);
					if (result.transaction) console.log(`  ${chalk.bold('Tx:')} ${result.transaction}`);
					if (result.payer) console.log(`  ${chalk.bold('Payer:')} ${result.payer}`);
				} else {
					console.log(`\n  ${chalk.green('Free')} — no payment needed`);
				}
				console.log(`  ${chalk.bold('Status:')} ${result.status}`);
				if (result.contentType) console.log(`  ${chalk.bold('Type:')} ${result.contentType}`);
				console.log('');
				const body =
					result.body.length > 2000 ? `${result.body.slice(0, 2000)}\n...(truncated)` : result.body;
				console.log(body);
				console.log('');
			}

			signerManager.destroy();
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
