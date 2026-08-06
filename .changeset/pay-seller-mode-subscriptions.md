---
"@agentaos/pay": major
---

2.0.0 — target the new server-owned gateway API.

This release targets the new AgentaOS API generation and requires it. Seller mode
is now DERIVED AND OWNED BY THE SERVER — never a client input: the SDK sends no
seller mode and reads the resolved value off responses for display.

**BREAKING (for raw-HTTP integrations — existing SDK callers upgrade cleanly).**
`POST /payment-links` no longer accepts `acceptsWallet` / `acceptsSepa` (or a
client-supplied seller mode) — it returns a 400. Seller mode is derived from the
account (Merchant of Record once the business is verified, otherwise on-chain to
the wallet on file). The published SDK never sent those fields, so SDK/CLI callers
are unaffected on the wire; the major bump reflects that 2.x targets the new API.

**New surface**
- Subscription payment links: `type: 'one_time' | 'subscription'` + `billingInterval`
  on `paymentLinks.create` (subscriptions require a verified/MoR account).
- `dueDate` on `checkouts.create` for invoice-authored sessions.
- Response fields: `sellerMode`, `type`, `billingInterval` on `PaymentLink`;
  `sellerMode`, `invoiceId`, `invoiceNumber` on `Checkout`.

**Management / read surface** (mirrors the dashboard — subscriptions are created by
buyers on the hosted checkout, never by the SDK):
- `subscriptions.list()` and `subscriptions.cancel(id, { atPeriodEnd })`
  (defaults to cancel-at-period-end; no refund).
- `customers.list()`.
- `invoices.getReceipt(id)` (receipt PDF) and `invoices.sendReceipt(id)`.
- CLI parity: `agenta subscriptions list|cancel`, `agenta customers list`.
