import { fromMinor, toBillingInterval, trialToDays } from '../billing.js';
import { getJson } from '../http.js';
import type { Catalog, SourceDiscount, SourcePlan, SourceSubscriber } from '../types.js';

const BASE_URL = 'https://api.lemonsqueezy.com/v1';
const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'on_trial', 'past_due']);

interface Resource<A> {
	id: string;
	attributes: A;
	relationships?: Record<string, { data?: { id: string }[] | { id: string } | null }>;
}

interface Page<A> {
	data: Resource<A>[];
	meta?: { page?: { lastPage?: number } };
}

export interface LsStore {
	currency: string;
}

export interface LsProduct {
	store_id: number;
	name: string;
	description: string | null;
	status: string;
	buy_now_url: string | null;
	large_thumb_url: string | null;
}

export interface LsVariant {
	product_id: number;
	name: string;
	description: string | null;
	price: number;
	is_subscription: boolean;
	interval: string | null;
	interval_count: number | null;
	has_free_trial: boolean;
	trial_interval: string | null;
	trial_interval_count: number | null;
	status: string;
}

export interface LsDiscount {
	name: string;
	code: string;
	amount: number;
	amount_type: 'percent' | 'fixed';
	is_limited_to_products: boolean;
	is_limited_redemptions: boolean;
	max_redemptions: number;
	expires_at: string | null;
	status: string;
}

export interface LsSubscription {
	variant_id: number;
	user_name: string | null;
	user_email: string;
	status: string;
	renews_at: string | null;
}

export async function readLemonSqueezy(apiKey: string): Promise<Catalog> {
	const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' };
	const [stores, products, variants, discounts, subscriptions] = await Promise.all([
		readAll<LsStore>('/stores', headers),
		readAll<LsProduct>('/products', headers),
		readAll<LsVariant>('/variants', headers),
		readAll<LsDiscount>('/discounts?include=variants', headers),
		readAll<LsSubscription>('/subscriptions', headers),
	]);

	const catalog = mapLemonSqueezyPlans(stores, products, variants);
	catalog.discounts = discounts.flatMap(mapLemonSqueezyDiscount);
	catalog.subscribers = subscriptions.flatMap(mapLemonSqueezySubscription);
	return catalog;
}

export function mapLemonSqueezyPlans(
	stores: Resource<LsStore>[],
	products: Resource<LsProduct>[],
	variants: Resource<LsVariant>[],
): Catalog {
	const currencyByStore = new Map(stores.map((s) => [Number(s.id), s.attributes.currency]));
	const productById = new Map(products.map((p) => [Number(p.id), p]));
	const catalog: Catalog = {
		source: 'lemonsqueezy',
		plans: [],
		discounts: [],
		subscribers: [],
		skipped: [],
	};
	const variantCount = countBy(variants.map((v) => v.attributes.product_id));

	for (const variant of variants) {
		const v = variant.attributes;
		const product = productById.get(v.product_id);
		if (!product || product.attributes.status !== 'published' || v.status === 'draft') continue;

		const name =
			(variantCount.get(v.product_id) ?? 0) > 1
				? `${product.attributes.name} (${v.name})`
				: product.attributes.name;
		const base: SourcePlan = {
			sourceId: variant.id,
			name,
			description: stripHtml(v.description ?? product.attributes.description),
			amount: fromMinor(v.price),
			currency: (currencyByStore.get(product.attributes.store_id) ?? 'USD').toUpperCase(),
			type: 'one_time',
			imageUrl: product.attributes.large_thumb_url ?? undefined,
			oldUrl: product.attributes.buy_now_url ?? undefined,
		};

		if (!v.is_subscription) {
			catalog.plans.push(base);
			continue;
		}
		const cadence = toBillingInterval(v.interval ?? '', v.interval_count ?? 1);
		if ('reason' in cadence) {
			catalog.skipped.push({ kind: 'plan', sourceId: variant.id, name, reason: cadence.reason });
			continue;
		}
		catalog.plans.push({
			...base,
			type: 'subscription',
			interval: cadence.interval,
			trialDays: v.has_free_trial
				? trialToDays(v.trial_interval ?? '', v.trial_interval_count ?? 0)
				: undefined,
		});
	}
	return catalog;
}

export function mapLemonSqueezyDiscount(discount: Resource<LsDiscount>): SourceDiscount[] {
	const d = discount.attributes;
	if (d.status !== 'published') return [];
	const limitedTo = discount.relationships?.variants?.data;
	return [
		{
			sourceId: discount.id,
			code: d.code,
			name: d.name,
			percentOff: d.amount_type === 'percent' ? d.amount : undefined,
			amountOffMinor: d.amount_type === 'fixed' ? d.amount : undefined,
			maxRedemptions: d.is_limited_redemptions ? d.max_redemptions : undefined,
			expiresAt: d.expires_at ?? undefined,
			planSourceIds:
				d.is_limited_to_products && Array.isArray(limitedTo) ? limitedTo.map((r) => r.id) : [],
		},
	];
}

export function mapLemonSqueezySubscription(
	subscription: Resource<LsSubscription>,
): SourceSubscriber[] {
	const s = subscription.attributes;
	if (!LIVE_SUBSCRIPTION_STATUSES.has(s.status)) return [];
	return [
		{
			email: s.user_email,
			name: s.user_name ?? undefined,
			planSourceId: String(s.variant_id),
			renewsAt: s.renews_at ?? undefined,
		},
	];
}

async function readAll<A>(path: string, headers: Record<string, string>): Promise<Resource<A>[]> {
	const items: Resource<A>[] = [];
	const separator = path.includes('?') ? '&' : '?';
	for (let page = 1; ; page++) {
		const res = await getJson<Page<A>>(
			`${BASE_URL}${path}${separator}page[number]=${page}&page[size]=100`,
			headers,
		);
		items.push(...res.data);
		if (page >= (res.meta?.page?.lastPage ?? 1)) return items;
	}
}

function countBy(values: number[]): Map<number, number> {
	const counts = new Map<number, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return counts;
}

function stripHtml(html: string | null | undefined): string | undefined {
	const text = html
		?.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text || undefined;
}
