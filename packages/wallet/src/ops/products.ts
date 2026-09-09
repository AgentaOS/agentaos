import type { CreatePaymentLinkParams, PaymentLink } from '@agentaos/pay';
import { z } from 'zod';
import { httpsUrl, issuesText, oneOf, pageLimit, positiveAmount } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, lines, money, moreLine } from './words.js';

/**
 * A product is a payment link: a priced, reusable, shareable checkout. One-time
 * or a subscription plan. `pay checkout` makes a single session; this makes
 * the thing the dashboard's Products grid shows, and it is what go-live counts
 * as the merchant's first product.
 */

const TRIAL_MESSAGE = '--trial-days must be a whole number of days, 1 to 730.';

const createInput = z.object({
	name: z.string().min(1).describe('Product name buyers see'),
	amount: positiveAmount.describe('Price (e.g. 49.00)'),
	currency: z.string().optional().describe('Currency code (e.g. EUR, USD)'),
	description: z.string().optional().describe('Description shown on the checkout page'),
	subscription: z.boolean().optional().describe('Recurring plan instead of a one-time product'),
	interval: oneOf(['month', 'year'], '--interval')
		.optional()
		.describe('Billing cadence for a plan: month or year'),
	trialDays: z.coerce
		.number({ invalid_type_error: TRIAL_MESSAGE })
		.int(TRIAL_MESSAGE)
		.min(1, TRIAL_MESSAGE)
		.max(730, TRIAL_MESSAGE)
		.optional()
		.describe('Free trial length for a plan, in days'),
	successUrl: httpsUrl('--success-url')
		.optional()
		.describe('https URL buyers return to after paying (we append ?sessionId=…)'),
	cancelUrl: httpsUrl('--cancel-url')
		.optional()
		.describe('https URL buyers return to if they back out'),
});

type CreateInput = z.infer<typeof createInput>;

/** Flags → API params, or the one sentence that explains why they cannot be. */
export function buildCreateParams(
	flags: unknown,
): { ok: true; params: CreatePaymentLinkParams } | { ok: false; error: string } {
	const parsed = createInput.safeParse(flags);
	if (!parsed.success) return { ok: false, error: issuesText(parsed.error) };
	const planError = planRuleBroken(parsed.data);
	if (planError) return { ok: false, error: planError };
	return { ok: true, params: toParams(parsed.data) };
}

/** The rules that span two flags; zod checks one field at a time. */
function planRuleBroken(input: CreateInput): string | null {
	if (!input.subscription) {
		return input.interval || input.trialDays !== undefined
			? '--interval and --trial-days need --subscription.'
			: null;
	}
	return input.interval ? null : '--subscription needs --interval month or --interval year.';
}

function toParams(input: CreateInput): CreatePaymentLinkParams {
	const params: CreatePaymentLinkParams = {
		name: input.name,
		amount: input.amount,
		currency: input.currency,
		description: input.description,
		successUrl: input.successUrl,
		cancelUrl: input.cancelUrl,
	};
	if (input.subscription) {
		params.type = 'subscription';
		params.billingInterval = input.interval;
		if (input.trialDays !== undefined) params.trialPeriodDays = input.trialDays;
	}
	return params;
}

export interface ProductView {
	id: string;
	name: string | null;
	type: PaymentLink['type'];
	billingInterval: PaymentLink['billingInterval'];
	amount: number;
	currency: string;
	status: PaymentLink['status'];
	checkoutUrl: string;
	successUrl: string | null;
	cancelUrl: string | null;
}

function productView(link: PaymentLink): ProductView {
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
		cancelUrl: link.cancelUrl,
	};
}

/** `€29.00/month` for a plan, `€49.00` for a one-time product. */
function price(product: ProductView): string {
	const cadence = product.billingInterval ? `/${product.billingInterval}` : '';
	return `${money(product.amount, product.currency)}${cadence}`;
}

export const productsCreate = operation({
	name: 'products.create',
	description: 'Create a product (one-time) or a subscription plan',
	input: createInput,
	async run(sdk, input): Promise<ProductView> {
		const built = buildCreateParams(input);
		if (!built.ok) throw new Error(built.error);
		return productView(await sdk.paymentLinks.create(built.params));
	},
	describe(product) {
		const kind = product.type === 'subscription' ? 'plan' : 'product';
		return lines(
			`Created the ${kind} "${product.name}" at ${price(product)}.`,
			`Buyers pay at ${product.checkoutUrl}; share it anywhere, it works for every sale.`,
			`Its id is ${product.id} (the linkId for checkouts and plan changes).`,
		);
	},
});

export const productsList = operation({
	name: 'products.list',
	description: 'List products and plans',
	input: z.object({ limit: pageLimit }),
	async run(sdk, input) {
		const page = await sdk.paymentLinks.list({ limit: input.limit });
		return { total: page.total, hasMore: page.hasMore, items: page.items.map(productView) };
	},
	describe(page) {
		if (!page.items.length) return 'No products yet. Create one with products create.';
		return lines(
			`${count(page.total, 'product')}:`,
			...page.items.map(
				(product) =>
					`  - ${product.name ?? '(unnamed)'} — ${price(product)} — ${product.status} — ${product.id}`,
			),
			moreLine(page.items.length, page.total, page.hasMore),
		);
	},
});

export const PRODUCTS: OperationGroup = {
	name: 'products',
	description: 'Products and subscription plans (reusable payment links)',
	operations: [productsCreate, productsList],
};
