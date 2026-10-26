# @agentaos/better-auth

[Better Auth](https://better-auth.com) plugin for [AgentaOS](https://agentaos.ai), the merchant of record. AgentaOS sells your product in its own name, charges VAT and sales tax, issues the invoice and pays you out, including in many countries where Stripe isn't available.

- `POST /agentaos/checkout`: a checkout for the signed-in user
- `GET /agentaos/subscriptions`: the subscriptions the signed-in user bought
- `POST /agentaos/cancel-subscription`: cancels one of them at the end of the paid period
- `POST /agentaos/preview-plan-change`: quotes a move to another of your products
- `POST /agentaos/change-plan`: applies that move at the current price
- `GET /agentaos/invoices`: the invoices of one of their subscriptions
- `POST /agentaos/webhook`: verifies AgentaOS webhooks, records who owns each new subscription and calls your handlers

## Install

```bash
npm install @agentaos/better-auth @agentaos/pay
```

The plugin adds one table, `agentaosSubscription`, to your Better Auth database: which user owns which subscription. Create it with the Better Auth CLI after adding the plugin:

```bash
npx @better-auth/cli migrate
```

## Server

```ts
import { AgentaOS } from '@agentaos/pay';
import { agentaos } from '@agentaos/better-auth';
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  // ...your config
  plugins: [
    agentaos({
      client: new AgentaOS(process.env.AGENTAOS_API_KEY!),
      products: [
        { slug: 'pro', productId: 'your-pro-link-id' },
        { slug: 'team', productId: 'your-team-link-id' },
      ],
      successUrl: 'https://example.com/thanks',
      webhookSecret: process.env.AGENTAOS_WEBHOOK_SECRET,
      onCheckoutCompleted: async ({ event, userId }) => {
        // Renewals and upgrade charges arrive here too, with no userId.
        if (!userId) return;
        // event.data.metadata.product is the slug the user bought, e.g. 'pro'.
        await grantAccess(userId, event.data.metadata.product);
      },
      onSubscriptionCanceled: async ({ event, userId }) => {
        // userId is the owner when the subscription was bought through this plugin.
      },
    }),
  ],
});
```

Create an API key in the [AgentaOS dashboard](https://app.agentaos.ai) under **Developers → API keys** (`sk_test_` in test mode). Set the webhook URL to `https://your-domain.com/api/auth/agentaos/webhook` in **Settings → Developers → Webhooks**, and copy the signing secret from there. The webhook is required for managing subscriptions: the first payment of each checkout is what records its owner.

## Client

```ts
import { createAuthClient } from 'better-auth/client';
import { agentaosClient } from '@agentaos/better-auth/client';

export const authClient = createAuthClient({ plugins: [agentaosClient()] });

// Buy
const { data } = await authClient.agentaos.checkout({ slug: 'pro' });
window.location.href = data!.url;

// The user's plans, and their invoices
const { data: mine } = await authClient.agentaos.subscriptions();
const { data: bills } = await authClient.agentaos.invoices({ query: { subscriptionId: 'sub_...' } });

// Cancel at the end of the paid period
await authClient.agentaos.cancelSubscription({ subscriptionId: 'sub_...' });

// Switch plan: show the quote, then apply
const { data: quote } = await authClient.agentaos.previewPlanChange({ subscriptionId: 'sub_...', slug: 'team' });
// quote.dueTodayMinor, quote.nextInvoiceMinor, quote.direction ...
await authClient.agentaos.changePlan({ subscriptionId: 'sub_...', slug: 'team' });
```

`changePlan` quotes again on your server and applies that quote, so the price follows the moment the user confirms. An upgrade charges the prorated difference on the saved card at once. A downgrade switches at the end of the period and charges nothing today. The target plan must use the same currency and billing interval. When AgentaOS refuses a change, the error keeps its reason and status.

In test mode, pay with the card `4242 4242 4242 4242`, any future date and any CVC.

## Events

Pass a handler for each event you need: `onCheckoutCompleted`, `onSubscriptionCreated`, `onSubscriptionRenewed`, `onSubscriptionUpdated`, `onSubscriptionPaymentFailed`, `onSubscriptionCanceled`, `onDisputeCreated` and `onDisputeClosed`. Each receives `{ event, userId }`. `userId` is the owner: set on the first `checkout.session.completed` of a checkout started through this plugin, and on `subscription.*` events for subscriptions bought that way. Renewals and upgrade charges also arrive as `checkout.session.completed`, with `userId` null.

`onEvent` receives every verified event, after the matching handler. If a handler throws, the delivery answers 500 and AgentaOS retries it; `onEvent` is not called for that attempt. See [Webhooks](https://docs.agentaos.ai/payments/webhooks).

Two things about the event data:

- `event.data.linkId` on `checkout.session.completed` is the payment link's public token, not the link id you set as `productId`. Use `event.data.metadata.product` to know what was bought.
- The SDK delivers every key in camelCase, metadata included: a key sent as `user_id` arrives as `userId`.

## Security

What the plugin does for you:

- **Checkout** needs a signed-in session, and Better Auth's origin check rejects requests from other sites. The buyer can only pick a product by its `slug` from your `products` list; the product id, price and redirect URLs are set on your server.
- **Ownership** is recorded from the signed webhook, keyed on the user who started the checkout, not on their email. A subscription bought by another user, or sold outside this app, answers 404, the same as one that does not exist.
- **Cancel and plan changes** check the session against the database, so a revoked session stops working at once, even with Better Auth's cookie cache on. Plan changes only go to a product in your `products` list, at a price quoted on your server.
- **Webhooks** are verified with HMAC-SHA256 over the raw body; a wrong secret, a changed body, or a signature older than 5 minutes is rejected.

What your handlers should do:

- Ignore test events in production: check `event.data.livemode`.
- Make granting idempotent, because a valid webhook can be delivered more than once: key checkouts on `event.data.sessionId`, and subscription events on the subscription id and period.

Subscriptions bought before you added the plugin, or while the webhook was not set up, have no owner recorded, so users cannot manage them here.

## License

Apache-2.0
