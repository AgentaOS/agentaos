import type { AgentaOS, Subscription, WebhookEvent } from '@agentaos/pay';
import type { BetterAuthPlugin, User } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { z } from 'zod';

export interface AgentaOSProduct {
	/** A short name you use in your app, e.g. `pro`. */
	slug: string;
	/** The AgentaOS product's link id (product page, "Copy link ID"). */
	productId: string;
}

type EventOf<T extends WebhookEvent['type']> = Extract<WebhookEvent, { type: T }>;

/** What every webhook handler receives. `userId` is set on `checkout.session.completed` only. */
export interface WebhookArgs<E extends WebhookEvent = WebhookEvent> {
	event: E;
	userId: string | null;
}

type Handler<T extends WebhookEvent['type']> = (
	args: WebhookArgs<EventOf<T>>,
) => Promise<void> | void;

/** One handler per event you care about. `onEvent` still receives every event. */
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

const HANDLER_FOR: Partial<Record<WebhookEvent['type'], keyof AgentaOSWebhookHandlers>> = {
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
	/** Products a signed-in user can buy or switch to, by slug. */
	products: AgentaOSProduct[];
	/** Where the buyer lands after paying. */
	successUrl: string;
	/** Where the buyer lands if they leave the checkout. Defaults to `successUrl`. */
	cancelUrl?: string;
	/** Signing secret from Settings → Developers → Webhooks (`whsec_...`). Enables the webhook endpoint. */
	webhookSecret?: string;
	/** Called for every verified webhook event, after the matching `on...` handler. */
	onEvent?: (args: WebhookArgs) => Promise<void> | void;
}

const checkoutBody = z.object({ slug: z.string().min(1) });
const subscriptionBody = z.object({ subscriptionId: z.string().min(1) });
const changePlanBody = subscriptionBody.extend({
	slug: z.string().min(1),
	/** From the preview. Without it the endpoint only quotes the change. */
	prorationDate: z.number().int().positive().optional(),
});
const subscriptionQuery = z.object({ subscriptionId: z.string().min(1) });

/**
 * Connects AgentaOS to your Better Auth users.
 *
 * - `POST /agentaos/checkout` starts a checkout for the signed-in user and returns its URL.
 * - `GET /agentaos/subscriptions` lists the signed-in user's subscriptions.
 * - `POST /agentaos/cancel-subscription` cancels one of them at the end of the paid period.
 * - `POST /agentaos/change-plan` quotes, then applies, a move to another of your products.
 * - `GET /agentaos/invoices` lists the invoices of one of their subscriptions.
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

	// Subscriptions are matched by email, so only a verified owner of that email
	// may read or change them. Otherwise anyone could sign up with someone else's
	// address and manage their plans.
	const verifiedEmail = (user: User) => {
		if (!user.emailVerified) {
			throw new APIError('FORBIDDEN', {
				message: 'Verify your email to manage your subscriptions',
			});
		}
		return user.email.toLowerCase();
	};

	const subscriptionsOf = async (email: string) => {
		const mine: Subscription[] = [];
		let offset = 0;
		for (;;) {
			const page = await options.client.subscriptions.list({ limit: 100, offset });
			mine.push(...page.items.filter((s) => s.customerEmail?.toLowerCase() === email));
			if (!page.hasMore || page.items.length === 0) break;
			offset += page.items.length;
		}
		return mine;
	};

	const ownSubscription = async (user: User, subscriptionId: string) => {
		const subscription = (await subscriptionsOf(verifiedEmail(user))).find(
			(s) => s.id === subscriptionId,
		);
		if (!subscription) {
			// Same answer for "not yours" and "does not exist", so ids cannot be probed.
			throw new APIError('NOT_FOUND', { message: 'Subscription not found' });
		}
		return subscription;
	};

	const handle = async (event: WebhookEvent, userId: string | null) => {
		const name = HANDLER_FOR[event.type];
		const handler = name
			? (options[name] as ((args: WebhookArgs) => unknown) | undefined)
			: undefined;
		await handler?.({ event, userId });
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
					const checkout = await options.client.checkouts.create({
						linkId: product.productId,
						buyerEmail: user.email,
						buyerName: user.name || undefined,
						metadata: { userId: user.id },
						successUrl: options.successUrl,
						cancelUrl: options.cancelUrl ?? options.successUrl,
					});
					return ctx.json({ url: checkout.checkoutUrl, sessionId: checkout.sessionId });
				},
			),

			agentaosSubscriptions: createAuthEndpoint(
				'/agentaos/subscriptions',
				{ method: 'GET', use: [sessionMiddleware] },
				async (ctx) => {
					const email = verifiedEmail(ctx.context.session.user);
					return ctx.json({ subscriptions: await subscriptionsOf(email) });
				},
			),

			agentaosCancelSubscription: createAuthEndpoint(
				'/agentaos/cancel-subscription',
				{ method: 'POST', body: subscriptionBody, use: [sessionMiddleware] },
				async (ctx) => {
					const subscription = await ownSubscription(
						ctx.context.session.user,
						ctx.body.subscriptionId,
					);
					// At period end: the subscriber keeps what they paid for, and nothing is refunded.
					const result = await options.client.subscriptions.cancel(subscription.id);
					return ctx.json(result);
				},
			),

			agentaosChangePlan: createAuthEndpoint(
				'/agentaos/change-plan',
				{ method: 'POST', body: changePlanBody, use: [sessionMiddleware] },
				async (ctx) => {
					const subscription = await ownSubscription(
						ctx.context.session.user,
						ctx.body.subscriptionId,
					);
					const target = findProduct(ctx.body.slug);
					if (ctx.body.prorationDate === undefined) {
						const preview = await options.client.subscriptions.previewPlanChange(
							subscription.id,
							target.productId,
						);
						return ctx.json({ preview });
					}
					const result = await options.client.subscriptions.changePlan(subscription.id, {
						targetLinkId: target.productId,
						prorationDate: ctx.body.prorationDate,
					});
					return ctx.json({ result });
				},
			),

			agentaosInvoices: createAuthEndpoint(
				'/agentaos/invoices',
				{ method: 'GET', query: subscriptionQuery, use: [sessionMiddleware] },
				async (ctx) => {
					const subscription = await ownSubscription(
						ctx.context.session.user,
						ctx.query.subscriptionId,
					);
					return ctx.json({
						invoices: await options.client.subscriptions.invoices(subscription.id),
					});
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
						typeof event.data.metadata.userId === 'string'
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
