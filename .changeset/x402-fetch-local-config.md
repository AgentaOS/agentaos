---
"agentaos": patch
---

x402 fetch falls back to local signer config

- `agenta sub x402 fetch` no longer requires `AGENTA_API_SECRET` env var when the secret is already saved locally from `agenta sub create`
- `SignerManager` checks env vars first (MCP/CI), then falls back to `~/.agenta/signers/` config (CLI)
