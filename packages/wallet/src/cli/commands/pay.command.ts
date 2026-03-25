import { AgentaOS } from '@agentaos/pay';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { ensureSession } from '../../lib/ensure-session.js';
import { isJsonMode, output, outputError } from '../output.js';
import { brand, dim } from '../theme.js';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

async function requirePayClient(): Promise<AgentaOS | null> {
	const session = await ensureSession();
	if (!session.ok) {
		outputError(
			session.reason === 'session-expired'
				? 'Session expired. Run agenta login.'
				: 'Not logged in. Run agenta login.',
		);
		process.exitCode = 1;
		return null;
	}
	return new AgentaOS(session.token, { baseUrl: session.serverUrl });
}

// ---------------------------------------------------------------------------
// agenta pay
// ---------------------------------------------------------------------------

export const payCommand = new Command('pay').description('Payment operations');

// ---------------------------------------------------------------------------
// agenta pay checkout
// ---------------------------------------------------------------------------

payCommand
	.command('checkout')
	.description('Create a checkout session')
	.requiredOption('-a, --amount <amount>', 'Payment amount (e.g. 50.00)')
	.option('-c, --currency <currency>', 'Currency code (e.g. EUR, USD)')
	.option('-d, --description <desc>', 'Description shown on checkout page')
	.option('--email <email>', 'Pre-populate buyer email')
	.option('--json', 'Output as JSON')
	.action(
		async (opts: { amount: string; currency?: string; description?: string; email?: string }) => {
			const amount = Number.parseFloat(opts.amount);
			if (Number.isNaN(amount) || amount <= 0) {
				outputError('Amount must be a positive number.');
				process.exitCode = 1;
				return;
			}

			const client = await requirePayClient();
			if (!client) return;

			const json = isJsonMode();
			const spinner = json ? null : ora({ text: 'Creating checkout...', indent: 2 }).start();

			try {
				const checkout = await client.checkouts.create({
					amount,
					currency: opts.currency,
					description: opts.description,
					buyerEmail: opts.email,
				});
				const data = checkout as unknown as Record<string, unknown>;

				output({
					sessionId: checkout.sessionId,
					status: checkout.status,
					amount,
					currency: checkout.currency,
					checkoutUrl: checkout.checkoutUrl,
					x402Url: data.x402Url ?? null,
					expiresAt: checkout.expiresAt,
					hint: 'Share the checkoutUrl with your customer.',
				});
				spinner?.succeed('Checkout created');
			} catch (error: unknown) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				if (spinner) {
					spinner.fail(msg);
				} else {
					outputError(msg);
				}
				process.exitCode = 1;
			}
		},
	);

// ---------------------------------------------------------------------------
// agenta pay get <sessionId>
// ---------------------------------------------------------------------------

payCommand
	.command('get <sessionId>')
	.description('Get checkout session status')
	.option('--json', 'Output as JSON')
	.action(async (sessionId: string) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching checkout...', indent: 2 }).start();

		try {
			const checkout = await client.checkouts.retrieve(sessionId);
			const data = checkout as unknown as Record<string, unknown>;
			spinner?.stop();

			output({
				sessionId: checkout.sessionId,
				status: checkout.status,
				amount: checkout.amountOverride,
				currency: checkout.currency,
				checkoutUrl: checkout.checkoutUrl,
				x402Url: data.x402Url ?? null,
				expiresAt: checkout.expiresAt,
				createdAt: checkout.createdAt,
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

// ---------------------------------------------------------------------------
// agenta pay list
// ---------------------------------------------------------------------------

payCommand
	.command('list')
	.description('List checkout sessions')
	.option('--status <status>', 'Filter: open, completed, expired, cancelled')
	.option('--limit <n>', 'Results per page (default 10)', '10')
	.option('--json', 'Output as JSON')
	.action(async (opts: { status?: string; limit: string }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching checkouts...', indent: 2 }).start();

		try {
			const data = await client.checkouts.list({
				status: opts.status as 'open' | 'completed' | 'expired' | 'cancelled' | undefined,
				limit: Number.parseInt(opts.limit, 10) || 10,
			});
			spinner?.stop();

			if (json) {
				console.log(
					JSON.stringify({
						total: data.total,
						hasMore: data.hasMore,
						items: data.items.map((c) => {
							const raw = c as unknown as Record<string, unknown>;
							return {
								sessionId: c.sessionId,
								status: c.status,
								currency: c.currency,
								amount: raw.amount ?? c.amountOverride ?? null,
								description: raw.description ?? null,
								checkoutUrl: c.checkoutUrl,
								expiresAt: c.expiresAt,
							};
						}),
					}),
				);
			} else {
				if (!data.items.length) {
					console.log(dim('\n  No checkouts found.\n'));
					return;
				}
				console.log(`\n  ${chalk.bold(`Checkouts (${data.total} total)`)}\n`);
				for (const c of data.items) {
					const raw = c as unknown as Record<string, unknown>;
					const amt = raw.amount ?? c.amountOverride ?? '';
					const desc = raw.description ? dim(` ${raw.description}`) : '';
					console.log(
						`  ${c.status.padEnd(12)} ${String(amt).padEnd(8)} ${c.currency.padEnd(6)} ${dim(c.sessionId)}${desc}`,
					);
				}
				if (data.hasMore) console.log(dim(`\n  ${data.items.length} of ${data.total} shown.`));
				console.log('');
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
