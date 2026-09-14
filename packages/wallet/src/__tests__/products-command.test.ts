import { describe, expect, it } from 'vitest';
import { type ProductView, buildCreateParams, productsCreate } from '../ops/products.js';

const oneTime = { name: 'Launch Kit', amount: '49', currency: 'EUR' };

const plan: ProductView = {
	id: 'link_1',
	name: 'Pro',
	type: 'subscription',
	billingInterval: 'month',
	amount: 29,
	currency: 'EUR',
	status: 'active',
	checkoutUrl: 'https://app.agentaos.ai/pay/abc',
	successUrl: null,
	cancelUrl: null,
	trialPeriodDays: null,
	trialAmount: null,
};

describe('agenta products create — flags to API params', () => {
	it('builds a one-time product by default', () => {
		const built = buildCreateParams({ ...oneTime, description: 'One-off' });
		expect(built).toEqual({
			ok: true,
			params: { name: 'Launch Kit', amount: 49, currency: 'EUR', description: 'One-off' },
		});
	});

	it('builds a subscription plan with its cadence and trial', () => {
		const built = buildCreateParams({
			...oneTime,
			subscription: true,
			interval: 'month',
			trialDays: '14',
		});
		expect(built.ok).toBe(true);
		if (!built.ok) return;
		expect(built.params.type).toBe('subscription');
		expect(built.params.billingInterval).toBe('month');
		expect(built.params.trialPeriodDays).toBe(14);
	});

	// The server rejects a subscription without a cadence; saying so before the
	// round-trip is the difference between a sentence and a stack of JSON.
	it('refuses a plan without an interval', () => {
		const built = buildCreateParams({ ...oneTime, subscription: true });
		expect(built).toEqual({
			ok: false,
			error: '--subscription needs --interval month or --interval year.',
		});
	});

	it('refuses plan-only flags on a one-time product', () => {
		expect(buildCreateParams({ ...oneTime, interval: 'month' }).ok).toBe(false);
		expect(buildCreateParams({ ...oneTime, trialDays: '7' }).ok).toBe(false);
		expect(buildCreateParams({ ...oneTime, trialAmount: '9' }).ok).toBe(false);
	});

	it('carries a paid trial price through as the plan’s trialAmount', () => {
		const built = buildCreateParams({
			...oneTime,
			subscription: true,
			interval: 'month',
			trialDays: '30',
			trialAmount: '9',
		});
		expect(built.ok).toBe(true);
		if (!built.ok) return;
		expect(built.params.trialAmount).toBe(9);
	});

	it('leaves trialAmount unset for a free trial, so the trial stays free', () => {
		const built = buildCreateParams({
			...oneTime,
			subscription: true,
			interval: 'month',
			trialDays: '30',
		});
		expect(built.ok).toBe(true);
		if (!built.ok) return;
		expect(built.params.trialAmount).toBeUndefined();
	});

	// A price for a trial nobody gets would never be charged; the API refuses it too.
	it('refuses a trial price with no trial length', () => {
		expect(
			buildCreateParams({ ...oneTime, subscription: true, interval: 'month', trialAmount: '9' }),
		).toEqual({
			ok: false,
			error: '--trial-amount needs --trial-days: a trial price needs a trial to price.',
		});
	});

	it.each(['0', '-1', 'free'])('refuses trial price %s', (trialAmount) => {
		const built = buildCreateParams({
			...oneTime,
			subscription: true,
			interval: 'month',
			trialDays: '30',
			trialAmount,
		});
		expect(built.ok).toBe(false);
	});

	it('passes the return URLs through so buyers land back in the app', () => {
		const built = buildCreateParams({
			...oneTime,
			successUrl: 'https://myapp.com/thanks',
			cancelUrl: 'https://myapp.com/pricing',
		});
		expect(built.ok).toBe(true);
		if (!built.ok) return;
		expect(built.params.successUrl).toBe('https://myapp.com/thanks');
		expect(built.params.cancelUrl).toBe('https://myapp.com/pricing');
	});

	it('refuses a plain-http cancel URL', () => {
		expect(buildCreateParams({ ...oneTime, cancelUrl: 'http://myapp.com/pricing' })).toEqual({
			ok: false,
			error: '--cancel-url must be an https:// URL.',
		});
	});

	// The API rejects anything but https; a plain-http localhost URL is the
	// mistake every first integration makes, so name it.
	it.each(['http://localhost:3000/thanks', 'myapp.com/thanks', 'https://'])(
		'refuses success URL %s',
		(successUrl) => {
			expect(buildCreateParams({ ...oneTime, successUrl })).toEqual({
				ok: false,
				error: '--success-url must be an https:// URL.',
			});
		},
	);

	it.each(['0', '-5', 'abc'])('refuses amount %s', (amount) => {
		expect(buildCreateParams({ ...oneTime, amount }).ok).toBe(false);
	});

	it.each(['0', '731', '1.5', 'two'])('refuses trial length %s', (trialDays) => {
		const built = buildCreateParams({
			...oneTime,
			subscription: true,
			interval: 'year',
			trialDays,
		});
		expect(built.ok).toBe(false);
	});
});

describe('agenta products create — what the merchant reads back', () => {
	it('says nothing about a trial on a plan that has none', () => {
		expect(productsCreate.describe(plan)).not.toContain('New subscribers get');
	});

	it('names the price of a paid trial and the price it renews at', () => {
		const text = productsCreate.describe({ ...plan, trialPeriodDays: 30, trialAmount: 9 });
		expect(text).toContain(
			'New subscribers get 30 days for €9.00, then it renews at €29.00/month.',
		);
	});

	it('says a trial with no price is free', () => {
		const text = productsCreate.describe({ ...plan, trialPeriodDays: 14 });
		expect(text).toContain('New subscribers get 14 days free');
	});

	// "The first 1 day are free" is the sentence this phrasing exists to avoid.
	it('reads correctly for a one-day trial', () => {
		const text = productsCreate.describe({ ...plan, trialPeriodDays: 1 });
		expect(text).toContain('New subscribers get 1 day free');
	});
});
