# @agentaos/better-auth

[Better Auth](https://better-auth.com) plugin for [AgentaOS](https://agentaos.ai), the merchant of record. AgentaOS sells your product in its own name, charges VAT and sales tax, issues the invoice and pays you out, including in many countries where Stripe isn't available.

- `POST /agentaos/checkout`: a checkout for the signed-in user, with their user id and the product slug in the checkout metadata
- `GET /agentaos/subscriptions`: the signed-in user's subscriptions
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
      products: [{ slug: 'pro', productId: 'your-product-link-id' }],
      successUrl: 'https://example.com/thanks',
      webhookSecret: process.env.AGENTAOS_WEBHOOK_SECRET,
      onCheckoutCompleted: async ({ event, userId }) => {
        // Renewals and upgrade charges arrive here too, with no userId.
        if (!userId) return;
        // event.data.metadata.product is the slug the user bought, e.g. 'pro'.
        await grantAccess(userId, event.data.metadata.product);
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

const { data } = await authClient.agentaos.checkout({ slug: 'pro' });
window.location.href = data!.url;

const { data: mine } = await authClient.agentaos.subscriptions();
```

When AgentaOS refuses a checkout, the error keeps its reason and status. In test mode, pay with the card `4242 4242 4242 4242`, any future date and any CVC.

## Events

Pass a handler for each event you need: `onCheckoutCompleted`, `onSubscriptionCreated`, `onSubscriptionRenewed`, `onSubscriptionUpdated`, `onSubscriptionPaymentFailed`, `onSubscriptionCanceled`, `onDisputeCreated` and `onDisputeClosed`. Each receives `{ event, userId }`. `userId` is set only on the first `checkout.session.completed` of a checkout started through this plugin; renewals and upgrade charges also arrive as `checkout.session.completed`, with `userId` null. Keep the link from `event.data.metadata.subscriptionId` to your user from that first event if you need it later.

`onEvent` receives every verified event, after the matching handler. If a handler throws, the delivery answers 500 and AgentaOS retries it; `onEvent` is not called for that attempt. See [Webhooks](https://docs.agentaos.ai/payments/webhooks).

Two things about the event data:

- `event.data.linkId` on `checkout.session.completed` is the payment link's public token, not the link id you set as `productId`. Use `event.data.metadata.product` to know what was bought.
- The SDK delivers every key in camelCase, metadata included: a key sent as `user_id` arrives as `userId`.

## Security

What the plugin does for you:

- **Checkout** needs a signed-in session, and Better Auth's origin check rejects requests from other sites. The buyer can only pick a product by its `slug` from your `products` list; the product id, price and redirect URLs are set on your server.
- **Subscriptions** are matched by email, so they are only shown to a user whose email is verified.
- **Webhooks** are verified with HMAC-SHA256 over the raw body; a wrong secret, a changed body, or a signature older than 5 minutes is rejected.

What your handlers should do:

- Ignore test events in production: check `event.data.livemode`.
- Make granting idempotent, because a valid webhook can be delivered more than once: key checkouts on `event.data.sessionId`, and subscription events on the subscription id and period.

## License

Apache-2.0
