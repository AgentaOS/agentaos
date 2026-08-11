# @agentaos/pay

## 2.0.0

### Major Changes

- [#32](https://github.com/AgentaOS/agentaos/pull/32)
  [`a161935`](https://github.com/AgentaOS/agentaos/commit/a16193567d0a9223f5463394149d1d07bea93b83)
  Thanks [@PancheI](https://github.com/PancheI)! - 2.0.0 — target the new
  server-owned gateway API.

  This release targets the new AgentaOS API generation and requires it. Seller
  mode is now DERIVED AND OWNED BY THE SERVER — never a client input: the SDK
  sends no seller mode and reads the resolved value off responses for display.

  **BREAKING (for raw-HTTP integrations — existing SDK callers upgrade
  cleanly).** `POST /payment-links` no longer accepts `acceptsWallet` /
  `acceptsSepa` (or a client-supplied seller mode) — it returns a 400. Seller
  mode is derived from the account (Merchant of Record once the business is
  verified, otherwise on-chain to the wallet on file). The published SDK never
  sent those fields, so SDK/CLI callers are unaffected on the wire; the major
  bump reflects that 2.x targets the new API.

  **New surface**

  - Subscription payment links: `type: 'one_time' | 'subscription'` +
    `billingInterval` on `paymentLinks.create` (subscriptions require a
    verified/MoR account).
  - `dueDate` on `checkouts.create` for invoice-authored sessions.
  - Response fields: `sellerMode`, `type`, `billingInterval` on `PaymentLink`;
    `sellerMode`, `invoiceId`, `invoiceNumber` on `Checkout`.

  **Management / read surface** (mirrors the dashboard — subscriptions are
  created by buyers on the hosted checkout, never by the SDK):

  - `subscriptions.list()` and `subscriptions.cancel(id, { atPeriodEnd })`
    (defaults to cancel-at-period-end; no refund).
  - `customers.list()`.
  - `invoices.getReceipt(id)` (receipt PDF) and `invoices.sendReceipt(id)`.
  - CLI parity: `agenta subscriptions list|cancel`, `agenta customers list`.

  **Pagination:** every `list()` returns a `{ items, total, hasMore }` envelope
  (uniform across payment links, checkouts, transactions, invoices, customers,
  and subscriptions) — read results off `.items`.

## 1.0.1

### Patch Changes

- [#16](https://github.com/AgentaOS/agentaos/pull/16)
  [`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c)
  Thanks [@PancheI](https://github.com/PancheI)! - Add supportedNetworks to
  CreateCheckoutParams, dual auth (JWT + API key) support

## 1.0.0

### Major Changes

- [#9](https://github.com/AgentaOS/agentaos/pull/9)
  [`cb90955`](https://github.com/AgentaOS/agentaos/commit/cb90955c60192b6bd3ed7c1f70563f3c6baafcb9)
  Thanks [@PancheI](https://github.com/PancheI)! - Accept regulated stablecoin
  payments programmatically
