import type { CreatePaymentLinkParams, PaymentLink } from '@agentaos/pay';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { isJsonMode, output, outputError } from '../output.js';
import { dim } from '../theme.js';
import { requirePayClient } from './pay.command.js';

// ---------------------------------------------------------------------------
// agenta products
//
// A product is a payment link: a priced, reusable, shareable checkout. One-time
// or a subscription plan. `agenta pay checkout` makes a single session; this
// makes the thing the dashboard's Products grid shows, and it is what go-live
// counts as the merchant's first product.
// ---------------------------------------------------------------------------

export const productsCommand = new Command('products').description(
	'Products and subscription plans (reusable payment links)',
);

interface CreateOptions {
	name: string;
	amount: string;
	currency?: string;
	description?: string;
	subscription?: boolean;
	interval?: string;
	trialDays?: string;
	successUrl?: string;
}

/** Flags → API params, or the one sentence that explains why they cannot be. */
export function buildCreateParams(
	opts: CreateOptions,
): { ok: true; params: CreatePaymentLinkParams } | { ok: false; error: string } {
	const amount = Number.parseFloat(opts.amount);
	if (Number.isNaN(amount) || amount <= 0) {
		return { ok: false, error: 'Amount must be a positive number.' };
	}
	// The API only accepts https here; say so before the round-trip.
	if (opts.successUrl !== undefined && !/^https:\/\/\S+$/i.test(opts.successUrl)) {
		return { ok: false, error: '--success-url must be an https:// URL.' };
	}

	const params: CreatePaymentLinkParams = {
		name: opts.name,
		amount,
		currency: opts.currency,
		description: opts.description,
		successUrl: opts.successUrl,
	};

	if (!opts.subscription) {
		if (opts.interval || opts.trialDays) {
			return { ok: false, error: '--interval and --trial-days need --subscription.' };
		}
		return { ok: true, params };
	}

	if (opts.interval !== 'month' && opts.interval !== 'year') {
		return { ok: false, error: '--subscription needs --interval month or --interval year.' };
	}
	params.type = 'subscription';
	params.billingInterval = opts.interval;

	if (opts.trialDays !== undefined) {
		const trialDays = Number(opts.trialDays);
		if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 730) {
			return { ok: false, error: '--trial-days must be a whole number of days, 1 to 730.' };
		}
		params.trialPeriodDays = trialDays;
	}
	return { ok: true, params };
}

function productView(link: PaymentLink): Record<string, unknown> {
	return {
		id: link.id,
		name: link.name,
		type: link.type,
		billingInterval: link.billingInterval,
		amount: link.amount,
		currency: link.currency,
		status: link.status,
		checkoutUrl: link.checkoutUrl,
		successUrl: link.successUrl,
	};
}

// ---------------------------------------------------------------------------
// agenta products create
// ---------------------------------------------------------------------------

productsCommand
	.command('create')
	.description('Create a product (one-time) or a subscription plan')
	.requiredOption('-n, --name <name>', 'Product name buyers see')
	.requiredOption('-a, --amount <amount>', 'Price (e.g. 49.00)')
	.option('-c, --currency <currency>', 'Currency code (e.g. EUR, USD)')
	.option('-d, --description <desc>', 'Description shown on the checkout page')
	.option('--subscription', 'Recurring plan instead of a one-time product')
	.option('--interval <interval>', 'Billing cadence for a plan: month or year')
	.option('--trial-days <days>', 'Free trial length for a plan, in days')
	.option('--success-url <url>', 'https URL buyers return to after paying (we append ?sessionId=…)')
	.action(async (opts: CreateOptions) => {
		const built = buildCreateParams(opts);
		if (!built.ok) {
			outputError(built.error);
			process.exitCode = 1;
			return;
		}

		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Creating product...', indent: 2 }).start();

		try {
			const link = await client.paymentLinks.create(built.params);
			output({
				...productView(link),
				hint: 'Share the checkoutUrl with your customers. It works for every sale.',
			});
			spinner?.succeed('Product created');
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
// agenta products list
// ---------------------------------------------------------------------------

productsCommand
	.command('list')
	.description('List products and plans')
	.option('--limit <n>', 'Results per page (default 10)', '10')
	.action(async (opts: { limit: string }) => {
		const client = await requirePayClient();
		if (!client) return;

		const json = isJsonMode();
		const spinner = json ? null : ora({ text: 'Fetching products...', indent: 2 }).start();

		try {
			const data = await client.paymentLinks.list({
				limit: Number.parseInt(opts.limit, 10) || 10,
			});
			spinner?.stop();

			if (json) {
				console.log(
					JSON.stringify({
						total: data.total,
						hasMore: data.hasMore,
						items: data.items.map(productView),
					}),
				);
				return;
			}

			if (!data.items.length) {
				console.log(dim('\n  No products yet. Create one with agenta products create.\n'));
				return;
			}
			console.log(`\n  ${chalk.bold(`Products (${data.total} total)`)}\n`);
			for (const link of data.items) {
				const plan = link.type === 'subscription' ? `/${link.billingInterval}` : '';
				console.log(
					`  ${link.status.padEnd(10)} ${String(link.amount).padEnd(8)} ${`${link.currency}${plan}`.padEnd(10)} ${(link.name ?? '').padEnd(24)} ${dim(link.id)}`,
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
