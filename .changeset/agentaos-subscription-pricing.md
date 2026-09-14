---
"agentaos": minor
---

Six new operations, on both the CLI and the MCP tools (25 in total): `discounts create|list|show|archive` for codes buyers type at checkout, and `subscriptions credit|credits` for credit against a subscriber's next invoice. `subscriptions list --code` shows who one code brought in.
`products create --trial-amount` prices a trial, so a plan can sell "9 for the first 30 days, then 29 a month"; the created plan now says what the trial costs before it renews.
The credit command mints one idempotency key per invocation and reports it under `--json`, so running it twice is two deliberate credits while a network retry inside one call is not.
