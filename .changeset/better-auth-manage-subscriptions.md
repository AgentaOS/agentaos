---
"@agentaos/better-auth": minor
---

Signed-in users can cancel a subscription at period end (`cancelSubscription`), quote and apply a plan change (`changePlan`) and list a subscription's invoices (`invoices`). Webhooks get one handler per event (`onCheckoutCompleted`, `onSubscriptionRenewed`, ...); `onEvent` still receives every event.
