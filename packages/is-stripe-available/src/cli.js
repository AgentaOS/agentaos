#!/usr/bin/env node
import { countriesWithoutStripe, data, isStripeAvailable } from './index.js';

const NAMES = {
	paypal: 'PayPal',
	paddle: 'Paddle',
	lemonsqueezy: 'Lemon Squeezy',
	polar: 'Polar',
	creem: 'Creem',
	dodo: 'Dodo Payments',
	gumroad: 'Gumroad',
	wise: 'Wise',
};
const query = process.argv.slice(2).join(' ').trim();

if (!query || query === '--help' || query === '-h') {
	console.log('Usage: npx is-stripe-available <country name or ISO code>');
	console.log('       npx is-stripe-available --list   (countries without Stripe)');
	process.exit(query ? 0 : 1);
}

if (query === '--list') {
	const list = countriesWithoutStripe();
	console.log(
		`Stripe is not available in ${list.length} of ${data.countries.length} countries checked:\n${list.join(', ')}`,
	);
	process.exit(0);
}

const result = isStripeAvailable(query);
if (!result) {
	console.log(
		`"${query}" is not in the dataset (${data.countries.length} countries). Try a full name or a 2-letter code, or run --list.`,
	);
	process.exit(1);
}

const STRIPE = { yes: 'available', limited: `limited (${result.stripeNote})`, no: 'NOT available' };
console.log(`${result.country}: Stripe is ${STRIPE[result.stripe]}.`);
if (result.paysOut.length)
	console.log(`Pays out there: ${result.paysOut.map((p) => NAMES[p]).join(', ')}`);
if (result.limited.length)
	console.log(
		`Limited (e.g. PayPal payouts only): ${result.limited.map((p) => NAMES[p]).join(', ')}`,
	);
if (result.guide) console.log(`Guide: ${result.guide}?src=npm-isa`);
console.log(`Checked ${result.checked} against each provider's own list. Data: ${data.source}`);
