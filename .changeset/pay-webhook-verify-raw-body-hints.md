---
"@agentaos/pay": patch
---

Make `webhooks.verify()` errors self-explaining for the most common integration mistake — passing a parsed body instead of the raw request bytes. A non-string/Buffer payload (e.g. `req.body` after `express.json()`) now throws an actionable message pointing at `express.raw()`, and a genuine signature mismatch asks whether the raw body was used, mirroring Stripe's hint. No change to the verification algorithm.
