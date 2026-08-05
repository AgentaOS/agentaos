---
"@agentaos/pay": minor
---

Support the new gateway API surface (additive).

**New request fields**
- `type: 'one_time' | 'subscription'` + `billingInterval: 'month' | 'year'` on `paymentLinks.create` for recurring links (`billingInterval` is required when `type` is `'subscription'`, forbidden otherwise; subscriptions require a Merchant-of-Record account, i.e. a verified business).
- `dueDate` (YYYY-MM-DD) on `checkouts.create` for invoice-authored sessions.

**Seller mode is now server-derived — not a parameter.** How a link/checkout settles (`'mor'` = card + bank via Merchant of Record, `'crypto'` = on-chain to your wallet) is derived from your account (Merchant of Record once your business is verified, otherwise on-chain to the wallet on file). It is no longer a create parameter; the resolved value is returned on the response for rendering.

**New response fields**
- `PaymentLink`: `sellerMode`, `type`, `billingInterval`.
- `Checkout`: `sellerMode`, `invoiceId`, `invoiceNumber`.

**API migration note for raw-HTTP integrations (not SDK users).** `POST /payment-links` no longer accepts `acceptsWallet` / `acceptsSepa` — the whitelist rejects them with a 400. Seller mode is derived from the account; the `accepts_wallet` / `accepts_sepa` response keys are replaced by `sellerMode`. The published SDK never sent or read those fields.
