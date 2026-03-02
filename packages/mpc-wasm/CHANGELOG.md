# @agentaos/crypto

## 0.2.1

### Patch Changes

- [`38f76db`](https://github.com/AgentaOS/agentaos/commit/38f76db35c018a97ccebeb87b51be1c4e09c2db4) Thanks [@PancheI](https://github.com/PancheI)! - Fix WASM binaries missing from npm tarball

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
