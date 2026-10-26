import { type AgentaOS, AgentaOSError, type Subscription, type WebhookEvent } from '@agentaos/pay';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { z } from 'zod';

export interface AgentaOSProduct {
	/** A short name you use in your app, e.g. `pro`. */
	slug: string;
	/** The AgentaOS product's link id (product page, "Copy link ID"). */
	productId: string;
}

type EventOf<T extends WebhookEvent['type']> = Extract<WebhookEvent, { type: T }>;

/** What every webhook handler receives. */
export interface WebhookArgs<E extends WebhookEvent = WebhookEvent> {
	event: E;
	/**
	 * The Better Auth user who started the checkout. Set on the first
	 * `checkout.session.completed` of a checkout started through this plugin;
	 * null on renewal and upgrade charges (`checkout.session.completed` again)
	 * and on every other event.
	 */
	userId: string | null;
}

type Handler<T extends WebhookEvent['type']> = (
	args: WebhookArgs<EventOf<T>>,
) => Promise<void> | void;

/** One handler per event you care about. `onEvent` receives every event after it. */
export interface AgentaOSWebhookHandlers {
	onCheckoutCompleted?: Handler<'checkout.session.completed'>;
	onSubscriptionCreated?: Handler<'subscription.created'>;
	onSubscriptionRenewed?: Handler<'subscription.renewed'>;
	onSubscriptionUpdated?: Handler<'subscription.updated'>;
	onSubscriptionPaymentFailed?: Handler<'subscription.payment_failed'>;
	onSubscriptionCanceled?: Handler<'subscription.canceled'>;
	onDisputeCreated?: Handler<'dispute.created'>;
	onDisputeClosed?: Handler<'dispute.closed'>;
}

const HANDLER_FOR: { [T in WebhookEvent['type']]?: keyof AgentaOSWebhookHandlers } = {
	'checkout.session.completed': 'onCheckoutCompleted',
	'subscription.created': 'onSubscriptionCreated',
	'subscription.renewed': 'onSubscriptionRenewed',
	'subscription.updated': 'onSubscriptionUpdated',
	'subscription.payment_failed': 'onSubscriptionPaymentFailed',
	'subscription.canceled': 'onSubscriptionCanceled',
	'dispute.created': 'onDisputeCreated',
	'dispute.closed': 'onDisputeClosed',
};

export interface AgentaOSPluginOptions extends AgentaOSWebhookHandlers {
	/** A server-side AgentaOS client: `new AgentaOS(process.env.AGENTAOS_API_KEY)`. */
	client: AgentaOS;
	/** Products a signed-in user can buy, by slug. */
	products: AgentaOSProduct[];
	/** Where the buyer lands after paying. */
	successUrl: string;
	/** Where the buyer lands if they leave the checkout. Defaults to `successUrl`. */
	cancelUrl?: string;
	/** Signing secret from Settings → Developers → Webhooks (`whsec_...`). Enables the webhook endpoint. */
	webhookSecret?: string;
	/**
	 * Called for every verified webhook event, after the matching `on...` handler.
	 * If a handler throws, the delivery answers 500 and AgentaOS retries it; `onEvent`
	 * is not called for that attempt.
	 */
	onEvent?: (args: WebhookArgs) => Promise<void> | void;
}

const checkoutBody = z.object({ slug: z.string().min(1) });

const API_STATUS: Record<number, ConstructorParameters<typeof APIError>[0]> = {
	400: 'BAD_REQUEST',
	404: 'NOT_FOUND',
	409: 'CONFLICT',
	422: 'UNPROCESSABLE_ENTITY',
	429: 'TOO_MANY_REQUESTS',
};

/**
 * Runs an AgentaOS call and turns its errors into answers the client can show.
 * A request the buyer can fix keeps its message; anything else, such as a wrong
 * API key, stays a plain 500 so server details do not leak.
 */
async function callAgentaOS<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (error) {
		// Duck-typed: the app may build its client from its own copy of @agentaos/pay.
		const status = isAgentaOSError(error) ? API_STATUS[error.status] : undefined;
		if (status && error instanceof Error) {
			throw new APIError(status, { message: error.message });
		}
		throw error;
	}
}

function isAgentaOSError(error: unknown): error is AgentaOSError {
	return (
		error instanceof AgentaOSError ||
		(error instanceof Error &&
			typeof (error as { status?: unknown }).status === 'number' &&
			typeof (error as { code?: unknown }).code === 'string')
	);
}

/**
 * Connects AgentaOS to your Better Auth users.
 *
 * - `POST /agentaos/checkout` starts a checkout for the signed-in user and returns its URL.
 * - `GET /agentaos/subscriptions` lists the signed-in user's subscriptions.
 * - `POST /agentaos/webhook` verifies AgentaOS webhooks and calls your handlers.
 */
export const agentaos = (options: AgentaOSPluginOptions) => {
	const findProduct = (slug: string) => {
		const product = options.products.find((p) => p.slug === slug);
		if (!product) {
			throw new APIError('BAD_REQUEST', { message: `Unknown product: ${slug}` });
		}
		return product;
	};

	const handle = async (event: WebhookEvent, userId: string | null) => {
		const name = HANDLER_FOR[event.type];
		const handler = name
			? (options[name] as ((args: WebhookArgs) => unknown) | undefined)
			: undefined;
		await handler?.call(options, { event, userId });
		await options.onEvent?.({ event, userId });
	};

	return {
		id: 'agentaos',
		endpoints: {
			agentaosCheckout: createAuthEndpoint(
				'/agentaos/checkout',
				{ method: 'POST', body: checkoutBody, use: [sessionMiddleware] },
				async (ctx) => {
					const { user } = ctx.context.session;
					const product = findProduct(ctx.body.slug);
					const checkout = await callAgentaOS(() =>
						options.client.checkouts.create({
							linkId: product.productId,
							buyerEmail: user.email,
							buyerName: user.name || undefined,
							metadata: { userId: user.id, product: product.slug },
							successUrl: options.successUrl,
							cancelUrl: options.cancelUrl ?? options.successUrl,
						}),
					);
					return ctx.json({ url: checkout.checkoutUrl, sessionId: checkout.sessionId });
				},
			),

			agentaosSubscriptions: createAuthEndpoint(
				'/agentaos/subscriptions',
				{ method: 'GET', use: [sessionMiddleware] },
				async (ctx) => {
					const { user } = ctx.context.session;
					// Subscriptions are matched by email, so only a verified owner of that
					// email may read them. Otherwise anyone could sign up with someone
					// else's address and see their plans.
					if (!user.emailVerified) {
						throw new APIError('FORBIDDEN', {
							message: 'Verify your email to see your subscriptions',
						});
					}
					const email = user.email.toLowerCase();
					const mine: Subscription[] = [];
					let offset = 0;
					for (;;) {
						const page = await callAgentaOS(() =>
							options.client.subscriptions.list({ limit: 100, offset }),
						);
						mine.push(...page.items.filter((s) => s.customerEmail?.toLowerCase() === email));
						if (!page.hasMore || page.items.length === 0) break;
						offset += page.items.length;
					}
					return ctx.json({ subscriptions: mine });
				},
			),

			agentaosWebhook: createAuthEndpoint(
				'/agentaos/webhook',
				{ method: 'POST', metadata: { isAction: false }, cloneRequest: true },
				async (ctx) => {
					if (!options.webhookSecret) {
						throw new APIError('NOT_FOUND', { message: 'AgentaOS webhooks are not configured' });
					}
					if (!ctx.request) {
						throw new APIError('BAD_REQUEST', { message: 'Missing request' });
					}
					// AgentaOS signs the raw body, so read it as text before anything parses it.
					const body = await ctx.request.text();
					let event: WebhookEvent;
					try {
						event = options.client.webhooks.verify(
							body,
							ctx.request.headers.get('x-agentaos-signature') ?? '',
							options.webhookSecret,
						);
					} catch (error) {
						throw new APIError('BAD_REQUEST', {
							message: error instanceof Error ? error.message : 'Invalid webhook signature',
						});
					}

					const userId =
						event.type === 'checkout.session.completed' &&
						typeof event.data.metadata?.userId === 'string'
							? event.data.metadata.userId
							: null;
					await handle(event, userId);
					return ctx.json({ received: true });
				},
			),
		},
	} satisfies BetterAuthPlugin;
};

export type { WebhookEvent } from '@agentaos/pay';
