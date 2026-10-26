import { type AgentaOS, AgentaOSError, type Subscription, type WebhookEvent } from '@agentaos/pay';
import type { BetterAuthPlugin } from 'better-auth';
import {
	APIError,
	createAuthEndpoint,
	sensitiveSessionMiddleware,
	sessionMiddleware,
} from 'better-auth/api';
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
	 * The Better Auth user who owns it. Set on the first `checkout.session.completed`
	 * of a checkout started through this plugin, and on `subscription.*` events for
	 * subscriptions bought that way. Null on renewal and upgrade charges
	 * (`checkout.session.completed` again) and on every other event.
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
	/** Products a signed-in user can buy or switch to, by slug. */
	products: AgentaOSProduct[];
	/** Where the buyer lands after paying. */
	successUrl: string;
	/** Where the buyer lands if they leave the checkout. Defaults to `successUrl`. */
	cancelUrl?: string;
	/**
	 * Signing secret from Settings → Developers → Webhooks (`whsec_...`). Enables the
	 * webhook endpoint, which also records which user owns which subscription.
	 */
	webhookSecret?: string;
	/**
	 * Called for every verified webhook event, after the matching `on...` handler.
	 * If a handler throws, the delivery answers 500 and AgentaOS retries it; `onEvent`
	 * is not called for that attempt.
	 */
	onEvent?: (args: WebhookArgs) => Promise<void> | void;
}

/** The table that links a Better Auth user to the subscriptions they bought. */
const MODEL = 'agentaosSubscription';

interface OwnedSubscription {
	id: string;
	userId: string;
	subscriptionId: string;
	createdAt: Date;
}

const checkoutBody = z.object({ slug: z.string().min(1) });
const subscriptionBody = z.object({ subscriptionId: z.string().min(1) });
const changePlanBody = subscriptionBody.extend({ slug: z.string().min(1) });
const subscriptionQuery = z.object({ subscriptionId: z.string().min(1) });

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
 * API key, becomes a plain 500 so server details do not leak.
 */
async function callAgentaOS<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (error) {
		if (error instanceof AgentaOSError && API_STATUS[error.status]) {
			throw new APIError(API_STATUS[error.status], { message: error.message });
		}
		throw error;
	}
}

/**
 * Connects AgentaOS to your Better Auth users.
 *
 * - `POST /agentaos/checkout` starts a checkout for the signed-in user and returns its URL.
 * - `GET /agentaos/subscriptions` lists the signed-in user's subscriptions.
 * - `POST /agentaos/cancel-subscription` cancels one of them at the end of the paid period.
 * - `POST /agentaos/preview-plan-change` quotes a move to another of your products.
 * - `POST /agentaos/change-plan` applies that move at the current price.
 * - `GET /agentaos/invoices` lists the invoices of one of their subscriptions.
 * - `POST /agentaos/webhook` verifies AgentaOS webhooks, records new subscriptions and calls your handlers.
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
		schema: {
			[MODEL]: {
				fields: {
					userId: {
						type: 'string',
						required: true,
						references: { model: 'user', field: 'id', onDelete: 'cascade' },
					},
					subscriptionId: { type: 'string', required: true, unique: true },
					createdAt: { type: 'date', required: true },
				},
			},
		},
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
					const owned = await ctx.context.adapter.findMany<OwnedSubscription>({
						model: MODEL,
						where: [{ field: 'userId', value: ctx.context.session.user.id }],
					});
					const wanted = new Set(owned.map((row) => row.subscriptionId));
					const mine: Subscription[] = [];
					let offset = 0;
					// The API has no lookup by id, so page through until every owned one is found.
					while (mine.length < wanted.size) {
						const page = await callAgentaOS(() =>
							options.client.subscriptions.list({ limit: 100, offset }),
						);
						mine.push(...page.items.filter((s) => wanted.has(s.id)));
						if (!page.hasMore || page.items.length === 0) break;
						offset += page.items.length;
					}
					return ctx.json({ subscriptions: mine });
				},
			),

			agentaosCancelSubscription: createAuthEndpoint(
				'/agentaos/cancel-subscription',
				{ method: 'POST', body: subscriptionBody, use: [sensitiveSessionMiddleware] },
				async (ctx) => {
					const id = await ownedSubscriptionId(ctx, ctx.body.subscriptionId);
					// At period end: the subscriber keeps what they paid for, and nothing is refunded.
					return ctx.json(await callAgentaOS(() => options.client.subscriptions.cancel(id)));
				},
			),

			agentaosPreviewPlanChange: createAuthEndpoint(
				'/agentaos/preview-plan-change',
				{ method: 'POST', body: changePlanBody, use: [sensitiveSessionMiddleware] },
				async (ctx) => {
					const target = findProduct(ctx.body.slug);
					const id = await ownedSubscriptionId(ctx, ctx.body.subscriptionId);
					const preview = await callAgentaOS(() =>
						options.client.subscriptions.previewPlanChange(id, target.productId),
					);
					return ctx.json(preview);
				},
			),

			agentaosChangePlan: createAuthEndpoint(
				'/agentaos/change-plan',
				{ method: 'POST', body: changePlanBody, use: [sensitiveSessionMiddleware] },
				async (ctx) => {
					const target = findProduct(ctx.body.slug);
					const id = await ownedSubscriptionId(ctx, ctx.body.subscriptionId);
					// Quote again on the server so the buyer cannot choose the proration date.
					const result = await callAgentaOS(async () => {
						const { prorationDate } = await options.client.subscriptions.previewPlanChange(
							id,
							target.productId,
						);
						return options.client.subscriptions.changePlan(id, {
							targetLinkId: target.productId,
							prorationDate,
						});
					});
					return ctx.json(result);
				},
			),

			agentaosInvoices: createAuthEndpoint(
				'/agentaos/invoices',
				{ method: 'GET', query: subscriptionQuery, use: [sessionMiddleware] },
				async (ctx) => {
					const id = await ownedSubscriptionId(ctx, ctx.query.subscriptionId);
					const invoices = await callAgentaOS(() => options.client.subscriptions.invoices(id));
					return ctx.json({ invoices });
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

					let userId: string | null = null;
					if (event.type === 'checkout.session.completed') {
						const { userId: buyer, subscriptionId } = event.data.metadata;
						userId = typeof buyer === 'string' ? buyer : null;
						if (userId && typeof subscriptionId === 'string') {
							await recordOwner(ctx, userId, subscriptionId);
						}
					} else if (event.type.startsWith('subscription.')) {
						const { id } = (event as EventOf<'subscription.updated'>).data;
						userId = (await findOwner(ctx, id))?.userId ?? null;
					}
					await handle(event, userId);
					return ctx.json({ received: true });
				},
			),
		},
	} satisfies BetterAuthPlugin;
};

type EndpointContext = {
	context: {
		adapter: {
			findOne: <T>(args: {
				model: string;
				where: { field: string; value: string }[];
			}) => Promise<T | null>;
			create: <T>(args: { model: string; data: Record<string, unknown> }) => Promise<T>;
		};
		session?: { user: { id: string } } | null;
	};
};

/**
 * The subscription id, if the signed-in user bought it through this plugin.
 * Someone else's subscription answers 404, the same as one that does not exist,
 * so ids cannot be probed.
 */
async function ownedSubscriptionId(ctx: EndpointContext, subscriptionId: string): Promise<string> {
	const row = await findOwner(ctx, subscriptionId);
	if (!row || row.userId !== ctx.context.session?.user.id) {
		throw new APIError('NOT_FOUND', { message: 'Subscription not found' });
	}
	return row.subscriptionId;
}

function findOwner(ctx: EndpointContext, subscriptionId: string) {
	return ctx.context.adapter.findOne<OwnedSubscription>({
		model: MODEL,
		where: [{ field: 'subscriptionId', value: subscriptionId }],
	});
}

/** Records the buyer of a new subscription once; a redelivered event changes nothing. */
async function recordOwner(ctx: EndpointContext, userId: string, subscriptionId: string) {
	if (!(await findOwner(ctx, subscriptionId))) {
		await ctx.context.adapter.create({
			model: MODEL,
			data: { userId, subscriptionId, createdAt: new Date() },
		});
	}
}

export type { WebhookEvent } from '@agentaos/pay';
