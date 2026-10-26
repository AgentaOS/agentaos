---
"@agentaos/nextjs": minor
"@agentaos/pay": minor
---

New `@agentaos/nextjs`: a `Checkout` route that redirects to a checkout for one of your products (ignores HEAD requests and router prefetches, accepts your own client), and a `Webhooks` route that verifies deliveries, refuses to start without a secret and calls one handler per event. `@agentaos/pay` exports `WebhooksResource`, so webhooks can be verified without an API key.
