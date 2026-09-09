import type { Checkout } from '@agentaos/pay';
import { z } from 'zod';
import { oneOf, pageLimit, positiveAmount } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, day, lines, money, moreLine } from './words.js';

/** One-off checkouts: a single sale at a price you name, with no product behind it. */

const STATUSES = ['open', 'completed', 'expired', 'cancelled'] as const;

/** The standalone amount and description live on the row at runtime but not
 *  yet in the published `Checkout` type; a link-based session carries
 *  `amountOverride` instead. */
function amountOf(checkout: Checkout): number | null {
	const raw = checkout as unknown as { amount?: number; description?: string };
	return raw.amount ?? checkout.amountOverride ?? null;
}

function descriptionOf(checkout: Checkout): string | null {
	return (checkout as unknown as { description?: string }).description ?? null;
}

function x402UrlOf(checkout: Checkout): string | null {
	return (checkout as unknown as { x402Url?: string }).x402Url ?? null;
}

export interface CheckoutView {
	sessionId: string;
	status: Checkout['status'];
	amount: number | null;
	currency: string;
	description: string | null;
	checkoutUrl: string;
	x402Url: string | null;
	expiresAt: string;
	createdAt: string;
}

function checkoutView(checkout: Checkout): CheckoutView {
	return {
		sessionId: checkout.sessionId,
		status: checkout.status,
		amount: amountOf(checkout),
		currency: checkout.currency,
		description: descriptionOf(checkout),
		checkoutUrl: checkout.checkoutUrl,
		x402Url: x402UrlOf(checkout),
		expiresAt: checkout.expiresAt,
		createdAt: checkout.createdAt,
	};
}

function priceOf(view: CheckoutView): string {
	return view.amount === null ? view.currency.toUpperCase() : money(view.amount, view.currency);
}

function statusSentence(view: CheckoutView): string {
	switch (view.status) {
		case 'completed':
			return `Paid: ${priceOf(view)} came in.`;
		case 'open':
			return `Not paid yet; the link stays open until ${day(view.expiresAt)}.`;
		case 'expired':
			return 'This checkout expired unpaid. Create a new one to try again.';
		default:
			return 'This checkout was cancelled.';
	}
}

export const payCheckout = operation({
	name: 'pay.checkout',
	description: 'Create a checkout session',
	input: z.object({
		amount: positiveAmount.describe('Payment amount (e.g. 50.00)'),
		currency: z.string().optional().describe('Currency code (e.g. EUR, USD)'),
		description: z.string().optional().describe('Description shown on checkout page'),
		email: z
			.string()
			.email('--email must be an email address.')
			.optional()
			.describe('Pre-populate buyer email'),
	}),
	async run(sdk, input): Promise<CheckoutView> {
		const checkout = await sdk.checkouts.create({
			amount: input.amount,
			currency: input.currency,
			description: input.description,
			buyerEmail: input.email,
		});
		return { ...checkoutView(checkout), amount: input.amount };
	},
	describe(view) {
		return lines(
			`Checkout for ${priceOf(view)} created. Share ${view.checkoutUrl} with your customer.`,
			`It expires ${day(view.expiresAt)} if unpaid. Session id: ${view.sessionId}.`,
		);
	},
});

export const payGet = operation({
	name: 'pay.get',
	description: 'Get checkout session status',
	input: z.object({ sessionId: z.string().min(1).describe('The checkout session id') }),
	positional: 'sessionId',
	async run(sdk, input): Promise<CheckoutView> {
		return checkoutView(await sdk.checkouts.retrieve(input.sessionId));
	},
	describe(view) {
		return lines(
			`Checkout ${view.sessionId}${view.description ? ` (${view.description})` : ''}: ${view.status}.`,
			statusSentence(view),
		);
	},
});

export const payList = operation({
	name: 'pay.list',
	description: 'List checkout sessions',
	input: z.object({
		status: oneOf(STATUSES, '--status')
			.optional()
			.describe(`Filter: ${STATUSES.join(', ')}`),
		limit: pageLimit,
	}),
	async run(sdk, input) {
		const page = await sdk.checkouts.list({ status: input.status, limit: input.limit });
		return { total: page.total, hasMore: page.hasMore, items: page.items.map(checkoutView) };
	},
	describe(page) {
		if (!page.items.length) return 'No checkouts found. Create one with pay checkout.';
		return lines(
			`${count(page.total, 'checkout')}:`,
			...page.items.map(
				(view) =>
					`  - ${view.status} — ${priceOf(view)}${view.description ? ` — ${view.description}` : ''} — ${view.sessionId}`,
			),
			moreLine(page.items.length, page.total, page.hasMore),
		);
	},
});

export const PAY: OperationGroup = {
	name: 'pay',
	description: 'Payment operations',
	operations: [payCheckout, payGet, payList],
};
