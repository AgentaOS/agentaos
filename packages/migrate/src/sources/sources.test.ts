import { describe, expect, it } from 'vitest';
import { mapCreemDiscount, mapCreemProducts, mapCreemSubscriptions } from './creem.js';
import { mapGumroadProducts, mapGumroadSubscribers } from './gumroad.js';
import {
	mapLemonSqueezyDiscount,
	mapLemonSqueezyPlans,
	mapLemonSqueezySubscription,
} from './lemonsqueezy.js';
import { mapPaddleDiscount, mapPaddlePrices, mapPaddleSubscriptions } from './paddle.js';

describe('Lemon Squeezy', () => {
	const stores = [{ id: '1', attributes: { currency: 'USD' } }];
	const product = {
		id: '10',
		attributes: {
			store_id: 1,
			name: 'Pro',
			description: '<p>All features</p>',
			status: 'published',
			buy_now_url: 'https://x.lemonsqueezy.com/buy/abc',
			large_thumb_url: null,
		},
	};
	const variant = (id: string, attrs: object) => ({
		id,
		attributes: {
			product_id: 10,
			name: 'Monthly',
			description: null,
			price: 1900,
			is_subscription: true,
			interval: 'month',
			interval_count: 1,
			has_free_trial: true,
			trial_interval: 'week',
			trial_interval_count: 2,
			status: 'published',
			...attrs,
		},
	});

	it('maps a monthly variant with a trial, in cents, with the store currency', () => {
		const catalog = mapLemonSqueezyPlans(stores, [product], [variant('100', {})]);
		expect(catalog.plans).toEqual([
			{
				sourceId: '100',
				name: 'Pro',
				description: 'All features',
				amount: 19,
				currency: 'USD',
				type: 'subscription',
				interval: 'month',
				trialDays: 14,
				imageUrl: undefined,
				oldUrl: 'https://x.lemonsqueezy.com/buy/abc',
			},
		]);
	});

	it('names variants when a product has several, and skips quarterly billing', () => {
		const catalog = mapLemonSqueezyPlans(
			stores,
			[product],
			[variant('100', {}), variant('101', { name: 'Quarterly', interval_count: 3 })],
		);
		expect(catalog.plans[0]?.name).toBe('Pro (Monthly)');
		expect(catalog.skipped[0]).toMatchObject({ sourceId: '101', kind: 'plan' });
	});

	it('maps a fixed discount limited to variants', () => {
		const [d] = mapLemonSqueezyDiscount({
			id: '5',
			attributes: {
				name: 'Launch',
				code: 'LAUNCH',
				amount: 500,
				amount_type: 'fixed',
				is_limited_to_products: true,
				is_limited_redemptions: false,
				max_redemptions: 0,
				expires_at: null,
				status: 'published',
			},
			relationships: { variants: { data: [{ id: '100' }] } },
		});
		expect(d).toMatchObject({ code: 'LAUNCH', amountOffMinor: 500, planSourceIds: ['100'] });
		expect(d?.maxRedemptions).toBeUndefined();
	});

	it('keeps only live subscriptions', () => {
		const sub = (status: string) => ({
			id: '1',
			attributes: {
				variant_id: 100,
				user_name: 'Ana',
				user_email: 'a@x.com',
				status,
				renews_at: null,
			},
		});
		expect(mapLemonSqueezySubscription(sub('active'))).toHaveLength(1);
		expect(mapLemonSqueezySubscription(sub('cancelled'))).toHaveLength(0);
	});
});

describe('Paddle', () => {
	const price = {
		id: 'pri_1',
		product_id: 'pro_1',
		name: 'Yearly',
		description: 'Pro yearly',
		unit_price: { amount: '19000', currency_code: 'EUR' },
		billing_cycle: { interval: 'year', frequency: 1 },
		trial_period: { interval: 'day', frequency: 7 },
		product: { name: 'Pro', description: null, image_url: null },
	};

	it('maps a yearly price with a 7-day trial', () => {
		expect(mapPaddlePrices([price]).plans[0]).toMatchObject({
			sourceId: 'pri_1',
			name: 'Pro',
			amount: 190,
			currency: 'EUR',
			interval: 'year',
			trialDays: 7,
		});
	});

	it('maps a one-time price and skips weekly billing', () => {
		const catalog = mapPaddlePrices([
			{ ...price, id: 'pri_2', billing_cycle: null, trial_period: null },
			{ ...price, id: 'pri_3', billing_cycle: { interval: 'week', frequency: 1 } },
		]);
		expect(catalog.plans[0]).toMatchObject({ type: 'one_time', name: 'Pro (Yearly)' });
		expect(catalog.skipped[0]?.sourceId).toBe('pri_3');
	});

	it('expands a discount limited to a product into its prices, and drops code-less ones', () => {
		const base = {
			id: 'dsc_1',
			description: 'Ten off',
			type: 'percentage' as const,
			amount: '10',
			usage_limit: null,
			expires_at: null,
		};
		expect(
			mapPaddleDiscount({ ...base, code: 'TEN', restrict_to: ['pro_1'] }, [price])[0],
		).toMatchObject({
			percentOff: 10,
			planSourceIds: ['pri_1'],
		});
		expect(mapPaddleDiscount({ ...base, code: null, restrict_to: null }, [price])).toEqual([]);
	});

	it('joins subscriptions to customers', () => {
		const subs = mapPaddleSubscriptions(
			[
				{
					customer_id: 'ctm_1',
					next_billed_at: '2026-11-01T00:00:00Z',
					items: [{ price: { id: 'pri_1' } }],
				},
			],
			[{ id: 'ctm_1', email: 'b@x.com', name: null }],
		);
		expect(subs).toEqual([
			{
				email: 'b@x.com',
				name: undefined,
				planSourceId: 'pri_1',
				renewsAt: '2026-11-01T00:00:00Z',
			},
		]);
	});
});

describe('Creem', () => {
	const product = {
		id: 'prod_1',
		name: 'Pro',
		description: null,
		price: 2900,
		currency: 'usd',
		billing_type: 'recurring' as const,
		billing_period: 'every-month',
		recurring_interval: 'month',
		recurring_interval_count: 1,
		trial_period_days: 14,
		trial_price: 100,
		status: 'active',
		product_url: 'https://creem.io/payment/prod_1',
	};

	it('maps a monthly product with a paid trial', () => {
		expect(mapCreemProducts([product]).plans[0]).toMatchObject({
			amount: 29,
			currency: 'USD',
			interval: 'month',
			trialDays: 14,
			trialAmount: 1,
			oldUrl: 'https://creem.io/payment/prod_1',
		});
	});

	it('skips every-three-months using billing_period when no interval is given', () => {
		const catalog = mapCreemProducts([
			{ ...product, recurring_interval: null, billing_period: 'every-three-months' },
		]);
		expect(catalog.plans).toHaveLength(0);
		expect(catalog.skipped).toHaveLength(1);
	});

	it('maps a percentage discount and an expanded subscription customer', () => {
		expect(
			mapCreemDiscount({
				id: 'dis_1',
				status: 'active',
				name: 'Half',
				code: 'HALF',
				type: 'percentage',
				percentage: 50,
				applies_to_products: ['prod_1'],
			})[0],
		).toMatchObject({ percentOff: 50, planSourceIds: ['prod_1'] });
		expect(
			mapCreemSubscriptions(
				[
					{
						product: { id: 'prod_1' },
						customer: { id: 'c', email: 'c@x.com', country: 'MK' },
						status: 'active',
					},
				],
				[],
			)[0],
		).toMatchObject({ email: 'c@x.com', country: 'MK', planSourceId: 'prod_1' });
	});
});

describe('Gumroad', () => {
	const membership = {
		id: 'g1',
		name: 'Club',
		price: 500,
		currency: 'usd',
		published: true,
		is_tiered_membership: true,
		variants: [
			{
				title: 'Tier',
				options: [
					{
						id: 't1',
						name: 'Basic',
						recurrence_prices: { monthly: { price_cents: 500 }, quarterly: { price_cents: 1400 } },
					},
				],
			},
		],
	};

	it('turns tiers into monthly plans and leaves quarterly behind', () => {
		const catalog = mapGumroadProducts([membership]);
		expect(catalog.plans).toEqual([
			expect.objectContaining({
				sourceId: 'g1:t1:monthly',
				amount: 5,
				interval: 'month',
				currency: 'USD',
			}),
		]);
		expect(catalog.skipped[0]?.sourceId).toBe('g1:t1:quarterly');
	});

	it('maps a one-time product', () => {
		expect(
			mapGumroadProducts([
				{ id: 'g2', name: 'Ebook', price: 1500, currency: 'eur', published: true },
			]).plans[0],
		).toMatchObject({ amount: 15, type: 'one_time', currency: 'EUR' });
	});

	it('assigns a subscriber to the only plan at their cadence', () => {
		const { plans } = mapGumroadProducts([membership]);
		const [sub] = mapGumroadSubscribers(
			[{ user_email: 'd@x.com', status: 'alive', recurrence: 'monthly' }],
			membership,
			plans,
		);
		expect(sub).toMatchObject({ planSourceId: 'g1:t1:monthly', note: undefined });
	});
});
