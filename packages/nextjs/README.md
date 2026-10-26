# @agentaos/nextjs

Next.js route handlers for [AgentaOS](https://agentaos.ai), the merchant of record. AgentaOS sells your product in its own name, charges VAT and sales tax, issues the invoice and pays you out, including in many countries where Stripe isn't available.

- `Checkout`: a `GET` route that starts a checkout for one of your products and redirects the buyer to it
- `Webhooks`: a `POST` route that verifies AgentaOS webhooks and calls your handlers

## Install

```bash
npm install @agentaos/nextjs
```

Set `AGENTAOS_API_KEY` (dashboard, **Developers → API keys**; `sk_test_` in test mode) and `AGENTAOS_WEBHOOK_SECRET` (**Settings → Developers → Webhooks**).

## Checkout

```ts
// app/checkout/route.ts
import { Checkout } from '@agentaos/nextjs';

export const GET = Checkout({
  products: { pro: 'your-pro-link-id', team: 'your-team-link-id' },
  successUrl: 'https://example.com/thanks',
  // Optional: who is buying, read from your own session on the server
  customer: async () => {
    const user = await getCurrentUser();
    return user ? { email: user.email, name: user.name, metadata: { userId: user.id } } : null;
  },
});
```

Link to `/checkout?product=pro`. Only the slugs in `products` can be bought. The buyer, the metadata and the redirect URLs come from your server, never from the query string. AgentaOS appends `?sessionId=...` to `successUrl`.

In test mode, pay with the card `4242 4242 4242 4242`, any future date and any CVC.

## Webhooks

```ts
// app/api/webhooks/agentaos/route.ts
import { Webhooks } from '@agentaos/nextjs';

export const POST = Webhooks({
  webhookSecret: process.env.AGENTAOS_WEBHOOK_SECRET!,
  onCheckoutCompleted: async (event) => {
    // event.data.metadata.userId is what your customer() returned
  },
  onSubscriptionCanceled: async (event) => {
    // event.data.customerEmail identifies the buyer
  },
});
```

Set the webhook URL to `https://your-domain.com/api/webhooks/agentaos` in **Settings → Developers → Webhooks**.

Handlers: `onCheckoutCompleted`, `onSubscriptionCreated`, `onSubscriptionRenewed`, `onSubscriptionUpdated`, `onSubscriptionPaymentFailed`, `onSubscriptionCanceled`, `onDisputeCreated` and `onDisputeClosed`. `onEvent` receives every verified event, after the matching handler. Webhooks need no API key.

Every delivery is verified with HMAC-SHA256 over the raw body; a wrong secret, a changed body, or a signature older than 5 minutes gets a 400 and calls nothing. Make your handlers idempotent (for example, keyed on `event.data.sessionId`), because a valid webhook can be delivered more than once, and ignore test events in production by checking `event.data.livemode`.

Using Better Auth? [`@agentaos/better-auth`](https://www.npmjs.com/package/@agentaos/better-auth) adds checkout and subscription management for your signed-in users.

## License

Apache-2.0
