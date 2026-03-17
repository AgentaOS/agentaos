# @agentaos/pay

Accept regulated stablecoin payments from your Node.js backend. Server-side SDK for the AgentaOS Payment API.

## Install

```bash
npm install @agentaos/pay
```

## Quick Start

```typescript
import { AgentaOS } from '@agentaos/pay';

const agentaos = new AgentaOS(process.env.AGENTAOS_API_KEY!);

const checkout = await agentaos.checkouts.create({
  amount: 49.99,
  currency: 'EUR',
  description: 'Pro Plan — Monthly',
  successUrl: 'https://myshop.com/success',
  cancelUrl: 'https://myshop.com/cart',
  webhookUrl: 'https://myshop.com/webhooks',
});

console.log(checkout.checkoutUrl);
// → https://app.agentaos.ai/checkout/mZrESFyR7RC9RPsJfZCVkg
```

## Authentication

Get your API key from [app.agentaos.ai](https://app.agentaos.ai) → Developer → API Keys.

```typescript
const agentaos = new AgentaOS('sk_live_...', {
  baseUrl: 'https://api.agentaos.ai', // default
  timeout: 30000,                      // ms, default
  maxRetries: 2,                       // on 5xx, default
  debug: false,                        // log requests to stderr
});
```

> **Backend only** — never use this SDK in browser code. Your API key grants full access to all payments.

---

## Checkouts

Create a checkout session to collect a payment. The customer visits the `checkoutUrl` to pay.

### `checkouts.create(params)`

```typescript
const checkout = await agentaos.checkouts.create({
  // --- Required (if no linkId) ---
  amount: 100.00,           // Amount in currency units
  currency: 'EUR',          // 'EUR' or 'USD'

  // --- Optional: from a payment link template ---
  linkId: 'uuid',           // Create session from existing link (inherits amount/currency)

  // --- Optional: checkout config ---
  description: 'Order #123',
  successUrl: 'https://shop.com/success',    // Redirect after payment (HTTPS)
  cancelUrl: 'https://shop.com/cart',        // "Cancel" link on checkout (HTTPS)
  webhookUrl: 'https://shop.com/webhooks',   // Server notification on payment (HTTPS)
  expiresIn: 1800,                           // Seconds until expiry (300-86400, default 1800)
  taxRateId: 'uuid',                         // Pre-created tax rate UUID

  // --- Optional: pre-populate buyer info ---
  buyerEmail: 'john@example.com',
  buyerName: 'John Doe',
  buyerCompany: 'Acme Corp',
  buyerCountry: 'DE',                        // ISO 3166-1 alpha-2
  buyerAddress: '123 Main St, Berlin',
  buyerVat: 'DE123456789',

  // --- Optional: custom data ---
  metadata: { orderId: '12345', plan: 'pro' },
});
```

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Session UUID |
| `sessionId` | `string` | Public session ID (used in checkout URL) |
| `checkoutUrl` | `string` | URL to send your customer to |
| `status` | `'open' \| 'completed' \| 'expired' \| 'cancelled'` | Current status |
| `amountOverride` | `number \| null` | Amount for this session |
| `currency` | `string` | Settlement currency |
| `expiresAt` | `string` | ISO 8601 expiration time |
| `createdAt` | `string` | ISO 8601 creation time |

### `checkouts.retrieve(sessionId)`

```typescript
const checkout = await agentaos.checkouts.retrieve('mZrESFyR7RC9RPsJfZCVkg');
console.log(checkout.status); // 'open' | 'completed' | 'expired' | 'cancelled'
```

### `checkouts.list(params?)`

```typescript
const checkouts = await agentaos.checkouts.list({
  status: 'completed',  // Filter: 'open' | 'completed' | 'expired' | 'cancelled'
  limit: 10,
  offset: 0,
});
```

### `checkouts.cancel(sessionId)`

```typescript
await agentaos.checkouts.cancel('mZrESFyR7RC9RPsJfZCVkg');
```

---

## Payment Links

Reusable payment templates. Share the `checkoutUrl` — each visitor gets a new session.

### `paymentLinks.create(params)`

```typescript
const link = await agentaos.paymentLinks.create({
  amount: 29.99,
  currency: 'EUR',
  description: 'Monthly subscription',
  successUrl: 'https://shop.com/success',
  cancelUrl: 'https://shop.com/cancel',
  webhookUrl: 'https://shop.com/webhooks',
  taxRateId: 'uuid',
  metadata: { plan: 'basic' },
  expiresAt: '2026-12-31T23:59:59Z',
  checkoutFields: [
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'company', label: 'Company', type: 'text', required: false },
  ],
});

console.log(link.checkoutUrl);
// → https://app.agentaos.ai/pay/7rr6S9ml4BMp829wV5WeAA
```

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Link UUID |
| `checkoutUrl` | `string` | Shareable payment URL |
| `x402Url` | `string` | x402 protocol URL (for agent payments) |
| `amount` | `number` | Payment amount |
| `currency` | `string` | Settlement currency |
| `status` | `'active' \| 'cancelled'` | Link status |
| `paymentCount` | `number` | Times this link has been paid |
| `createdAt` | `string` | ISO 8601 |

### `paymentLinks.retrieve(id)`

```typescript
const link = await agentaos.paymentLinks.retrieve('uuid');
```

### `paymentLinks.list(params?)`

```typescript
const links = await agentaos.paymentLinks.list({ limit: 20, offset: 0 });
```

### `paymentLinks.cancel(id)`

```typescript
await agentaos.paymentLinks.cancel('uuid');
```

---

## Transactions

Unified ledger of all confirmed inbound (received) and outbound (sent) payments.

### `transactions.list(params?)`

```typescript
const txs = await agentaos.transactions.list({
  direction: 'inbound',   // 'all' | 'inbound' | 'outbound'
  from: '2026-03-01',     // ISO 8601 date
  to: '2026-03-31',       // ISO 8601 date
  limit: 50,
  offset: 0,
});
```

**Response item:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Transaction UUID |
| `direction` | `'inbound' \| 'outbound'` | Payment direction |
| `amount` | `number` | Amount in settlement token |
| `paymentToken` | `string` | Token used (e.g. 'USDC') |
| `txHash` | `string \| null` | On-chain transaction hash |
| `network` | `string` | CAIP-2 network (e.g. 'eip155:8453') |
| `payerAddress` | `string` | Sender wallet address |
| `toAddress` | `string \| null` | Recipient (outbound only) |
| `status` | `'confirmed' \| 'pending' \| 'failed'` | Transaction status |
| `createdAt` | `string` | ISO 8601 |

---

## Invoices

Tax-compliant invoice records generated from confirmed payments.

### `invoices.list(params?)`

```typescript
const invoices = await agentaos.invoices.list({
  from: '2026-03-01',
  to: '2026-03-31',
  status: 'issued',        // 'all' | 'issued' | 'voided'
  limit: 50,
});
```

### `invoices.retrieve(id)`

```typescript
const invoice = await agentaos.invoices.retrieve('uuid');
```

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `invoiceNumber` | `string` | e.g. 'INV-2026-0001' |
| `amount` | `number` | Crypto amount |
| `fiatAmount` | `number \| null` | EUR/USD equivalent |
| `fiatCurrency` | `string \| null` | 'EUR' or 'USD' |
| `exchangeRate` | `number \| null` | Rate at settlement time |
| `taxRate` | `number \| null` | Applied tax rate (e.g. 19) |
| `taxAmount` | `number \| null` | Tax amount |
| `taxName` | `string \| null` | e.g. 'DE VAT' |
| `merchantName` | `string \| null` | Your business name |
| `buyerEmail` | `string \| null` | Customer email |
| `status` | `'issued' \| 'voided'` | Invoice status |

### `invoices.void(id)`

```typescript
await agentaos.invoices.void('uuid');
```

### `invoices.downloadPdf(id)`

```typescript
const pdf = await agentaos.invoices.downloadPdf('uuid');
fs.writeFileSync('invoice.pdf', pdf);
```

### `invoices.downloadStatement(params)`

Monthly statement PDF (Wise-style) with balance reconciliation, VAT summary, and transaction ledger.

```typescript
const statement = await agentaos.invoices.downloadStatement({
  from: '2026-03-01',
  to: '2026-03-31',
});
fs.writeFileSync('march-statement.pdf', statement);
```

### `invoices.exportCsv(params?)`

```typescript
const csv = await agentaos.invoices.exportCsv({
  from: '2026-03-01',
  to: '2026-03-31',
  status: 'issued',
});
fs.writeFileSync('invoices.csv', csv);
```

---

## Webhooks

Verify incoming webhook signatures. Uses HMAC-SHA256 with timing-safe comparison.

### `webhooks.verify(payload, signature, secret)`

```typescript
import express from 'express';

app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = agentaos.webhooks.verify(
      req.body,                                    // raw body (string or Buffer)
      req.headers['x-agentaos-signature'] as string, // signature header
      process.env.AGENTAOS_WEBHOOK_SECRET!,        // your webhook secret
    );

    switch (event.type) {
      case 'checkout.session.completed':
        // Payment received
        console.log('Paid:', event.data.amount, event.data.currency);
        console.log('Tx:', event.data.txHash);
        console.log('Session:', event.data.sessionId);
        break;

      case 'send.completed':
        // Outbound send confirmed
        console.log('Sent:', event.data.amount, event.data.token);
        break;

      case 'send.failed':
        // Outbound send failed
        console.log('Failed:', event.data.transactionId);
        break;
    }

    res.sendStatus(200);
  } catch (err) {
    res.status(400).send('Invalid signature');
  }
});
```

**Signature format:** `t=<unix_timestamp>,v1=<hmac_hex>`

**Webhook events:**

| Event | When |
|-------|------|
| `checkout.session.completed` | Payment confirmed on-chain |
| `send.completed` | Outbound send broadcast succeeded |
| `send.failed` | Outbound send broadcast failed |

### `checkout.session.completed` data

| Field | Type | Description |
|-------|------|-------------|
| `linkId` | `string` | Payment link secure ID |
| `sessionId` | `string` | Session ID |
| `amount` | `string` | Amount paid |
| `currency` | `string` | Settlement currency |
| `txHash` | `string` | On-chain transaction hash |
| `payer` | `string` | Payer wallet address |
| `payerType` | `'human' \| 'agent'` | Who paid |
| `network` | `string` | CAIP-2 network |
| `metadata` | `object` | Custom metadata from session |

---

## Error Handling

```typescript
import {
  AgentaOSError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@agentaos/pay';

try {
  await agentaos.checkouts.create({ amount: -1 });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log('Invalid params:', err.message);
  } else if (err instanceof AuthenticationError) {
    console.log('Bad API key:', err.message);
  } else if (err instanceof RateLimitError) {
    console.log('Rate limited, retry after:', err.retryAfter, 'ms');
  } else if (err instanceof NotFoundError) {
    console.log('Not found:', err.message);
  } else if (err instanceof AgentaOSError) {
    console.log('API error:', err.status, err.message);
  }
}
```

| Error | HTTP Status | When |
|-------|-------------|------|
| `AuthenticationError` | 401 | Invalid or expired API key |
| `PermissionError` | 403 | Key can't access this resource |
| `NotFoundError` | 404 | Resource doesn't exist |
| `ValidationError` | 400 | Invalid request params |
| `RateLimitError` | 429 | Too many requests |
| `IdempotencyError` | 409 | Duplicate idempotency key |
| `TimeoutError` | — | Request timed out |
| `ApiError` | 5xx | Server error (auto-retried) |
| `WebhookVerificationError` | — | Invalid webhook signature |

---

## Checkout Flow (Web Shop)

```
Your Server                    AgentaOS                     Customer
──────────                     ────────                     ────────
1. POST checkouts.create()  →
   { amount, successUrl,
     cancelUrl, webhookUrl }
                            ←  { checkoutUrl, sessionId }
2. Redirect customer       →                            →  Opens checkoutUrl
                                                           Connects wallet
                                                           Pays on-chain
                            ←  Webhook: checkout.session.completed
3. Verify webhook
4. Fulfill order
                                                        ←  Redirects to successUrl
```

## Requirements

- Node.js 20+
- ESM only (`"type": "module"`)

## License

Apache-2.0
