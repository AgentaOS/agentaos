# @agentaos/pay

## 2.5.0

### Minor Changes

- [#53](https://github.com/AgentaOS/agentaos/pull/53) [`3d0e102`](https://github.com/AgentaOS/agentaos/commit/3d0e102164c9f90086dc7e0a421401b5f057dacd) Thanks [@PancheI](https://github.com/PancheI)! - `bankAccounts`: a platform saves bank accounts for the businesses it manages, from its own app, once we have opened bank accounts by API for it. `requirements(currency)`, `refreshRequirements(params)`, `create(params)`, `list()`, `deactivate(id)`, each taking `{ business }`. Adding and retiring need the switch and a live key; the other calls do not.

  `platformFee.fixedDisplay` on a business's share: the fixed part of the platform fee, printed as money.

### Patch Changes

- [#53](https://github.com/AgentaOS/agentaos/pull/53) [`3d0e102`](https://github.com/AgentaOS/agentaos/commit/3d0e102164c9f90086dc7e0a421401b5f057dacd) Thanks [@PancheI](https://github.com/PancheI)! - `agenta status` no longer says live money waits on a payout account. A verified business can take live payments; the bank account we pay into is needed before the first payout. The next step now reads "add a bank account in the dashboard (Balances → Payout accounts) before your first payout".

## 2.4.0

### Minor Changes

- [#48](https://github.com/AgentaOS/agentaos/pull/48) [`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9) Thanks [@PancheI](https://github.com/PancheI)! - Connect — manage your clients' businesses and act for them, the way Stripe Connect does.
  Add `businesses.list/retrieve/create/resendInvitation/revokeInvitation/createVerificationLink()`. `create` invites your client as admin and returns `inviteUrl`; pass `sendInvitationEmail: false` to send it yourself (white-label). `createVerificationLink` is the identity check link only your client can complete (Stripe's Account Links).
  Act for a business with `new AgentaOS(key, { business })` or `{ business }` as the last argument of any call — sent as `AgentaOS-Account` (Stripe's `Stripe-Account`).
  `WebhookEvent` now lists every event we send — adds `dispute.created`, `dispute.closed`, `account.updated` and `webhook.test` — and each carries `business`: the business it happened in.
  Fix: a call answered with 204 No Content resolves instead of failing.

- [#48](https://github.com/AgentaOS/agentaos/pull/48) [`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9) Thanks [@PancheI](https://github.com/PancheI)! - Add `discountCodes.create/list/get/archive()`: codes a buyer types at checkout on a subscription plan, including tracking-only codes that change no price and exist to record who a referral brought in. `subscriptions.list({ discountCode })` filters by one, and every `Subscription` now carries the `discount` it was bought with.
  Add `subscriptions.credit(id, params)` and `subscriptions.credits(id)`: credit against a subscriber's next invoice. `idempotencyKey` is a required parameter, not an optional one — there is no local record of a credit for the server to recognise a repeat by, so a retry without the caller's own key credits twice.
  Add `trialAmount` to `paymentLinks.create()` and to `PaymentLink`, so a plan can sell a paid trial ("9 for the first 30 days, then 29 a month") instead of only a free one.

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
