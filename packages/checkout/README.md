# @agentaos/checkout

The AgentaOS checkout on your own page — **inline** in a spot you choose, or as an **overlay** over the page. Card, bank transfer, trials, discount codes, VAT and 3D Secure work exactly as on the hosted checkout; AgentaOS stays the merchant of record.

Browser only. For server work (creating checkouts, reading subscriptions) use [`@agentaos/pay`](../pay).

## Before you start

1. **Approve your site** — in the dashboard, **Settings → Developers → Approved sites**, add each site you'll embed on (e.g. `https://acme.com`). The browser refuses to show your checkout anywhere else. Test products also work on `localhost` without adding it.
2. **Your look** — **Settings → Business → Checkout appearance**: button colour, font, corners, background. It applies to the hosted and the embedded checkout alike.
3. **The product's buyer link** — the `checkoutUrl` from `agenta products create`, the SDK, or the product page ("Embed on your site" has a ready snippet).

## Script tag (no build step)

```html
<script src="https://app.agentaos.ai/v1/agentaos.js"></script>
<div id="checkout"></div>
<script>
  const checkout = AgentaOS.checkout.open({
    link: 'https://app.agentaos.ai/pay/UID95sZlBqXrVKlUHKmLhQ',
    target: '#checkout', // leave out for the overlay
    onEvent: (e) => console.log(e.name, e.data),
  });
</script>
```

## npm

```bash
pnpm add @agentaos/checkout
```

```ts
import { loadAgentaOS } from '@agentaos/checkout';

const agentaos = await loadAgentaOS(); // null on the server
agentaos?.checkout.open({ link, target: '#checkout', onEvent });
```

`loadAgentaOS()` adds the script once, however many times it's called (the first call's `origin` wins). While developing against a local AgentaOS, pass `loadAgentaOS({ origin: 'http://localhost:3000' })`. If the script can't load, the promise rejects with a plain sentence and a later call tries again; `<AgentaOSCheckout>` reports it to `onEvent` as `checkout.error` `not_loaded`.

## React

```tsx
import { AgentaOSCheckout, useAgentaOSCheckout } from '@agentaos/checkout/react';

// Inline — switching `link` (e.g. a Monthly/Yearly toggle) updates the open checkout.
<AgentaOSCheckout link={yearly ? YEARLY_LINK : MONTHLY_LINK} email={user.email} onEvent={onEvent} />

// Overlay, from a button — it lives as long as this component (unmounting closes it)
const { open } = useAgentaOSCheckout();
<button onClick={() => open({ link: STARTER_LINK })}>Buy</button>
```

## Options

| Option | |
|---|---|
| `link` | The product's buyer link. |
| `session` | Instead of `link`: the `sessionId` of a checkout your server created with `checkouts.create` (logged-in users, with your own `metadata`). |
| `target` | Selector or element for inline. Leave out for the overlay. |
| `email`, `country` | Prefill (ISO country code). Sent to the checkout directly, never in a URL. |
| `successUrl` | Where the whole page goes after payment, with `sessionId` added (https only). Defaults to the checkout's success URL (the one given to `checkouts.create`, else the product's). `false` keeps the page where it is. |
| `onEvent` | Receives the events below. |

`open()` returns `{ update({ link | session }), close() }`. Prefill and `successUrl` are read when the checkout opens; `update()` switches only the product or checkout.

## Events

| `name` | `data` |
|---|---|
| `checkout.loaded` | `{ product: { name, type, billingInterval, trialDays }, currency, testMode }` |
| `checkout.completed` | `{ sessionId, kind: 'payment' \| 'trial' \| 'bank_transfer', email, amountMinor, currency, successUrl }` |
| `checkout.closed` | `{}` — the overlay closed: by the buyer, by `close()`, or because the React component that opened it unmounted |
| `checkout.error` | `{ code: 'not_loaded' \| 'not_found' \| 'unavailable', message }` |

`amountMinor` is what was charged today in minor units (0 for a free trial), or what the buyer was asked to send for a bank transfer. A bank transfer never moves the page: the buyer needs the bank details on screen.

**An event is never proof of payment.** Unlock access from the webhook or `checkouts.retrieve(sessionId)`, and handle `checkout.completed` once per `sessionId` — a reload of a finished checkout sends it again.

`not_loaded` after 10 seconds usually means the page's site is not on the business's approved sites.

## Payment methods in a frame

Cards (with 3D Secure) and bank transfer work everywhere. Apple Pay shows on Safari 17+; Google Pay and Link are limited by Stripe inside another site's frame.
