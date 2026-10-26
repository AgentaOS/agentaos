import { AgentaOS, type WebhookEvent, WebhooksResource } from '@agentaos/pay';

/** Who is buying, read on your server (for example from your session). */
export interface CheckoutCustomer {
	email?: string;
	name?: string;
	/**
	 * Comes back on the first `checkout.session.completed`, e.g. `{ userId }`. The SDK
	 * delivers every key in camelCase, so `user_id` arrives as `userId`; use camelCase keys.
	 */
	metadata?: Record<string, unknown>;
}

export interface CheckoutOptions {
	/** Your products by slug: `{ pro: '<link id>' }`. Only these can be bought through the route. */
	products: Record<string, string>;
	/** Where the buyer lands after paying. AgentaOS appends `?sessionId=...`. */
	successUrl: string;
	/** Where the buyer lands if they leave the checkout. Defaults to `successUrl`. */
	cancelUrl?: string;
	/** A server-side client, when you need a business, a base URL or timeouts. */
	client?: AgentaOS;
	/** Used when no `client` is given. Defaults to `process.env.AGENTAOS_API_KEY`. */
	apiKey?: string;
	/** Fills in the buyer and the metadata on the server. Never trust these from the query string. */
	customer?: (request: Request) => Promise<CheckoutCustomer | null> | CheckoutCustomer | null;
}

/**
 * A `GET` route handler that starts a checkout and redirects the buyer to it.
 *
 * ```ts
 * // app/checkout/route.ts
 * export const GET = Checkout({ products: { pro: '<link id>' }, successUrl: 'https://example.com/thanks' });
 * ```
 * Link to `/checkout?product=pro` with a plain `<a>`, or `<Link prefetch={false}>`.
 */
export function Checkout(options: CheckoutOptions) {
	let client = options.client;
	return async (request: Request): Promise<Response> => {
		// HEAD requests and router prefetches would otherwise open a checkout nobody asked for.
		if (request.method === 'HEAD' || isPrefetch(request)) {
			return new Response(null, { status: 204 });
		}
		const slug = new URL(request.url).searchParams.get('product') ?? '';
		const linkId = Object.hasOwn(options.products, slug) ? options.products[slug] : undefined;
		if (!linkId) {
			return Response.json({ error: `Unknown product: ${slug}` }, { status: 400 });
		}
		client ??= new AgentaOS(apiKeyFrom(options.apiKey));
		const customer = (await options.customer?.(request)) ?? {};
		const checkout = await client.checkouts.create({
			linkId,
			buyerEmail: customer.email || undefined,
			buyerName: customer.name || undefined,
			metadata: { ...customer.metadata, product: slug },
			successUrl: options.successUrl,
			cancelUrl: options.cancelUrl ?? options.successUrl,
		});
		return Response.redirect(checkout.checkoutUrl, 303);
	};
}

type EventOf<T extends WebhookEvent['type']> = Extract<WebhookEvent, { type: T }>;
type Handler<T extends WebhookEvent['type']> = (event: EventOf<T>) => Promise<void> | void;

export interface WebhooksOptions {
	/** Signing secret from Settings → Developers → Webhooks (`whsec_...`). Required. */
	webhookSecret: string;
	onCheckoutCompleted?: Handler<'checkout.session.completed'>;
	onSubscriptionCreated?: Handler<'subscription.created'>;
	onSubscriptionRenewed?: Handler<'subscription.renewed'>;
	onSubscriptionUpdated?: Handler<'subscription.updated'>;
	onSubscriptionPaymentFailed?: Handler<'subscription.payment_failed'>;
	onSubscriptionCanceled?: Handler<'subscription.canceled'>;
	onDisputeCreated?: Handler<'dispute.created'>;
	onDisputeClosed?: Handler<'dispute.closed'>;
	/**
	 * Every verified event, after the matching handler. If a handler throws, the
	 * delivery answers 500 and AgentaOS retries it; `onEvent` is not called for that attempt.
	 */
	onEvent?: (event: WebhookEvent) => Promise<void> | void;
}

type HandlerName = Exclude<keyof WebhooksOptions, 'webhookSecret' | 'onEvent'>;

const HANDLER_FOR: { [T in WebhookEvent['type']]?: HandlerName } = {
	'checkout.session.completed': 'onCheckoutCompleted',
	'subscription.created': 'onSubscriptionCreated',
	'subscription.renewed': 'onSubscriptionRenewed',
	'subscription.updated': 'onSubscriptionUpdated',
	'subscription.payment_failed': 'onSubscriptionPaymentFailed',
	'subscription.canceled': 'onSubscriptionCanceled',
	'dispute.created': 'onDisputeCreated',
	'dispute.closed': 'onDisputeClosed',
};

/**
 * A `POST` route handler that verifies AgentaOS webhooks and calls your handlers.
 *
 * ```ts
 * // app/api/webhooks/agentaos/route.ts
 * export const POST = Webhooks({ webhookSecret: process.env.AGENTAOS_WEBHOOK_SECRET!, onCheckoutCompleted });
 * ```
 */
export function Webhooks(options: WebhooksOptions) {
	// A blank secret would accept events anyone can sign, so refuse to start without one.
	if (typeof options.webhookSecret !== 'string' || options.webhookSecret.trim() === '') {
		throw new Error('Webhooks() needs webhookSecret: set AGENTAOS_WEBHOOK_SECRET.');
	}
	const webhooks = new WebhooksResource();
	return async (request: Request): Promise<Response> => {
		// AgentaOS signs the raw body, so read it as text before anything parses it.
		const body = await request.text();
		let event: WebhookEvent;
		try {
			event = webhooks.verify(
				body,
				request.headers.get('x-agentaos-signature') ?? '',
				options.webhookSecret,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Invalid webhook signature';
			return Response.json({ error: message }, { status: 400 });
		}
		const name = HANDLER_FOR[event.type];
		const handler = name
			? (options[name] as ((event: WebhookEvent) => unknown) | undefined)
			: undefined;
		await handler?.call(options, event);
		await options.onEvent?.(event);
		return Response.json({ received: true });
	};
}

function isPrefetch(request: Request): boolean {
	const { headers } = request;
	return (
		headers.has('next-router-prefetch') ||
		headers.get('purpose') === 'prefetch' ||
		headers.get('sec-purpose')?.includes('prefetch') === true
	);
}

function apiKeyFrom(apiKey: string | undefined): string {
	const key = apiKey ?? process.env.AGENTAOS_API_KEY;
	if (!key) {
		throw new Error('Set AGENTAOS_API_KEY, or pass apiKey or client to Checkout().');
	}
	return key;
}

export type { WebhookEvent } from '@agentaos/pay';
