import { type ZodError, z } from 'zod';

/**
 * Field builders shared by the operations. Messages name the CLI flag because
 * the CLI is the documented surface; the MCP error carries the key next to it.
 */

const AMOUNT_MESSAGE = 'Amount must be a positive number.';

/** Accepts `"49"` from a flag and `49` from a tool call alike. */
export const positiveAmount = z.coerce
	.number({ invalid_type_error: AMOUNT_MESSAGE })
	.positive(AMOUNT_MESSAGE);

export const pageLimit = z.coerce
	.number()
	.int()
	.min(1)
	.max(100)
	.default(10)
	.describe('Results per page');

export function oneOf<const T extends readonly [string, ...string[]]>(values: T, flag: string) {
	return z.enum(values, {
		errorMap: () => ({ message: `${flag} must be one of: ${values.join(', ')}.` }),
	});
}

/** The API only accepts https for return URLs; say so before the round-trip. */
export function httpsUrl(flag: string) {
	return z.string().regex(/^https:\/\/\S+$/i, `${flag} must be an https:// URL.`);
}

/** A page on the merchant's own site: http(s) with a host that has a dot. */
export function liveUrl(flag: string) {
	return z
		.string()
		.trim()
		.regex(/^https?:\/\/.+\..+/, `${flag} must be a live URL (https://…).`);
}

export function countryCode(flag: string) {
	return z
		.string()
		.trim()
		.regex(/^[A-Za-z]{2}$/, `${flag} must be a 2-letter code.`)
		.transform((code) => code.toUpperCase());
}

/** Every problem in one line, so a caller with no terminal is never asked twice. */
export function issuesText(error: ZodError): string {
	return error.issues.map((issue) => issue.message).join(' ');
}
