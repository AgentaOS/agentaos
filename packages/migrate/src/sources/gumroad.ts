import { fromMinor } from '../billing.js';
import { getJson } from '../http.js';
import type {
	BillingInterval,
	Catalog,
	SourceDiscount,
	SourcePlan,
	SourceSubscriber,
} from '../types.js';

const BASE_URL = 'https://api.gumroad.com/v2';
const RECURRENCE_TO_INTERVAL: Record<string, BillingInterval> = {
	monthly: 'month',
	yearly: 'year',
};
const LIVE_SUBSCRIBER_STATUSES = new Set(['alive', 'pending_cancellation', 'pending_failure']);

export interface GumroadTierOption {
	id?: string;
	name: string;
	price_difference?: number;
	recurrence_prices?: Record<string, { price_cents: number }> | null;
}

export interface GumroadProduct {
	id: string;
	name: string;
	description?: string | null;
	price: number;
	currency: string;
	short_url?: string | null;
	thumbnail_url?: string | null;
	published: boolean;
	is_tiered_membership?: boolean;
	recurrences?: string[] | null;
	variants?: { title: string; options: GumroadTierOption[] }[];
}

export interface GumroadOfferCode {
	id: string;
	name: string;
	amount_cents?: number | null;
	percent_off?: number | null;
	max_purchase_count?: number | null;
	universal?: boolean;
}

export interface GumroadSubscriber {
	user_email: string;
	status: string;
	recurrence?: string | null;
}

export async function readGumroad(accessToken: string): Promise<Catalog> {
	const auth = `access_token=${encodeURIComponent(accessToken)}`;
	const { products } = await getJson<{ products: GumroadProduct[] }>(
		`${BASE_URL}/products?${auth}`,
		{},
	);
	const live = products.filter((p) => p.published);
	const catalog = mapGumroadProducts(live);

	const seenUniversal = new Set<string>();
	for (const product of live) {
		const { offer_codes } = await getJson<{ offer_codes: GumroadOfferCode[] }>(
			`${BASE_URL}/products/${product.id}/offer_codes?${auth}`,
			{},
		);
		for (const code of offer_codes) {
			if (code.universal && seenUniversal.has(code.name)) continue;
			if (code.universal) seenUniversal.add(code.name);
			catalog.discounts.push(mapGumroadOfferCode(code, product, catalog.plans));
		}

		if (!isSubscriptionProduct(product)) continue;
		const subscribers = await readSubscribers(product.id, auth);
		catalog.subscribers.push(...mapGumroadSubscribers(subscribers, product, catalog.plans));
	}
	return catalog;
}

export function mapGumroadProducts(products: GumroadProduct[]): Catalog {
	const catalog: Catalog = {
		source: 'gumroad',
		plans: [],
		discounts: [],
		subscribers: [],
		skipped: [],
	};
	for (const p of products) {
		const base = {
			description: p.description ?? undefined,
			currency: p.currency.toUpperCase(),
			imageUrl: p.thumbnail_url ?? undefined,
			oldUrl: p.short_url ?? undefined,
		};
		if (!p.is_tiered_membership) {
			if (p.recurrences?.length) {
				catalog.skipped.push({
					kind: 'plan',
					sourceId: p.id,
					name: p.name,
					reason: 'legacy subscription product; recreate it as a monthly or yearly plan',
				});
				continue;
			}
			catalog.plans.push({
				...base,
				sourceId: p.id,
				name: p.name,
				amount: fromMinor(p.price),
				type: 'one_time',
			});
			continue;
		}

		const tiers = p.variants?.[0]?.options ?? [];
		for (const tier of tiers) {
			for (const [recurrence, price] of Object.entries(tier.recurrence_prices ?? {})) {
				const tierName =
					tiers.length > 1
						? `${p.name} (${tier.name}, ${recurrence})`
						: `${p.name} (${recurrence})`;
				const interval = RECURRENCE_TO_INTERVAL[recurrence];
				const sourceId = `${p.id}:${tier.id ?? tier.name}:${recurrence}`;
				if (!interval) {
					catalog.skipped.push({
						kind: 'plan',
						sourceId,
						name: tierName,
						reason: `billed ${recurrence}; AgentaOS plans are monthly or yearly`,
					});
					continue;
				}
				catalog.plans.push({
					...base,
					sourceId,
					name: tierName,
					amount: fromMinor(price.price_cents),
					type: 'subscription',
					interval,
				});
			}
		}
	}
	return catalog;
}

export function mapGumroadOfferCode(
	code: GumroadOfferCode,
	product: GumroadProduct,
	plans: SourcePlan[],
): SourceDiscount {
	return {
		sourceId: code.id,
		code: code.name,
		percentOff: code.percent_off ?? undefined,
		amountOffMinor: code.percent_off ? undefined : (code.amount_cents ?? undefined),
		currency: code.percent_off ? undefined : product.currency.toUpperCase(),
		maxRedemptions: code.max_purchase_count ?? undefined,
		planSourceIds: code.universal ? [] : plansOf(product, plans).map((p) => p.sourceId),
	};
}

/**
 * Gumroad tells us the subscriber's cadence but not their tier. When the
 * product has one tier at that cadence the plan is certain; otherwise the
 * seller picks it from the report.
 */
export function mapGumroadSubscribers(
	subscribers: GumroadSubscriber[],
	product: GumroadProduct,
	plans: SourcePlan[],
): SourceSubscriber[] {
	return subscribers
		.filter((s) => LIVE_SUBSCRIBER_STATUSES.has(s.status))
		.map((s) => {
			const interval = RECURRENCE_TO_INTERVAL[s.recurrence ?? ''];
			const candidates = plansOf(product, plans).filter((p) => p.interval === interval);
			return {
				email: s.user_email,
				planSourceId: candidates.length === 1 ? (candidates[0]?.sourceId ?? '') : '',
				note:
					candidates.length === 1
						? undefined
						: `Gumroad does not say which tier of "${product.name}" they are on; pick it before you email them`,
			};
		});
}

function plansOf(product: GumroadProduct, plans: SourcePlan[]): SourcePlan[] {
	return plans.filter((p) => p.sourceId === product.id || p.sourceId.startsWith(`${product.id}:`));
}

function isSubscriptionProduct(product: GumroadProduct): boolean {
	return Boolean(product.is_tiered_membership || product.recurrences?.length);
}

async function readSubscribers(productId: string, auth: string): Promise<GumroadSubscriber[]> {
	const subscribers: GumroadSubscriber[] = [];
	let pageKey: string | undefined;
	do {
		const page = pageKey ? `&page_key=${encodeURIComponent(pageKey)}` : '';
		const res = await getJson<{ subscribers: GumroadSubscriber[]; next_page_key?: string }>(
			`${BASE_URL}/products/${productId}/subscribers?${auth}&paginated=true${page}`,
			{},
		);
		subscribers.push(...res.subscribers);
		pageKey = res.next_page_key;
	} while (pageKey);
	return subscribers;
}
