# @agentaos/engine

## 1.0.0

### Major Changes

- [#16](https://github.com/AgentaOS/agentaos/pull/16) [`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c) Thanks [@PancheI](https://github.com/PancheI)! - Device-code CLI login, MCP payment tools, CLI restructure

  - `agenta login` opens browser for authentication + wallet activation
  - `agenta pay checkout/get/list` — create and manage payment checkouts
  - `agenta sub` namespace — all sub-account commands (init, send, balance, policies, etc.)
  - `agenta status` — full account overview with `--json` mode for AI agents
  - Non-interactive `agenta sub init --create/--import` with flag-based interface
  - Auto-refresh JWT on expiry or scope upgrade
  - MCP: 3 new payment tools (create_checkout, get_checkout, list_checkouts) — 21 total
  - All commands support `--json` for machine-readable output

### Patch Changes

- Updated dependencies [[`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c)]:
  - @agentaos/core@1.0.0
  - @agentaos/crypto@1.0.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`38f76db`](https://github.com/AgentaOS/agentaos/commit/38f76db35c018a97ccebeb87b51be1c4e09c2db4)]:
  - @agentaos/crypto@0.2.1
  - @agentaos/core@0.2.1

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
  - @agentaos/crypto@0.2.0
