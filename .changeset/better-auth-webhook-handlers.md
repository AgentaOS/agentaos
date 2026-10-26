---
"@agentaos/better-auth": minor
---

Webhooks get one handler per event (`onCheckoutCompleted`, `onSubscriptionRenewed`, ...); `onEvent` still runs after the handler. Handlers written as methods keep their `this`. Checkout metadata now includes the product slug, and AgentaOS refusals keep their reason and status instead of an empty 500.
