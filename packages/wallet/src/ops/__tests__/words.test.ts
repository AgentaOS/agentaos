import { describe, expect, it } from 'vitest';
import { money } from '../words.js';

describe('money', () => {
	it('reads a settlement token as the money it stands for', () => {
		expect(money(7, 'EURC')).toBe('€7.00');
		expect(money(0.99, 'USDC')).toBe('$0.99');
	});

	it('formats plain currencies', () => {
		expect(money(29, 'eur')).toBe('€29.00');
	});
});
