// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { camelToSnake, snakeToCamel } from './transform.js';

describe('snakeToCamel', () => {
	it('camelizes flat snake_case keys', () => {
		expect(snakeToCamel({ seller_mode: 'crypto', payment_count: 3 })).toEqual({
			sellerMode: 'crypto',
			paymentCount: 3,
		});
	});

	it('camelizes keys of nested objects', () => {
		const input = { outer_key: { inner_key: { deep_key: 1 } } };
		expect(snakeToCamel(input)).toEqual({ outerKey: { innerKey: { deepKey: 1 } } });
	});

	it('camelizes keys inside arrays of objects', () => {
		const input = { line_items: [{ unit_price: 100 }, { unit_price: 200 }] };
		expect(snakeToCamel(input)).toEqual({ lineItems: [{ unitPrice: 100 }, { unitPrice: 200 }] });
	});

	it('passes a Date instance through untouched (same reference)', () => {
		const date = new Date('2026-08-05T00:00:00.000Z');
		const result = snakeToCamel({ created_at: date }) as { createdAt: Date };
		expect(result.createdAt).toBe(date);
	});

	it('returns null unchanged', () => {
		expect(snakeToCamel(null)).toBeNull();
	});

	it('returns primitives unchanged', () => {
		expect(snakeToCamel('a_string')).toBe('a_string');
		expect(snakeToCamel(42)).toBe(42);
		expect(snakeToCamel(true)).toBe(true);
	});

	it('leaves already-camel keys untouched', () => {
		expect(snakeToCamel({ alreadyCamel: 1 })).toEqual({ alreadyCamel: 1 });
	});

	it('does not mutate the input object', () => {
		const input = { seller_mode: 'crypto' };
		snakeToCamel(input);
		expect(input).toEqual({ seller_mode: 'crypto' });
	});
});

describe('camelToSnake', () => {
	it('snake-cases flat camelCase keys', () => {
		expect(camelToSnake({ sellerMode: 'crypto', paymentCount: 3 })).toEqual({
			seller_mode: 'crypto',
			payment_count: 3,
		});
	});

	it('snake-cases keys of nested objects', () => {
		const input = { outerKey: { innerKey: { deepKey: 1 } } };
		expect(camelToSnake(input)).toEqual({ outer_key: { inner_key: { deep_key: 1 } } });
	});

	it('snake-cases keys inside arrays of objects', () => {
		const input = { lineItems: [{ unitPrice: 100 }, { unitPrice: 200 }] };
		expect(camelToSnake(input)).toEqual({
			line_items: [{ unit_price: 100 }, { unit_price: 200 }],
		});
	});

	it('passes a Date instance through untouched (same reference)', () => {
		const date = new Date('2026-08-05T00:00:00.000Z');
		const result = camelToSnake({ createdAt: date }) as { created_at: Date };
		expect(result.created_at).toBe(date);
	});

	it('returns null and primitives unchanged', () => {
		expect(camelToSnake(null)).toBeNull();
		expect(camelToSnake('billingInterval')).toBe('billingInterval');
		expect(camelToSnake(7)).toBe(7);
	});
});

describe('round-trip', () => {
	it('snake -> camel -> snake reproduces the original', () => {
		const input = {
			session_id: 's_1',
			nested_obj: { inner_key: 1 },
			arr: [{ item_key: 2 }],
		};
		expect(camelToSnake(snakeToCamel(input))).toEqual(input);
	});
});
