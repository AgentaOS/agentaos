# @agentaos/sdk

## 0.2.0

### Minor Changes

- [`f3a9ebd`](https://github.com/AgentaOS/agentaos/commit/f3a9ebde8594353a8cb416e99c481abc2af71959) Thanks [@PancheI](https://github.com/PancheI)! - Initial public release — threshold ECDSA signing for autonomous agents

  - 2-of-3 CGGMP24 threshold signing via Rust WASM (full key never exists)
  - Three signing paths: Signer+Server, User+Server, Signer+User
  - Rules-based guardrails engine with criterion catalog
  - CLI (`agenta`): init, send, sign-message, deploy, proxy, admin
  - SDK: `ThresholdSigner` with viem `toAccount()` integration
  - MCP server for AI assistant signing (Claude, Cursor)
  - JSON-RPC proxy for Foundry/Hardhat

### Patch Changes

- Updated dependencies [[`f3a9ebd`](https://github.com/AgentaOS/agentaos/commit/f3a9ebde8594353a8cb416e99c481abc2af71959)]:
  - @agentaos/core@0.2.0
  - @agentaos/engine@0.2.0
