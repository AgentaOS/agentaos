import type { BillingInterval } from './types.js';

export type IntervalUnit = 'day' | 'week' | 'month' | 'year';

const DAYS_PER_UNIT: Record<IntervalUnit, number> = { day: 1, week: 7, month: 30, year: 365 };

/**
 * AgentaOS bills monthly or yearly. Returns the matching interval, or a reason
 * the cadence cannot move as-is (quarterly, weekly and so on).
 */
export function toBillingInterval(
	unit: string,
	count: number,
): { interval: BillingInterval } | { reason: string } {
	if (unit === 'month' && count === 1) return { interval: 'month' };
	if (unit === 'year' && count === 1) return { interval: 'year' };
	if (unit === 'month' && count === 12) return { interval: 'year' };
	return { reason: `billed every ${count} ${unit}(s); AgentaOS plans are monthly or yearly` };
}

/** Trial length in days. A month counts as 30 days, a year as 365. */
export function trialToDays(unit: string, count: number): number | undefined {
	const perUnit = DAYS_PER_UNIT[unit as IntervalUnit];
	if (!perUnit || count <= 0) return undefined;
	return perUnit * count;
}

/** Cents to major units without float noise: 1999 → 19.99. */
export function fromMinor(minor: number | string): number {
	return Math.round(Number(minor)) / 100;
}
