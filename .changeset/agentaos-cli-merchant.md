---
"agentaos": major
---

The `agentaos` / `agenta` CLI is now the merchant's CLI and MCP server for AgentaOS payments.

- Removed the self-custody crypto-wallet surface: `send`, `sign`, `balance`, `receive`, `deploy`, `x402`, signer and network management, and the seventeen token-moving MCP tools. Scripts that relied on them must pin `agentaos@2`.
- The CLI now covers onboarding and money: `login` (browser approval), `status`, `audit`, `verify`, `products`, `pay`, `subscriptions`.
- The MCP server (run the binary with no arguments from an agent) exposes the seven `agenta_pay_*` tools against `AGENTAOS_GATEWAY_KEY`; the same tools are exported as `agentaos/mcp` (`registerPayTools(server, getClient)`) for hosted servers.
- A refused key tells the merchant it may have been revoked in AgentaOS and how to reconnect.
