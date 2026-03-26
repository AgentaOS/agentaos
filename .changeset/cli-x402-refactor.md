---
"agentaos": minor
---

Split init into create/import, add x402 CLI commands, add switch

- `agenta sub create` / `agenta sub import` replace `agenta sub init`
- `agenta sub switch` to change active sub-account
- `agenta sub x402 check/discover/fetch` for x402 payment protocol
- `--json` flag on all commands for AI-parseable output
- Non-interactive CLI (no prompts, flags only)
