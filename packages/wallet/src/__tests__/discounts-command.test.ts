import type {
	AgentaOS,
	CreateDiscountCodeParams,
	DiscountCode,
	DiscountCodeDetail,
} from '@agentaos/pay';
import { describe, expect, it, vi } from 'vitest';
import { discountsCreate, discountsList, discountsShow } from '../ops/discounts.js';

const code: DiscountCode = {
	id: 'dc_1',
	code: 'LAUNCH20',
	kind: 'discount',
	planLinkId: 'link_1',
	planName: 'Pro monthly',
	archivedAt: null,
	createdAt: '2026-09-14T10:00:00.000Z',
	active: true,
};

const tracking: DiscountCode = {
	...code,
	id: 'dc_2',
	code: 'ALICE',
	kind: 'tracking',
	planLinkId: null,
	planName: null,
};

function sdkWith() {
	const create = vi.fn(async (_params: CreateDiscountCodeParams) => code);
	return { sdk: { discountCodes: { create } } as unknown as AgentaOS, create };
}

describe('agenta discounts create', () => {
	it('sends a fixed amount off as integer minor units', async () => {
		const { sdk, create } = sdkWith();
		await discountsCreate.run(sdk, { code: 'SAVE5', amountOff: 5 });
		expect(create.mock.calls[0]?.[0]).toMatchObject({ amountOffMinor: 500 });
	});

	it('sends a percentage off untouched, because it is not money', async () => {
		const { sdk, create } = sdkWith();
		await discountsCreate.run(sdk, { code: 'LAUNCH20', percentOff: 20 });
		expect(create.mock.calls[0]?.[0]).toMatchObject({ percentOff: 20 });
	});

	it('sends the plan as linkId, which is what the API calls it', async () => {
		const { sdk, create } = sdkWith();
		await discountsCreate.run(sdk, { code: 'LAUNCH20', percentOff: 20, plan: 'link_1' });
		expect(create.mock.calls[0]?.[0]).toMatchObject({ linkId: 'link_1' });
	});

	// Stripe applies one or the other; two terms is a question only the merchant
	// can answer, so it is asked before the round-trip, not after.
	it('refuses both a percentage and an amount', async () => {
		const { sdk } = sdkWith();
		await expect(
			discountsCreate.run(sdk, { code: 'BOTH', percentOff: 20, amountOff: 5 }),
		).rejects.toThrow('Use --percent-off or --amount-off, not both.');
	});

	it.each(['SAVE 20', 'SAVE%20', ''])('refuses the code %s', (bad) => {
		expect(discountsCreate.input.safeParse({ code: bad }).success).toBe(false);
	});

	it('tells the merchant a tracking code changes no price', () => {
		expect(discountsCreate.describe(tracking)).toContain('It changes no price');
	});

	it('tells the merchant a discount code drops the first invoice', () => {
		expect(discountsCreate.describe(code)).toContain('the first invoice drops');
	});
});

describe('agenta discounts list', () => {
	it('tells a merchant with no codes how to make one', () => {
		expect(discountsList.describe({ total: 0, hasMore: false, items: [] })).toContain(
			'discounts create',
		);
	});

	it('names the plan a code is limited to', () => {
		const text = discountsList.describe({ total: 1, hasMore: false, items: [code] });
		expect(text).toContain('LAUNCH20 — discount — active — on "Pro monthly"');
	});

	it('says "all plans" for a code with no plan of its own', () => {
		const text = discountsList.describe({ total: 1, hasMore: false, items: [tracking] });
		expect(text).toContain('ALICE — tracking only — active — all plans');
	});

	it('says an archived code is stopped, not silently omitted', () => {
		const archived = { ...code, active: false, archivedAt: '2026-09-14T11:00:00.000Z' };
		expect(discountsList.describe({ total: 1, hasMore: false, items: [archived] })).toContain(
			'stopped',
		);
	});
});

describe('agenta discounts show', () => {
	const detail: DiscountCodeDetail = {
		...code,
		termsLabel: '20% off',
		timesRedeemed: 14,
		maxRedemptions: 100,
	};

	it('prints the terms the server rendered, not terms of its own', () => {
		expect(discountsShow.describe(detail)).toContain('LAUNCH20 — 20% off — used 14 of 100 times');
	});

	it('drops the cap from the sentence when the merchant set none', () => {
		const text = discountsShow.describe({ ...detail, maxRedemptions: null });
		expect(text).toContain('used 14 times');
	});

	it('counts one redemption in the singular', () => {
		const text = discountsShow.describe({ ...detail, maxRedemptions: null, timesRedeemed: 1 });
		expect(text).toContain('used 1 time');
	});

	it('says which plan the code works on', () => {
		expect(discountsShow.describe(detail)).toContain('It works on "Pro monthly" only.');
	});

	it('says a code with no plan works on everything the merchant sells', () => {
		const text = discountsShow.describe({ ...detail, planName: null, planLinkId: null });
		expect(text).toContain('It works on every plan you sell.');
	});
});
