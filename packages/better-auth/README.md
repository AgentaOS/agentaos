# @agentaos/better-auth

[Better Auth](https://better-auth.com) plugin for [AgentaOS](https://agentaos.ai), the merchant of record. AgentaOS sells your product in its own name, charges VAT and sales tax, issues the invoice and pays you out, including in many countries where Stripe isn't available.

- `POST /agentaos/checkout`: a checkout for the signed-in user, with their user id in the checkout metadata
- `GET /agentaos/subscriptions`: the signed-in user's subscriptions
- `POST /agentaos/cancel-subscription`: cancels one of them at the end of the paid period
- `POST /agentaos/change-plan`: quotes, then applies, a move to another of your products
- `GET /agentaos/invoices`: the invoices of one of their subscriptions
- `POST /agentaos/webhook`: verifies AgentaOS webhooks and calls your handlers

## Install

```bash
npm install @agentaos/better-auth @agentaos/pay
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
        // Give userId access to the product with link id event.data.linkId
      },
      onSubscriptionCanceled: async ({ event }) => {
        // event.data.customerEmail identifies the buyer
      },
    }),
  ],
});
```

Create an API key in the [AgentaOS dashboard](https://app.agentaos.ai) under **Developers → API keys** (`sk_test_` in test mode). Set the webhook URL to `https://your-domain.com/api/auth/agentaos/webhook` in **Settings → Developers → Webhooks**, and copy the signing secret from there.

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

// Switch plan: quote first, show the price, then apply with the quote's prorationDate
const { data: quote } = await authClient.agentaos.changePlan({ subscriptionId: 'sub_...', slug: 'team' });
await authClient.agentaos.changePlan({
  subscriptionId: 'sub_...',
  slug: 'team',
  prorationDate: quote!.preview.prorationDate,
});
```

An upgrade charges the prorated difference on the saved card at once. A downgrade switches at the end of the period and charges nothing today. The target plan must use the same currency and billing interval.

In test mode, pay with the card `4242 4242 4242 4242`, any future date and any CVC.

## Events

Pass a handler for each event you need: `onCheckoutCompleted`, `onSubscriptionCreated`, `onSubscriptionRenewed`, `onSubscriptionUpdated`, `onSubscriptionPaymentFailed`, `onSubscriptionCanceled`, `onDisputeCreated` and `onDisputeClosed`. Each receives `{ event, userId }`; `userId` is set on `checkout.session.completed` only. `onEvent` receives every verified event, after the matching handler. See [Webhooks](https://docs.agentaos.ai/payments/webhooks).

## Security

What the plugin does for you:

- **Checkout** needs a signed-in session, and Better Auth's origin check rejects requests from other sites. The buyer can only pick a product by its `slug` from your `products` list; the product id, price and redirect URLs are set on your server.
- **Subscriptions** are matched by email, so they are only shown to, cancelled by or switched by a user whose email is verified. Someone else's subscription answers 404, the same as one that does not exist.
- **Plan changes** only go to a product in your `products` list.
- **Webhooks** are verified with HMAC-SHA256 over the raw body; a wrong secret, a changed body, or a signature older than 5 minutes is rejected.

What your handlers should do:

- Grant the product in `event.data.linkId`, not just "a purchase". The user id comes from checkout metadata your server set.
- Ignore test events in production: check `event.data.livemode`.
- Make granting idempotent (for example, keyed on `event.data.sessionId`), because a valid webhook can be delivered more than once.

## License

Apache-2.0
