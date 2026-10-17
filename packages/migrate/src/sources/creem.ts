import { fromMinor, toBillingInterval } from '../billing.js';
import { getJson } from '../http.js';
import type { Catalog, SourceDiscount, SourceSubscriber } from '../types.js';

const LIVE_URL = 'https://api.creem.io';
const TEST_URL = 'https://test-api.creem.io';
const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

interface Page<T> {
	items: T[];
	pagination?: { next_page?: number | null };
}

export interface CreemProduct {
	id: string;
	name: string;
	description: string | null;
	price: number;
	currency: string;
	billing_type: 'recurring' | 'onetime';
	billing_period: string;
	recurring_interval?: string | null;
	recurring_interval_count?: number | null;
	trial_period_days?: number | null;
	trial_price?: number | null;
	status: string;
	image_url?: string | null;
	product_url?: string | null;
}

export interface CreemDiscount {
	id: string;
	status: string;
	name: string;
	code: string;
	type: 'percentage' | 'fixed';
	amount?: number | null;
	percentage?: number | null;
	expiry_date?: string | null;
	max_redemptions?: number | null;
	applies_to_products?: string[] | null;
}

export interface CreemCustomer {
	id: string;
	email: string;
	name?: string | null;
	country?: string | null;
}

export interface CreemSubscription {
	product: string | { id: string };
	customer: string | CreemCustomer;
	status: string;
	current_period_end_date?: string | null;
}

export async function readCreem(apiKey: string, test = false): Promise<Catalog> {
	const base = test ? TEST_URL : LIVE_URL;
	const headers = { 'x-api-key': apiKey };
	const [products, discounts, subscriptions, customers] = await Promise.all([
		readAll<CreemProduct>(`${base}/v1/products/search?status=active`, headers),
		readAll<CreemDiscount>(`${base}/v1/discounts/search?status=active`, headers),
		readAll<CreemSubscription>(`${base}/v1/subscriptions/search`, headers),
		readAll<CreemCustomer>(`${base}/v1/customers/list`, headers),
	]);

	const catalog = mapCreemProducts(products);
	catalog.discounts = discounts.flatMap(mapCreemDiscount);
	catalog.subscribers = mapCreemSubscriptions(subscriptions, customers);
	return catalog;
}

export function mapCreemProducts(products: CreemProduct[]): Catalog {
	const catalog: Catalog = {
		source: 'creem',
		plans: [],
		discounts: [],
		subscribers: [],
		skipped: [],
	};
	for (const p of products) {
		const base = {
			sourceId: p.id,
			name: p.name,
			description: p.description ?? undefined,
			amount: fromMinor(p.price),
			currency: p.currency.toUpperCase(),
			imageUrl: p.image_url ?? undefined,
			oldUrl: p.product_url ?? undefined,
		};
		if (p.billing_type === 'onetime') {
			catalog.plans.push({ ...base, type: 'one_time' });
			continue;
		}
		const cadence = p.recurring_interval
			? toBillingInterval(p.recurring_interval, p.recurring_interval_count ?? 1)
			: fromBillingPeriod(p.billing_period);
		if ('reason' in cadence) {
			catalog.skipped.push({ kind: 'plan', sourceId: p.id, name: p.name, reason: cadence.reason });
			continue;
		}
		catalog.plans.push({
			...base,
			type: 'subscription',
			interval: cadence.interval,
			trialDays: p.trial_period_days ?? undefined,
			trialAmount: p.trial_price ? fromMinor(p.trial_price) : undefined,
		});
	}
	return catalog;
}

export function mapCreemDiscount(d: CreemDiscount): SourceDiscount[] {
	if (d.status !== 'active') return [];
	return [
		{
			sourceId: d.id,
			code: d.code,
			name: d.name,
			percentOff: d.type === 'percentage' ? (d.percentage ?? undefined) : undefined,
			amountOffMinor: d.type === 'fixed' ? (d.amount ?? undefined) : undefined,
			maxRedemptions: d.max_redemptions ?? undefined,
			expiresAt: d.expiry_date ?? undefined,
			planSourceIds: d.applies_to_products ?? [],
		},
	];
}

export function mapCreemSubscriptions(
	subscriptions: CreemSubscription[],
	customers: CreemCustomer[],
): SourceSubscriber[] {
	const customerById = new Map(customers.map((c) => [c.id, c]));
	return subscriptions.flatMap((s) => {
		if (!LIVE_SUBSCRIPTION_STATUSES.has(s.status)) return [];
		const customer = typeof s.customer === 'string' ? customerById.get(s.customer) : s.customer;
		if (!customer) return [];
		return [
			{
				email: customer.email,
				name: customer.name ?? undefined,
				country: customer.country ?? undefined,
				planSourceId: typeof s.product === 'string' ? s.product : s.product.id,
				renewsAt: s.current_period_end_date ?? undefined,
			},
		];
	});
}

function fromBillingPeriod(period: string) {
	if (period === 'every-month') return toBillingInterval('month', 1);
	if (period === 'every-year') return toBillingInterval('year', 1);
	return { reason: `billing period "${period}"; AgentaOS plans are monthly or yearly` };
}

async function readAll<T>(url: string, headers: Record<string, string>): Promise<T[]> {
	const items: T[] = [];
	const separator = url.includes('?') ? '&' : '?';
	for (let page: number | null | undefined = 1; page; ) {
		const res: Page<T> = await getJson<Page<T>>(
			`${url}${separator}page_number=${page}&page_size=100`,
			headers,
		);
		items.push(...res.items);
		page = res.pagination?.next_page;
	}
	return items;
}
