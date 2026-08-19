---
"@agentaos/pay": minor
---

Add `livemode` to webhook payloads and type the subscription webhook events.

- Every `WebhookEvent` `data` now carries `livemode: boolean` (`true` = live mode, `false` = test mode) — the account-mode signal. This replaces the previous chain-specific `testnet` field, which was meaningless for card/bank rails; use `network` for the chain/rail.
- New `SubscriptionData` type and five `subscription.*` events on the `WebhookEvent` union: `subscription.created`, `subscription.renewed`, `subscription.payment_failed`, `subscription.updated`, `subscription.canceled`.
