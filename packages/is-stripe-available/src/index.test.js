import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countriesWithoutStripe, findCountry, isStripeAvailable } from './index.js';

test('finds a country by name or ISO code, case-insensitively', () => {
	assert.equal(findCountry('north macedonia')?.iso2, 'MK');
	assert.equal(findCountry('mk')?.country, 'North Macedonia');
	assert.equal(findCountry('Atlantis'), null);
});

test('reports Stripe status and who pays out', () => {
	const mk = isStripeAvailable('MK');
	assert.equal(mk.stripe, 'no');
	assert.ok(mk.paysOut.length > 0);
	assert.ok(!mk.paysOut.includes('stripe'));
	assert.equal(isStripeAvailable('Atlantis'), null);
});

test('lists the countries without Stripe', () => {
	const list = countriesWithoutStripe();
	assert.ok(list.includes('Serbia'));
	assert.ok(!list.includes('India')); // Stripe preview: limited, not absent
	assert.equal(isStripeAvailable('IN').stripe, 'limited');
	assert.ok(!list.includes(findCountry('DE')?.country ?? 'Germany'));
});
