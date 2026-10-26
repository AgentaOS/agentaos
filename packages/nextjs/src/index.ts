import { AgentaOS, type WebhookEvent, WebhooksResource } from '@agentaos/pay';

/** Who is buying, read on your server (for example from your session). */
export interface CheckoutCustomer {
	email?: string;
	name?: string;
	/** Comes back on the `checkout.session.completed` webhook, e.g. `{ userId }`. */
	metadata?: Record<string, unknown>;
}

export interface CheckoutOptions {
	/** Your products by slug: `{ pro: '<link id>' }`. Only these can be bought through the route. */
	products: Record<string, string>;
	/** Where the buyer lands after paying. AgentaOS appends `?sessionId=...`. */
	successUrl: string;
	/** Where the buyer lands if they leave the checkout. Defaults to `successUrl`. */
	cancelUrl?: string;
	/** Defaults to `process.env.AGENTAOS_API_KEY`. */
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
 * Link to `/checkout?product=pro`.
 */
export function Checkout(options: CheckoutOptions) {
	let client: AgentaOS | undefined;
	return async (request: Request): Promise<Response> => {
		const slug = new URL(request.url).searchParams.get('product') ?? '';
		const linkId = Object.hasOwn(options.products, slug) ? options.products[slug] : undefined;
		if (!linkId) {
			return Response.json({ error: `Unknown product: ${slug}` }, { status: 400 });
		}
		client ??= new AgentaOS(apiKeyFrom(options.apiKey));
		const customer = (await options.customer?.(request)) ?? {};
		const checkout = await client.checkouts.create({
			linkId,
			buyerEmail: customer.email,
			buyerName: customer.name,
			metadata: customer.metadata,
			successUrl: options.successUrl,
			cancelUrl: options.cancelUrl ?? options.successUrl,
		});
		return Response.redirect(checkout.checkoutUrl, 303);
	};
}

type EventOf<T extends WebhookEvent['type']> = Extract<WebhookEvent, { type: T }>;
type Handler<T extends WebhookEvent['type']> = (event: EventOf<T>) => Promise<void> | void;

export interface WebhooksOptions {
	/** Signing secret from Settings → Developers → Webhooks (`whsec_...`). */
	webhookSecret: string;
	onCheckoutCompleted?: Handler<'checkout.session.completed'>;
	onSubscriptionCreated?: Handler<'subscription.created'>;
	onSubscriptionRenewed?: Handler<'subscription.renewed'>;
	onSubscriptionUpdated?: Handler<'subscription.updated'>;
	onSubscriptionPaymentFailed?: Handler<'subscription.payment_failed'>;
	onSubscriptionCanceled?: Handler<'subscription.canceled'>;
	onDisputeCreated?: Handler<'dispute.created'>;
	onDisputeClosed?: Handler<'dispute.closed'>;
	/** Every verified event, after the matching handler. */
	onEvent?: (event: WebhookEvent) => Promise<void> | void;
}

type HandlerName = Exclude<keyof WebhooksOptions, 'webhookSecret' | 'onEvent'>;

const HANDLER_FOR: Partial<Record<WebhookEvent['type'], HandlerName>> = {
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
		await handler?.(event);
		await options.onEvent?.(event);
		return Response.json({ received: true });
	};
}

function apiKeyFrom(apiKey: string | undefined): string {
	const key = apiKey ?? process.env.AGENTAOS_API_KEY;
	if (!key) {
		throw new Error('Set AGENTAOS_API_KEY or pass apiKey to Checkout().');
	}
	return key;
}

export type { WebhookEvent } from '@agentaos/pay';
