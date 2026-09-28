---
"@agentaos/pay": minor
---

Add `discountCodes.create/list/get/archive()`: codes a buyer types at checkout on a subscription plan, including tracking-only codes that change no price and exist to record who a referral brought in. `subscriptions.list({ discountCode })` filters by one, and every `Subscription` now carries the `discount` it was bought with.
Add `subscriptions.credit(id, params)` and `subscriptions.credits(id)`: credit against a subscriber's next invoice. `idempotencyKey` is a required parameter, not an optional one — there is no local record of a credit for the server to recognise a repeat by, so a retry without the caller's own key credits twice.
Add `trialAmount` to `paymentLinks.create()` and to `PaymentLink`, so a plan can sell a paid trial ("9 for the first 30 days, then 29 a month") instead of only a free one.
