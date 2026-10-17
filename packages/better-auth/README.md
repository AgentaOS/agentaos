# @agentaos/better-auth

[Better Auth](https://better-auth.com) plugin for [AgentaOS](https://agentaos.ai), the merchant of record. AgentaOS sells your product in its own name, charges VAT and sales tax, issues the invoice and pays you out, including in many countries where Stripe isn't available.

- `POST /agentaos/checkout`: a checkout for the signed-in user, with their user id in the checkout metadata
- `GET /agentaos/subscriptions`: the signed-in user's subscriptions
- `POST /agentaos/webhook`: verifies AgentaOS webhooks and calls your `onEvent`

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
      onEvent: async ({ event, userId }) => {
        if (event.type === 'checkout.session.completed' && userId) {
          // Give userId access to the product with link id event.data.linkId
        }
        if (event.type === 'subscription.canceled') {
          // event.data.customerEmail identifies the buyer
        }
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

In test mode, pay with the card `4242 4242 4242 4242`, any future date and any CVC.

## Events

`onEvent` receives every verified event: `checkout.session.completed`, `subscription.created`, `subscription.renewed`, `subscription.updated`, `subscription.payment_failed`, `subscription.canceled`, `dispute.created`, `dispute.closed` and more. See [Webhooks](https://docs.agentaos.ai/payments/webhooks).

## Security

What the plugin does for you:

- **Checkout** needs a signed-in session, and Better Auth's origin check rejects requests from other sites. The buyer can only pick a product by its `slug` from your `products` list; the product id, price and redirect URLs are set on your server.
- **Subscriptions** are matched by email, so they are only shown to a user whose email is verified.
- **Webhooks** are verified with HMAC-SHA256 over the raw body; a wrong secret, a changed body, or a signature older than 5 minutes is rejected.

What your `onEvent` should do:

- Grant the product in `event.data.linkId`, not just "a purchase". The user id comes from checkout metadata your server set.
- Ignore test events in production: check `event.data.livemode`.
- Make granting idempotent (for example, keyed on `event.data.sessionId`), because a valid webhook can be delivered more than once.

## License

Apache-2.0
