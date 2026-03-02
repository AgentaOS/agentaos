---
'@agentaos/core': minor
'@agentaos/crypto': minor
'@agentaos/engine': minor
'@agentaos/chains': minor
'@agentaos/sdk': minor
'agenta': minor
---

Initial public release — threshold ECDSA signing for autonomous agents

- 2-of-3 CGGMP24 threshold signing via Rust WASM (full key never exists)
- Three signing paths: Signer+Server, User+Server, Signer+User
- Rules-based guardrails engine with criterion catalog
- CLI (`gw`): init, send, sign-message, deploy, proxy, admin
- SDK: `ThresholdSigner` with viem `toAccount()` integration
- MCP server for AI assistant signing (Claude, Cursor)
- JSON-RPC proxy for Foundry/Hardhat
