---
"agentaos": major
"@agentaos/core": major
"@agentaos/crypto": major
"@agentaos/engine": major
"@agentaos/chains": major
"@agentaos/sdk": major
---

Device-code CLI login, MCP payment tools, CLI restructure

- `agenta login` opens browser for authentication + wallet activation
- `agenta pay checkout/get/list` — create and manage payment checkouts
- `agenta sub` namespace — all sub-account commands (init, send, balance, policies, etc.)
- `agenta status` — full account overview with `--json` mode for AI agents
- Non-interactive `agenta sub init --create/--import` with flag-based interface
- Auto-refresh JWT on expiry or scope upgrade
- MCP: 3 new payment tools (create_checkout, get_checkout, list_checkouts) — 21 total
- All commands support `--json` for machine-readable output
