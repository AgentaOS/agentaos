/** Where the seller is moving from. */
export type SourceName = 'paddle' | 'lemonsqueezy' | 'creem' | 'gumroad';

export const SOURCE_NAMES: readonly SourceName[] = ['paddle', 'lemonsqueezy', 'creem', 'gumroad'];

/** The currencies an AgentaOS product can be priced in. */
export type AgentaCurrency = 'EUR' | 'USD';

export type BillingInterval = 'month' | 'year';

/**
 * One sellable thing in the old account, already in AgentaOS terms:
 * a one-time product, or a subscription plan billed monthly or yearly.
 */
export interface SourcePlan {
	/** The id the old provider uses (price, variant, product or tier). */
	sourceId: string;
	name: string;
	description?: string;
	/** Price in major units: 19 means 19.00. */
	amount: number;
	/** Upper-case ISO code as the old provider reported it. */
	currency: string;
	type: 'one_time' | 'subscription';
	interval?: BillingInterval;
	trialDays?: number;
	/** What the whole trial costs, in major units. Absent means free. */
	trialAmount?: number;
	imageUrl?: string;
	/** The old buy link, when the provider has one. Used for the redirect list. */
	oldUrl?: string;
}

export interface SourceDiscount {
	sourceId: string;
	code: string;
	name?: string;
	percentOff?: number;
	/** Fixed amount off, in minor units (cents). */
	amountOffMinor?: number;
	/** Currency of a fixed amount off, when the provider says. */
	currency?: string;
	maxRedemptions?: number;
	/** ISO 8601 */
	expiresAt?: string;
	/** Source plan ids the code is limited to. Empty means every plan. */
	planSourceIds: string[];
}

/** A paying subscriber. Card details never leave the old provider. */
export interface SourceSubscriber {
	email: string;
	name?: string;
	country?: string;
	planSourceId: string;
	/** ISO 8601: when the old provider next charges them. */
	renewsAt?: string;
	/** Something the seller must check for this subscriber. */
	note?: string;
}

/** Something the agent read but cannot move as-is, with the reason. */
export interface Skipped {
	kind: 'plan' | 'discount' | 'subscriber';
	sourceId: string;
	name: string;
	reason: string;
}

/** Everything read from the old account, normalised. */
export interface Catalog {
	source: SourceName;
	plans: SourcePlan[];
	discounts: SourceDiscount[];
	subscribers: SourceSubscriber[];
	skipped: Skipped[];
}
