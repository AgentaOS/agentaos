import type { AgentaOS, Credit, GrantCreditParams } from '@agentaos/pay';
import { describe, expect, it, vi } from 'vitest';
import { subscriptionsCredit, subscriptionsCredits } from '../ops/subscriptions.js';

/**
 * The credit is money out of the merchant's pocket, so two things are asserted
 * here and nowhere else: the amount a founder types in euros reaches the API as
 * integer minor units, and every figure printed back is one the server sent.
 */

const granted: Credit = {
	id: 'cbtxn_1',
	amountMinor: 500,
	currency: 'eur',
	reason: 'Two days of downtime',
	creditBalanceMinor: 500,
	nextInvoiceMinor: 1900,
	nextInvoiceDueAfterCreditMinor: 1400,
	nextInvoiceAt: '2026-10-01T00:00:00.000Z',
	createdBy: 'user_1',
	createdAt: '2026-09-14T10:00:00.000Z',
};

function sdkWith() {
	const credit = vi.fn(async (_id: string, _params: GrantCreditParams) => granted);
	return { sdk: { subscriptions: { credit } } as unknown as AgentaOS, credit };
}

describe('agenta subscriptions credit', () => {
	it('sends the euros typed as integer minor units', async () => {
		const { sdk, credit } = sdkWith();
		await subscriptionsCredit.run(sdk, { id: 'sub_1', amount: 5, reason: 'Downtime' });
		expect(credit.mock.calls[0]?.[1]).toMatchObject({ amountMinor: 500 });
	});

	it('rounds a sub-cent amount rather than sending a fraction the API would refuse', async () => {
		const { sdk, credit } = sdkWith();
		await subscriptionsCredit.run(sdk, { id: 'sub_1', amount: 5.005, reason: 'Downtime' });
		expect(credit.mock.calls[0]?.[1]).toMatchObject({ amountMinor: 501 });
	});

	it('mints an idempotency key so a network retry inside the call cannot credit twice', async () => {
		const { sdk, credit } = sdkWith();
		await subscriptionsCredit.run(sdk, { id: 'sub_1', amount: 5, reason: 'Downtime' });
		expect(credit.mock.calls[0]?.[1]).toMatchObject({ idempotencyKey: expect.any(String) });
	});

	// Running the command twice is two deliberate credits, so the keys must differ.
	it('mints a different key on each invocation', async () => {
		const { sdk, credit } = sdkWith();
		await subscriptionsCredit.run(sdk, { id: 'sub_1', amount: 5, reason: 'Downtime' });
		await subscriptionsCredit.run(sdk, { id: 'sub_1', amount: 5, reason: 'Downtime' });
		const [first, second] = credit.mock.calls.map((call) => call[1].idempotencyKey);
		expect(first).not.toBe(second);
	});

	it('reports the key it used, so a caller who must retry can send the same one', async () => {
		const { sdk } = sdkWith();
		const result = await subscriptionsCredit.run(sdk, {
			id: 'sub_1',
			amount: 5,
			reason: 'Downtime',
		});
		expect(result.idempotencyKey).toEqual(expect.any(String));
	});

	it('names what is left to pay using the server’s figure, not its own subtraction', () => {
		const text = subscriptionsCredit.describe({ ...granted, idempotencyKey: 'k' });
		expect(text).toContain('leaving €14.00 to pay');
	});

	it('names the date the credit is used', () => {
		const text = subscriptionsCredit.describe({ ...granted, idempotencyKey: 'k' });
		expect(text).toContain('1 Oct 2026');
	});
});

describe('agenta subscriptions credits', () => {
	it('tells a merchant with no credits what to do next', () => {
		expect(subscriptionsCredits.describe({ items: [], balanceMinor: 0 })).toContain(
			'subscriptions credit',
		);
	});

	it('prints each credit with the merchant’s own reason', () => {
		const text = subscriptionsCredits.describe({
			items: [
				{
					id: 'cbtxn_1',
					amountMinor: 500,
					reason: 'Two days of downtime',
					createdBy: 'user_1',
					createdAt: '2026-09-14T10:00:00.000Z',
				},
			],
			balanceMinor: 500,
		});
		expect(text).toContain('5.00 — Two days of downtime — 14 Sep 2026');
	});

	// The history carries no currency, so printing a symbol would be us guessing.
	it('states no currency symbol it was never given', () => {
		const text = subscriptionsCredits.describe({
			items: [
				{
					id: 'cbtxn_1',
					amountMinor: 500,
					reason: 'Downtime',
					createdBy: 'user_1',
					createdAt: '2026-09-14T10:00:00.000Z',
				},
			],
			balanceMinor: 500,
		});
		expect(text).not.toContain('€');
	});

	it('says the unspent balance spans every subscription the buyer has', () => {
		const text = subscriptionsCredits.describe({
			items: [
				{
					id: 'cbtxn_1',
					amountMinor: 500,
					reason: 'Downtime',
					createdBy: 'user_1',
					createdAt: '2026-09-14T10:00:00.000Z',
				},
			],
			balanceMinor: 1000,
		});
		expect(text).toContain('10.00 is still unspent, across every subscription');
	});
});
