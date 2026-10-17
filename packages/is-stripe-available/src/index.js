import data from './data.json' with { type: 'json' };

export const PROVIDERS = [
	'stripe',
	'paypal',
	'paddle',
	'lemonsqueezy',
	'polar',
	'creem',
	'dodo',
	'gumroad',
	'wise',
];

const normalize = (s) =>
	String(s)
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, ' ');

/** Find a country by name ("North Macedonia") or ISO 3166-1 alpha-2 code ("MK"). */
export function findCountry(query) {
	const q = normalize(query);
	return (
		data.countries.find((c) => c.iso2.toLowerCase() === q || normalize(c.country) === q) ?? null
	);
}

/**
 * Stripe's status for a country, and every provider that pays out there.
 * Returns null when the country is not in the dataset.
 */
export function isStripeAvailable(query) {
	const country = findCountry(query);
	if (!country) return null;
	const byStatus = (status) =>
		PROVIDERS.filter((p) => p !== 'stripe' && country.providers[p].status === status);
	return {
		country: country.country,
		iso2: country.iso2,
		/** 'yes', 'limited' (Stripe preview or extended network only) or 'no'. */
		stripe: country.providers.stripe.status,
		stripeNote: country.providers.stripe.note,
		paysOut: byStatus('yes'),
		limited: byStatus('limited'),
		providers: country.providers,
		guide: country.guide,
		checked: country.checked,
	};
}

/** Every country in the dataset where Stripe is not available at all. */
export function countriesWithoutStripe() {
	return data.countries.filter((c) => c.providers.stripe.status === 'no').map((c) => c.country);
}

export { data };
