import chalk from 'chalk';
import { Command } from 'commander';
import {
	getDefaultSignerName,
	listSigners,
	loadSignerConfig,
	setDefaultSigner,
} from '../../lib/config.js';
import { isJsonMode, outputError } from '../output.js';

export const switchCommand = new Command('switch')
	.description('Switch or list active sub-account')
	.argument('[name]', 'Sub-account name to switch to')
	.option('--json', 'Output as JSON')
	.action(async (name?: string) => {
		try {
			const signers = listSigners();
			const current = getDefaultSignerName();

			if (!name) {
				// List mode
				if (isJsonMode()) {
					console.log(
						JSON.stringify({
							active: current ?? null,
							available: signers.map((s) => {
								try {
									const c = loadSignerConfig(s);
									return { name: s, address: c.ethAddress || null, isDefault: s === current };
								} catch {
									return { name: s, address: null, isDefault: s === current };
								}
							}),
						}),
					);
				} else {
					if (signers.length === 0) {
						console.log(
							`\n  No sub-accounts. Run ${chalk.bold('agenta sub create --name <name>')} to create one.\n`,
						);
						return;
					}
					console.log(`\n  ${chalk.bold('Sub-accounts:')}\n`);
					for (const s of signers) {
						const isActive = s === current;
						const marker = isActive ? chalk.green('●') : chalk.dim('○');
						let addr = '';
						try {
							addr = loadSignerConfig(s).ethAddress || '';
						} catch {}
						const short = addr ? chalk.dim(`${addr.slice(0, 6)}…${addr.slice(-4)}`) : '';
						console.log(`  ${marker} ${isActive ? chalk.bold(s) : s}  ${short}`);
					}
					console.log(`\n  ${chalk.dim('Switch:')} agenta sub switch <name>\n`);
				}
				return;
			}

			// Switch mode
			if (!signers.includes(name)) {
				throw new Error(
					`Sub-account "${name}" not found. Available: ${signers.join(', ') || 'none'}`,
				);
			}

			setDefaultSigner(name);

			if (isJsonMode()) {
				console.log(JSON.stringify({ active: name }));
			} else {
				console.log(`\n  ${chalk.green('●')} ${chalk.bold(name)} is now active.\n`);
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			outputError(msg);
			process.exitCode = 1;
		}
	});
