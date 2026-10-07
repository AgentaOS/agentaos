# @agentaos/pay

The server-side TypeScript SDK for AgentaOS, the merchant of record for founders who sell digital products. Create products and checkouts, manage subscriptions, discount codes, customers and invoices, and verify webhooks from your Node.js backend.

AgentaOS sells your product in its own name. It takes the payment, charges the VAT, issues the invoice and pays you out. Full guides are at [docs.agentaos.ai](https://docs.agentaos.ai/sdk/pay-overview).

## Install

```bash
npm install @agentaos/pay
```

The SDK needs Node.js 20 or later and is ESM only.

## Quickstart

```typescript
import { AgentaOS } from '@agentaos/pay';

const agentaos = new AgentaOS(process.env.AGENTAOS_API_KEY!);

const checkout = await agentaos.checkouts.create({
  amount: 49.99,
  currency: 'EUR',
  description: 'Pro plan, monthly',
  successUrl: 'https://example.com/welcome',
  cancelUrl: 'https://example.com/pricing',
  metadata: { userId: 'user_123' },
});

// Send the buyer to checkout.checkoutUrl
```

When the buyer pays, confirm it on your server before you give access. Read the checkout with `checkouts.retrieve(sessionId)` and check that `status` is `'completed'`, or handle the `checkout.session.completed` webhook.

## Authentication

Create an API key in [app.agentaos.ai](https://app.agentaos.ai) under **Settings → Developers**. A key that starts with `sk_test_` works in test mode, and `sk_live_` works in live mode.

```typescript
const agentaos = new AgentaOS('sk_test_...', {
  baseUrl: 'https://api.agentaos.ai', // default
  timeout: 30000,                     // ms, default
  maxRetries: 2,                      // retries on 5xx, default
  debug: false,                       // log requests to stderr, without the key or bodies
});
```

The SDK runs on the server only. Its constructor throws in a browser, because the API key gives full access to your account. For a checkout on your own page, use [`@agentaos/checkout`](../checkout).

## Products and plans

A product is a reusable buyer link: every buyer who opens `checkoutUrl` gets a checkout. The SDK calls products `paymentLinks`.

```typescript
// One-time product
const ebook = await agentaos.paymentLinks.create({
  name: 'Pricing playbook',
  amount: 19,
  currency: 'EUR',
});

// Subscription plan with a paid trial: 9.00 for the first 30 days, then 29.99 a month
const pro = await agentaos.paymentLinks.create({
  name: 'Pro',
  amount: 29.99,
  currency: 'EUR',
  type: 'subscription',
  billingInterval: 'month',
  trialPeriodDays: 30,
  trialAmount: 9,
});

console.log(pro.checkoutUrl); // https://app.agentaos.ai/pay/...
```

Leave out `trialAmount` for a free trial. `amount` is always the recurring price, charged when the trial ends. Other options are `description`, `imageUrl`, `successUrl`, `cancelUrl`, `webhookUrl`, `taxRateId`, `metadata`, `expiresAt` and `checkoutFields`.

| Method | What it does |
|---|---|
| `paymentLinks.create(params)` | Create a product or a subscription plan |
| `paymentLinks.retrieve(id)` | Read one product |
| `paymentLinks.list({ limit, offset })` | List products and plans |
| `paymentLinks.cancel(id)` | Cancel a product, so its link stops working |

## Checkouts

A checkout is one buyer's payment session. Create one on your server when you want to attach your own data, such as the signed-in user's ID in `metadata`.

```typescript
const checkout = await agentaos.checkouts.create({
  linkId: pro.id,                 // start from a product; or pass amount and currency
  buyerEmail: 'ana@example.com',  // prefill; also buyerName, buyerCompany, buyerCountry, buyerAddress, buyerVat
  metadata: { userId: 'user_123' },
  expiresIn: 1800,                // seconds, 300 to 86400
});
```

The response carries `id`, `sessionId`, `checkoutUrl`, `status` (`'open'`, `'completed'`, `'expired'` or `'cancelled'`), `currency`, `metadata`, `invoiceId`, `invoiceNumber`, `expiresAt` and `createdAt`.

| Method | What it does |
|---|---|
| `checkouts.create(params)` | Start a checkout from a product, or from an amount and currency |
| `checkouts.retrieve(sessionId)` | Read one checkout and its status |
| `checkouts.list({ status, limit, offset })` | List checkouts |
| `checkouts.cancel(sessionId)` | Cancel an open checkout |

## Subscriptions

Buyers start subscriptions on the checkout of a subscription plan. The SDK manages them after that, so there is no `create`.

```typescript
const page = await agentaos.subscriptions.list({ limit: 20 });
// page.items[0]: { id, customerEmail, planName, status, unitAmountMinor, currency, currentPeriodEnd, discount, ... }

// Cancel at the end of the paid period (default), or now with { atPeriodEnd: false }
await agentaos.subscriptions.cancel('sub-id');

// Move to another plan: quote first, then apply the same quote
const quote = await agentaos.subscriptions.previewPlanChange('sub-id', 'target-product-id');
console.log(quote.direction, quote.dueTodayMinor);
await agentaos.subscriptions.changePlan('sub-id', {
  targetLinkId: 'target-product-id',
  prorationDate: quote.prorationDate,
});
```

An upgrade charges the prorated difference now. A downgrade starts at the end of the current period and charges nothing today. The target plan must have the same currency and billing interval.

Amounts that end in `Minor` are integers in minor units: `1999` is 19.99.

| Method | What it does |
|---|---|
| `subscriptions.list({ limit, offset, discountCode })` | List subscriptions; `discountCode` shows only the subscribers one code brought in |
| `subscriptions.cancel(id, { atPeriodEnd })` | Cancel at period end (default) or now. No refund |
| `subscriptions.previewPlanChange(id, targetLinkId)` | Quote a plan change without applying it |
| `subscriptions.changePlan(id, { targetLinkId, prorationDate })` | Apply a quoted plan change |
| `subscriptions.invoices(id)` | The subscription's invoices, newest first |
| `subscriptions.credit(id, { amountMinor, reason, idempotencyKey })` | Give credit that comes off the next invoice |
| `subscriptions.credits(id)` | Credits given, and the customer's unspent balance |

A credit reduces what the subscriber's next invoice charges. It is not a refund. Only an owner or admin signed in with `agenta login` can give credit, because the credit records who gave it; an API key cannot. `idempotencyKey` is required: send the same key when you retry the same credit, so the subscriber is not credited twice.

## Discount codes

Buyers type a discount code at checkout on a subscription plan. A code takes a percentage off, a fixed amount off, or nothing. A code that takes nothing off still records who it brought in, which is how a referral works.

```typescript
const code = await agentaos.discountCodes.create({
  code: 'LAUNCH20',
  percentOff: 20,        // or amountOffMinor: 500; set at most one
  maxRedemptions: 100,   // optional
  linkId: pro.id,        // optional: limit it to one plan
});

const detail = await agentaos.discountCodes.get(code.id);
console.log(detail.termsLabel, detail.timesRedeemed); // '20% off', 14

await agentaos.discountCodes.archive(code.id); // stops the code now
```

The terms of a code do not change after you create it. To change them, archive the code and create a new one. Subscribers who already used an archived code keep their discount. `discountCodes.list({ limit, offset })` lists your codes without their terms; `get` is the call that returns them.

## Customers and invoices

AgentaOS issues an invoice for each paid sale and sends the buyer a receipt.

| Method | What it does |
|---|---|
| `customers.list({ limit, offset })` | The customers who paid you |
| `invoices.list({ from, to, status, limit, offset })` | List invoices; `status` is `'all'`, `'issued'` or `'voided'` |
| `invoices.retrieve(id)` | Read one invoice |
| `invoices.void(id)` | Void an invoice |
| `invoices.downloadPdf(id)` | The invoice PDF, as a `Buffer` |
| `invoices.getReceipt(id)` | The receipt PDF for a paid invoice, as a `Buffer` |
| `invoices.sendReceipt(id)` | Send the receipt email to the buyer again; returns `sentTo` |
| `invoices.downloadStatement({ from, to })` | A statement PDF for a date range |
| `invoices.exportCsv({ from, to, status })` | Invoices as CSV text |
| `transactions.list({ direction, from, to, limit, offset })` | Money in and out, by date |

```typescript
import { writeFileSync } from 'node:fs';

writeFileSync('receipt.pdf', await agentaos.invoices.getReceipt('invoice-id'));
```

## Going live

Your account starts in test mode. Verify your business to take live payments.

| Method | What it does |
|---|---|
| `goLive.get()` | Where the account is on the way to live payments: verification and open change requests, plus whether a payout account exists (needed before the first payout) |
| `accountReview.submit(details)` | Submit business verification |
| `accountReview.get()` | The verification on file, or `null` |
| `accountReview.resubmit()` | Send the verification back for review after you make the requested changes |
| `accountReview.requestAudit(details)` | Ask for the free Revenue & Pricing Audit |

## Platforms

Platforms are in private preview. A platform runs billing for its clients' businesses from one account. To act for a business you manage, create the client with `business`, or pass `{ business }` as the last argument of any call.

```typescript
const { business, inviteUrl } = await agentaos.businesses.create({
  name: 'ClientCo',
  country: 'EE',
  clientEmail: 'ana@example.com', // invites your client as the business's admin
});

const forClient = new AgentaOS(process.env.AGENTAOS_API_KEY!, { business: business.id });
await forClient.paymentLinks.list();
```

The other methods are `businesses.list()`, `retrieve(id)`, `resendInvitation(id)`, `revokeInvitation(id)` and `createVerificationLink(id)`. See [Build a platform](https://docs.agentaos.ai/guides/build-a-platform).

### Bank accounts for the businesses you manage

A marketplace can save a seller's bank account from its own app, once we have opened bank accounts by API for the platform. Ask for the fields the currency needs, then send the answers. The bank confirms the holder name; a clear mismatch is saved but never paid, and `payableReason` says so. We keep the last four digits and a hash, never the number.

```typescript
const { requirements } = await forClient.bankAccounts.requirements('EUR');

const account = await forClient.bankAccounts.create({
  currency: 'EUR',
  type: 'iban',
  accountHolderName: 'Seller GmbH',
  legalType: 'BUSINESS',
  details: { IBAN: 'DE89370400440532013000' },
});
// account.accountIdentifierLast4 === '3000', account.payable once the name matches
```

Every account added this way is emailed to you and to the seller's owner. `bankAccounts.list()` and `deactivate(id)` complete the set. Needs a live key.

## Webhooks

Set `webhookUrl` on a product or a checkout. AgentaOS signs each event with HMAC-SHA256. Verify the signature against the raw request body, before any JSON parser runs:

```typescript
import express from 'express';

app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = agentaos.webhooks.verify(
      req.body,                                // raw body: string or Buffer
      req.header('x-agentaos-signature') ?? '',
      process.env.AGENTAOS_WEBHOOK_SECRET!,
    );
  } catch {
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    // Give access to event.data.metadata.userId
  }
  res.sendStatus(200);
});
```

`verify` rejects a signature that is older than 300 seconds. Every event has a `type`, a `data` object and the `business` it belongs to.

| Event | When it is sent |
|---|---|
| `checkout.session.completed` | A buyer paid a checkout |
| `subscription.created` | A subscription started |
| `subscription.renewed` | A renewal was paid |
| `subscription.payment_failed` | A payment on a subscription failed |
| `subscription.updated` | The plan changed, or a cancellation was scheduled or undone |
| `subscription.canceled` | The subscription ended |
| `dispute.created` | A buyer's bank opened a dispute on a sale |
| `dispute.closed` | The dispute closed |
| `account.updated` | The verification of a business you manage changed |
| `webhook.test` | You sent a test event |

## Errors

Every error extends `AgentaOSError`, which has `status` and `message`.

| Error | HTTP status | When |
|---|---|---|
| `ValidationError` | 400 | The request parameters are not valid |
| `AuthenticationError` | 401 | The API key is not valid or has expired |
| `PermissionError` | 403 | The key cannot access this resource |
| `NotFoundError` | 404 | The resource does not exist |
| `IdempotencyError` | 409 | The idempotency key was already used |
| `RateLimitError` | 429 | Too many requests; read `retryAfter` |
| `ApiError` | 5xx | A server error, retried up to `maxRetries` times |
| `TimeoutError` | none | The request timed out |
| `WebhookVerificationError` | none | The webhook signature does not match |

## License

Apache-2.0
