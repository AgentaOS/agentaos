import { describe, expect, it } from 'vitest';
import { toBillingInterval, trialToDays } from './billing.js';
import { buildPlan } from './plan.js';
import { csv } from './report.js';
import type { Catalog, SourcePlan } from './types.js';

const plan = (overrides: Partial<SourcePlan>): SourcePlan => ({
	sourceId: 'p1',
	name: 'Pro',
	amount: 19,
	currency: 'EUR',
	type: 'subscription',
	interval: 'month',
	...overrides,
});

const catalog = (overrides: Partial<Catalog>): Catalog => ({
	source: 'paddle',
	plans: [],
	discounts: [],
	subscribers: [],
	skipped: [],
	...overrides,
});

describe('billing', () => {
	it('accepts monthly, yearly and 12-monthly cadences only', () => {
		expect(toBillingInterval('month', 1)).toEqual({ interval: 'month' });
		expect(toBillingInterval('month', 12)).toEqual({ interval: 'year' });
		expect(toBillingInterval('month', 3)).toHaveProperty('reason');
		expect(toBillingInterval('week', 1)).toHaveProperty('reason');
	});

	it('turns trial lengths into days', () => {
		expect(trialToDays('week', 2)).toBe(14);
		expect(trialToDays('month', 1)).toBe(30);
		expect(trialToDays('fortnight', 1)).toBeUndefined();
	});
});

describe('buildPlan', () => {
	it('leaves behind plans in currencies AgentaOS does not price in', () => {
		const result = buildPlan(
			catalog({ plans: [plan({}), plan({ sourceId: 'p2', currency: 'GBP' })] }),
		);
		expect(result.plans.map((p) => p.sourceId)).toEqual(['p1']);
		expect(result.skipped[0]?.reason).toContain('GBP');
	});

	it('caps trials at 730 days and drops zero-day trials', () => {
		const result = buildPlan(
			catalog({ plans: [plan({ trialDays: 900 }), plan({ sourceId: 'p2', trialDays: 0 })] }),
		);
		expect(result.plans.map((p) => p.trialDays)).toEqual([730, undefined]);
	});

	it('keeps a code limited to one plan, and widens one limited to several', () => {
		const plans = [plan({}), plan({ sourceId: 'p2' })];
		const result = buildPlan(
			catalog({
				plans,
				discounts: [
					{ sourceId: 'd1', code: 'ONE', percentOff: 10, planSourceIds: ['p1'] },
					{ sourceId: 'd2', code: 'TWO', percentOff: 10, planSourceIds: ['p1', 'p2'] },
				],
			}),
		);
		expect(result.discounts[0]?.planSourceId).toBe('p1');
		expect(result.discounts[1]?.planSourceId).toBeUndefined();
		expect(result.discounts[1]?.note).toContain('every plan');
	});

	it('leaves behind codes with bad characters or limited to one-time products', () => {
		const result = buildPlan(
			catalog({
				plans: [plan({ type: 'one_time', interval: undefined })],
				discounts: [
					{ sourceId: 'd1', code: 'SAVE 10', percentOff: 10, planSourceIds: [] },
					{ sourceId: 'd2', code: 'BOOK', percentOff: 10, planSourceIds: ['p1'] },
				],
			}),
		);
		expect(result.discounts).toHaveLength(0);
		expect(result.skipped.map((s) => s.sourceId)).toEqual(['d1', 'd2']);
	});
});

describe('csv', () => {
	it('quotes commas and neutralises spreadsheet formulas', () => {
		expect(csv(['a', 'b'], [['x,y', '=SUM(A1)']])).toBe('a,b\n"x,y",\'=SUM(A1)\n');
	});
});
