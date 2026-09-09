# @agentaos/pay

## 2.3.0

### Minor Changes

- [#45](https://github.com/AgentaOS/agentaos/pull/45) [`967b34f`](https://github.com/AgentaOS/agentaos/commit/967b34f2a90e20e096ececf2379c980aa562eb8f) Thanks [@PancheI](https://github.com/PancheI)! - Add `goLive.get()` and `accountReview.get/submit/resubmit/requestAudit()` so the CLI and the MCP tools share one client for onboarding.
  Add the `orgId` client option: a session-token user who belongs to several organizations names the one to act for, and it goes on every request as `?orgId=`.
  Export the plan-change types (`PlanChangePreview`, `ChangePlanParams`, `ChangePlanResult`, `PlanChangeDirection`, `PendingPlanChange`) that `subscriptions.previewPlanChange/changePlan` already return.

## 2.2.0

### Minor Changes

- [#35](https://github.com/AgentaOS/agentaos/pull/35) [`5f52799`](https://github.com/AgentaOS/agentaos/commit/5f52799cbb3dea15de80aaf720c5fccb8a08e15b) Thanks [@PancheI](https://github.com/PancheI)! - Add `subscriptions.invoices(id)` and expose `linkId` / cancel fields on `Subscription` so a logged-in SaaS can match a product, list billing history, and cancel.

- [#37](https://github.com/AgentaOS/agentaos/pull/37) [`0b3489a`](https://github.com/AgentaOS/agentaos/commit/0b3489af518ea41a5453949707dc5ddb72a80288) Thanks [@PancheI](https://github.com/PancheI)! - Add `livemode` to webhook payloads and type the subscription webhook events.

  - Every `WebhookEvent` `data` now carries `livemode: boolean` (`true` = live mode, `false` = test mode) — the account-mode signal. This replaces the previous chain-specific `testnet` field, which was meaningless for card/bank rails; use `network` for the chain/rail.
  - New `SubscriptionData` type and five `subscription.*` events on the `WebhookEvent` union: `subscription.created`, `subscription.renewed`, `subscription.payment_failed`, `subscription.updated`, `subscription.canceled`.

### Patch Changes

- [#36](https://github.com/AgentaOS/agentaos/pull/36) [`0d4ab68`](https://github.com/AgentaOS/agentaos/commit/0d4ab68fb7c28fa6002ee96729cef8951ffb78e2) Thanks [@PancheI](https://github.com/PancheI)! - Make `webhooks.verify()` errors self-explaining for the most common integration mistake — passing a parsed body instead of the raw request bytes. A non-string/Buffer payload (e.g. `req.body` after `express.json()`) now throws an actionable message pointing at `express.raw()`, and a genuine signature mismatch asks whether the raw body was used, mirroring Stripe's hint. No change to the verification algorithm.

## 2.1.0

### Minor Changes

- [#33](https://github.com/AgentaOS/agentaos/pull/33) [`defbc16`](https://github.com/AgentaOS/agentaos/commit/defbc16c51e8c8258c6f2f15561ae49026b9a640) Thanks [@PancheI](https://github.com/PancheI)! - Add optional `name` (and `imageUrl`) to `paymentLinks.create`, and expose `name`/`imageUrl` on the `PaymentLink` type.

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
