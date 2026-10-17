import type { AgentaOS, Subscription, WebhookEvent } from '@agentaos/pay';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { z } from 'zod';

export interface AgentaOSProduct {
	/** A short name you use in your app, e.g. `pro`. */
	slug: string;
	/** The AgentaOS product's link id (product page, "Copy link ID"). */
	productId: string;
}

export interface AgentaOSPluginOptions {
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
	 * Called for every verified webhook event. For `checkout.session.completed`,
	 * `userId` is the Better Auth user who started the checkout.
	 */
	onEvent?: (args: { event: WebhookEvent; userId: string | null }) => Promise<void> | void;
}

const checkoutBody = z.object({ slug: z.string().min(1) });

/**
 * Connects AgentaOS to your Better Auth users.
 *
 * - `POST /agentaos/checkout` starts a checkout for the signed-in user and returns its URL.
 * - `GET /agentaos/subscriptions` lists the signed-in user's subscriptions.
 * - `POST /agentaos/webhook` verifies AgentaOS webhooks and calls `onEvent`.
 */
export const agentaos = (options: AgentaOSPluginOptions) => {
	const findProduct = (slug: string) => {
		const product = options.products.find((p) => p.slug === slug);
		if (!product) {
			throw new APIError('BAD_REQUEST', { message: `Unknown product: ${slug}` });
		}
		return product;
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
						const page = await options.client.subscriptions.list({ limit: 100, offset });
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
						typeof event.data.metadata.userId === 'string'
							? event.data.metadata.userId
							: null;
					await options.onEvent?.({ event, userId });
					return ctx.json({ received: true });
				},
			),
		},
	} satisfies BetterAuthPlugin;
};

export type { WebhookEvent } from '@agentaos/pay';
