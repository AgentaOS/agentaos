/**
 * How results read to a founder who is not technical: money as "€29.00",
 * dates as "22 Sep 2026", counts with the right plural.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `money(29, 'eur')` → `€29.00`. Amounts in major units, as the API's decimal fields carry them. */
/** The API names a product's currency by the token it settles in (EURC, USDC);
 *  a founder reads euros and dollars. */
const SETTLEMENT_TOKENS: Record<string, string> = { EURC: 'EUR', USDC: 'USD', EURE: 'EUR' };

export function money(amount: number, currency: string): string {
	const upper = currency.toUpperCase();
	const code = SETTLEMENT_TOKENS[upper] ?? upper;
	try {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${code}`;
	}
}

/** `moneyMinor(2900, 'eur')` → `€29.00`. Platform currencies (EUR/USD) are 2-decimal. */
export function moneyMinor(minor: number, currency: string): string {
	return money(minor / 100, currency);
}

/**
 * `plainMinor(500)` → `5.00`. For the one response that carries amounts without the
 * currency they are in — the credit history. Guessing a symbol there would state
 * something the server never said.
 */
export function plainMinor(minor: number): string {
	return (minor / 100).toFixed(2);
}

/** `day('2026-09-22T10:00:00Z')` → `22 Sep 2026`. */
export function day(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `count(3, 'product')` → `3 products`; `count(1, 'product')` → `1 product`. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
	return `${n} ${n === 1 ? singular : plural}`;
}

/** Join the parts that are set, one per line; an empty string is a blank line. */
export function lines(...parts: Array<string | null | undefined | false>): string {
	return parts.filter((part): part is string => typeof part === 'string').join('\n');
}

/** A closing line for a paginated list: nothing when everything was shown. */
export function moreLine(shown: number, total: number, hasMore: boolean): string | null {
	return hasMore ? `${shown} of ${total} shown; raise the limit to see more.` : null;
}
