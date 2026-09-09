/**
 * Today's flag spellings, verbatim from agentaos@3.0.0, keyed by input key.
 * The renderer generates `--kebab-case <value>` for anything not listed, so
 * this map is only what a published CLI already promised. `help` overrides
 * the operation's description when the flag reads differently from the key
 * (`--no-download`); `default` is what commander prints, not what applies.
 */
export interface FlagSpec {
	flags: string;
	help?: string;
	default?: string;
}

const BY_KEY: Record<string, FlagSpec> = {
	name: { flags: '-n, --name <name>' },
	amount: { flags: '-a, --amount <amount>' },
	currency: { flags: '-c, --currency <currency>' },
	description: { flags: '-d, --description <desc>' },
	output: { flags: '-o, --output <path>' },
	email: { flags: '--email <email>' },
	interval: { flags: '--interval <interval>' },
	trialDays: { flags: '--trial-days <days>' },
	successUrl: { flags: '--success-url <url>' },
	cancelUrl: { flags: '--cancel-url <url>' },
	limit: { flags: '--limit <n>', default: '10' },
	status: { flags: '--status <status>' },
	to: { flags: '--to <linkId>' },
	url: { flags: '--url <url>' },
	entity: { flags: '--entity <type>' },
	legalName: { flags: '--legal-name <name>' },
	registrationNumber: { flags: '--registration-number <number>' },
	displayName: { flags: '--display-name <name>' },
	country: { flags: '--country <code>' },
	street: { flags: '--street <street>' },
	city: { flags: '--city <city>' },
	postal: { flags: '--postal <code>' },
	addressCountry: { flags: '--address-country <code>' },
	category: { flags: '--category <value>' },
	delivery: { flags: '--delivery <value>' },
	volume: { flags: '--volume <band>' },
};

/** Where 3.0.0 spelled a flag differently on one command. */
const BY_OPERATION: Record<string, Record<string, FlagSpec>> = {
	'audit.request': { description: { flags: '--description <text>' } },
	'verify.submit': { description: { flags: '--description <text>' } },
	'audit.show': {
		download: { flags: '--no-download', help: 'Return the link without saving the PDF' },
	},
};

export function flagSpec(operationName: string, key: string): FlagSpec | undefined {
	return BY_OPERATION[operationName]?.[key] ?? BY_KEY[key];
}
