export type Provider =
	| 'stripe'
	| 'paypal'
	| 'paddle'
	| 'lemonsqueezy'
	| 'polar'
	| 'creem'
	| 'dodo'
	| 'gumroad'
	| 'wise';
export type Status = 'yes' | 'limited' | 'no';
export interface CountryRecord {
	country: string;
	iso2: string;
	currency: string;
	providers: Record<Provider, { status: Status; note: string }>;
	agentaos: string;
	guide: string | null;
	checked: string;
}
export interface Result {
	country: string;
	iso2: string;
	stripe: Status;
	stripeNote: string;
	paysOut: Provider[];
	limited: Provider[];
	providers: CountryRecord['providers'];
	guide: string | null;
	checked: string;
}
export declare const PROVIDERS: Provider[];
export declare function findCountry(query: string): CountryRecord | null;
export declare function isStripeAvailable(query: string): Result | null;
export declare function countriesWithoutStripe(): string[];
export declare const data: {
	name: string;
	source: string;
	license: string;
	checked: string;
	countries: CountryRecord[];
};
