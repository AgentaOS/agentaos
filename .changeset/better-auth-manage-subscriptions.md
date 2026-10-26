---
"@agentaos/better-auth": minor
---

Signed-in users can manage the subscriptions they bought: `cancelSubscription` (at period end), `previewPlanChange` and `changePlan` (quoted again on the server when applied) and `invoices`. Ownership is recorded from the signed webhook in a new `agentaosSubscription` table, keyed on the user who started the checkout, not on email; run `npx @better-auth/cli migrate`. Cancel and plan changes check the session against the database. AgentaOS refusals keep their reason and status. Webhooks get one handler per event (`onCheckoutCompleted`, `onSubscriptionRenewed`, ...) with the owner as `userId`; `onEvent` still runs after the handler. Checkout metadata now includes the product slug. Requires better-auth 1.3.10 or later.
