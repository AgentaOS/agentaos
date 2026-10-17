import { fromMinor, toBillingInterval, trialToDays } from '../billing.js';
import { getJson } from '../http.js';
import type { Catalog, SourceDiscount, SourceSubscriber } from '../types.js';

const LIVE_URL = 'https://api.paddle.com';
const SANDBOX_URL = 'https://sandbox-api.paddle.com';

interface Page<T> {
	data: T[];
	meta?: { pagination?: { next?: string | null; has_more?: boolean } };
}

interface Cycle {
	interval: string;
	frequency: number;
}

export interface PaddlePrice {
	id: string;
	product_id: string;
	name: string | null;
	description: string;
	unit_price: { amount: string; currency_code: string };
	billing_cycle: Cycle | null;
	trial_period: Cycle | null;
	product?: { name: string; description: string | null; image_url: string | null };
}

export interface PaddleDiscount {
	id: string;
	code: string | null;
	description: string;
	type: 'percentage' | 'flat' | 'flat_per_seat';
	amount: string;
	currency_code?: string | null;
	usage_limit: number | null;
	expires_at: string | null;
	restrict_to: string[] | null;
}

export interface PaddleSubscription {
	customer_id: string;
	next_billed_at: string | null;
	items: { price: { id: string } }[];
}

export interface PaddleCustomer {
	id: string;
	email: string;
	name: string | null;
}

export async function readPaddle(apiKey: string, sandbox = false): Promise<Catalog> {
	const base = sandbox ? SANDBOX_URL : LIVE_URL;
	const headers = { Authorization: `Bearer ${apiKey}` };
	const [prices, discounts, subscriptions, customers] = await Promise.all([
		readAll<PaddlePrice>(`${base}/prices?status=active&include=product&per_page=200`, headers),
		readAll<PaddleDiscount>(`${base}/discounts?status=active&per_page=200`, headers),
		readAll<PaddleSubscription>(
			`${base}/subscriptions?status=active,trialing,past_due&per_page=200`,
			headers,
		),
		readAll<PaddleCustomer>(`${base}/customers?status=active&per_page=200`, headers),
	]);

	const catalog = mapPaddlePrices(prices);
	catalog.discounts = discounts.flatMap((d) => mapPaddleDiscount(d, prices));
	catalog.subscribers = mapPaddleSubscriptions(subscriptions, customers);
	for (const d of discounts.filter((d) => !d.code)) {
		catalog.skipped.push({
			kind: 'discount',
			sourceId: d.id,
			name: d.description,
			reason: 'has no code buyers can type; it was applied from your code, so recreate it there',
		});
	}
	return catalog;
}

export function mapPaddlePrices(prices: PaddlePrice[]): Catalog {
	const catalog: Catalog = {
		source: 'paddle',
		plans: [],
		discounts: [],
		subscribers: [],
		skipped: [],
	};
	const pricesPerProduct = new Map<string, number>();
	for (const p of prices) {
		pricesPerProduct.set(p.product_id, (pricesPerProduct.get(p.product_id) ?? 0) + 1);
	}

	for (const price of prices) {
		const productName = price.product?.name ?? price.description;
		const name =
			(pricesPerProduct.get(price.product_id) ?? 0) > 1 && price.name
				? `${productName} (${price.name})`
				: productName;
		const base = {
			sourceId: price.id,
			name,
			description: price.product?.description ?? undefined,
			amount: fromMinor(price.unit_price.amount),
			currency: price.unit_price.currency_code.toUpperCase(),
			imageUrl: price.product?.image_url ?? undefined,
		};

		if (!price.billing_cycle) {
			catalog.plans.push({ ...base, type: 'one_time' });
			continue;
		}
		const cadence = toBillingInterval(price.billing_cycle.interval, price.billing_cycle.frequency);
		if ('reason' in cadence) {
			catalog.skipped.push({ kind: 'plan', sourceId: price.id, name, reason: cadence.reason });
			continue;
		}
		catalog.plans.push({
			...base,
			type: 'subscription',
			interval: cadence.interval,
			trialDays: price.trial_period
				? trialToDays(price.trial_period.interval, price.trial_period.frequency)
				: undefined,
		});
	}
	return catalog;
}

/** Paddle can limit a discount to products or prices; AgentaOS plans map to prices. */
export function mapPaddleDiscount(
	discount: PaddleDiscount,
	prices: PaddlePrice[],
): SourceDiscount[] {
	if (!discount.code) return [];
	const planSourceIds = (discount.restrict_to ?? []).flatMap((id) =>
		id.startsWith('pro_') ? prices.filter((p) => p.product_id === id).map((p) => p.id) : [id],
	);
	return [
		{
			sourceId: discount.id,
			code: discount.code,
			name: discount.description,
			percentOff: discount.type === 'percentage' ? Number(discount.amount) : undefined,
			amountOffMinor: discount.type === 'percentage' ? undefined : Number(discount.amount),
			currency:
				discount.type === 'percentage'
					? undefined
					: (discount.currency_code?.toUpperCase() ?? undefined),
			maxRedemptions: discount.usage_limit ?? undefined,
			expiresAt: discount.expires_at ?? undefined,
			planSourceIds,
		},
	];
}

export function mapPaddleSubscriptions(
	subscriptions: PaddleSubscription[],
	customers: PaddleCustomer[],
): SourceSubscriber[] {
	const customerById = new Map(customers.map((c) => [c.id, c]));
	return subscriptions.flatMap((s) => {
		const customer = customerById.get(s.customer_id);
		const priceId = s.items[0]?.price.id;
		if (!customer || !priceId) return [];
		return [
			{
				email: customer.email,
				name: customer.name ?? undefined,
				planSourceId: priceId,
				renewsAt: s.next_billed_at ?? undefined,
			},
		];
	});
}

async function readAll<T>(firstUrl: string, headers: Record<string, string>): Promise<T[]> {
	const items: T[] = [];
	let url: string | null | undefined = firstUrl;
	while (url) {
		const page: Page<T> = await getJson<Page<T>>(url, headers);
		items.push(...page.data);
		url = page.meta?.pagination?.has_more ? page.meta.pagination.next : null;
	}
	return items;
}
