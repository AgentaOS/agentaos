---
"@agentaos/migrate": minor
---

New package: `npx @agentaos/migrate --from <paddle|lemonsqueezy|creem|gumroad>` moves products, plans, trials and discount codes to AgentaOS (dry run by default, `--apply` to create), lists active subscribers with their renewal date and new link, and writes a report with redirects and a subscriber email. The old account is only read. Plus an `agentaos-migrate` skill in the Claude plugin.
