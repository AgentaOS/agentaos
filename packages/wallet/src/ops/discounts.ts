import type { DiscountCode, DiscountCodeDetail } from '@agentaos/pay';
import { z } from 'zod';
import { minorUnits, pageLimit, positiveAmount } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, lines, moreLine } from './words.js';

/**
 * Codes a buyer types at checkout on a subscription plan. A code can take a
 * percentage off, a fixed amount off, or nothing at all — a code that changes no
 * price still records who it brought in, which is how a referral works when the
 * referred buyer pays full price.
 *
 * What a code takes off lives with the card processor, so only `show` reports it.
 * `list` would need one call per row to say the same thing.
 */

const CODE_MESSAGE = '--code can use letters, numbers, dashes and underscores, up to 64.';
const BOTH_TERMS = 'Use --percent-off or --amount-off, not both.';

const createInput = z.object({
	code: z
		.string()
		.regex(/^[A-Za-z0-9_-]{1,64}$/, CODE_MESSAGE)
		.describe('The code buyers type at checkout'),
	name: z.string().optional().describe('Your label for it, shown on the buyer’s invoice'),
	percentOff: z.coerce
		.number()
		.min(0.01)
		.max(100)
		.optional()
		.describe('Percentage off the first invoice, e.g. 20'),
	amountOff: positiveAmount.optional().describe('Fixed amount off the first invoice, e.g. 5.00'),
	maxRedemptions: z.coerce
		.number()
		.int()
		.min(1)
		.optional()
		.describe('Stop the code working after this many subscribers use it'),
	expiresAt: z.string().optional().describe('Date the code stops working (YYYY-MM-DD)'),
	plan: z.string().optional().describe('Limit it to one plan: the product id. Omit for all plans'),
});

export const discountsCreate = operation({
	name: 'discounts.create',
	description: 'Create a discount code buyers type at checkout',
	input: createInput,
	async run(sdk, input): Promise<DiscountCode> {
		if (input.percentOff !== undefined && input.amountOff !== undefined) {
			throw new Error(BOTH_TERMS);
		}
		return sdk.discountCodes.create({
			code: input.code,
			name: input.name,
			percentOff: input.percentOff,
			amountOffMinor: input.amountOff === undefined ? undefined : minorUnits(input.amountOff),
			maxRedemptions: input.maxRedemptions,
			expiresAt: input.expiresAt,
			linkId: input.plan,
		});
	},
	describe(code) {
		return lines(
			`Created ${code.code} — ${scope(code)}.`,
			code.kind === 'tracking'
				? 'It changes no price; it tells you who it brought in.'
				: 'Buyers type it on the checkout page and the first invoice drops.',
			`Its id is ${code.id} (use it to show or archive the code).`,
		);
	},
});

export const discountsList = operation({
	name: 'discounts.list',
	description: 'List discount codes',
	input: z.object({ limit: pageLimit }),
	async run(sdk, input) {
		const page = await sdk.discountCodes.list({ limit: input.limit });
		return { total: page.total, hasMore: page.hasMore, items: page.items };
	},
	describe(page) {
		if (!page.items.length) {
			return 'No discount codes yet. Create one with discounts create --code LAUNCH20 --percent-off 20.';
		}
		return lines(
			`${count(page.total, 'discount code')}:`,
			...page.items.map((code) => `  - ${code.code} — ${scope(code)} — ${code.id}`),
			'What each one takes off is on discounts show.',
			moreLine(page.items.length, page.total, page.hasMore),
		);
	},
});

export const discountsShow = operation({
	name: 'discounts.show',
	description: 'Show one discount code: what it takes off and how many people used it',
	input: z.object({ id: z.string().min(1).describe('The discount code id') }),
	positional: 'id',
	async run(sdk, input): Promise<DiscountCodeDetail> {
		return sdk.discountCodes.get(input.id);
	},
	describe(code) {
		return lines(
			`${code.code} — ${code.termsLabel} — ${usage(code)} — ${state(code)}.`,
			code.planName ? `It works on "${code.planName}" only.` : 'It works on every plan you sell.',
		);
	},
});

export const discountsArchive = operation({
	name: 'discounts.archive',
	description: 'Stop a discount code working',
	input: z.object({ id: z.string().min(1).describe('The discount code id') }),
	positional: 'id',
	async run(sdk, input): Promise<DiscountCode> {
		return sdk.discountCodes.archive(input.id);
	},
	describe(code) {
		return lines(
			`${code.code} stops working now; nobody new can type it.`,
			'Subscribers who already used it keep the discount they were given.',
		);
	},
});

/** `discount — active — on "Pro monthly"` / `tracking only — active — all plans`. */
function scope(code: DiscountCode): string {
	const kind = code.kind === 'tracking' ? 'tracking only' : 'discount';
	const where = code.planName ? `on "${code.planName}"` : 'all plans';
	return `${kind} — ${state(code)} — ${where}`;
}

function state(code: DiscountCode): string {
	return code.active ? 'active' : 'stopped';
}

/** `used 14 of 100 times` when a cap was set, `used 14 times` when none was. */
function usage(code: DiscountCodeDetail): string {
	if (code.maxRedemptions === null) return `used ${count(code.timesRedeemed, 'time')}`;
	return `used ${code.timesRedeemed} of ${code.maxRedemptions} times`;
}

export const DISCOUNTS: OperationGroup = {
	name: 'discounts',
	description: 'Discount codes buyers type at checkout on a subscription plan',
	operations: [discountsCreate, discountsList, discountsShow, discountsArchive],
};
