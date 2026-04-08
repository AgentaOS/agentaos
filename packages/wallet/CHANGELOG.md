# agentaos

## 1.2.0

### Patch Changes

- Updated dependencies [[`7affbd4`](https://github.com/AgentaOS/agentaos/commit/7affbd4509e606a08c0910e59f3325ecbe491257)]:
  - @agentaos/core@1.2.0
  - @agentaos/engine@1.2.0
  - @agentaos/sdk@1.2.0

## 1.1.1

### Patch Changes

- [#22](https://github.com/AgentaOS/agentaos/pull/22) [`1c3b97c`](https://github.com/AgentaOS/agentaos/commit/1c3b97cab3c6a8c6d2d14f8c78585f62be560959) Thanks [@PancheI](https://github.com/PancheI)! - x402 fetch falls back to local signer config

  - `agenta sub x402 fetch` no longer requires `AGENTA_API_SECRET` env var when the secret is already saved locally from `agenta sub create`
  - `SignerManager` checks env vars first (MCP/CI), then falls back to `~/.agenta/signers/` config (CLI)

- Updated dependencies []:
  - @agentaos/core@1.1.1
  - @agentaos/engine@1.1.1
  - @agentaos/sdk@1.1.1

## 1.1.0

### Minor Changes

- [#19](https://github.com/AgentaOS/agentaos/pull/19) [`62ad7d8`](https://github.com/AgentaOS/agentaos/commit/62ad7d8e46c760527cd740d31d85a652e4606473) Thanks [@PancheI](https://github.com/PancheI)! - Split init into create/import, add x402 CLI commands, add switch

  - `agenta sub create` / `agenta sub import` replace `agenta sub init`
  - `agenta sub switch` to change active sub-account
  - `agenta sub x402 check/discover/fetch` for x402 payment protocol
  - `--json` flag on all commands for AI-parseable output
  - Non-interactive CLI (no prompts, flags only)

### Patch Changes

- Updated dependencies []:
  - @agentaos/core@1.1.0
  - @agentaos/engine@1.1.0
  - @agentaos/sdk@1.1.0

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

- Updated dependencies [[`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c), [`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c)]:
  - @agentaos/core@1.0.0
  - @agentaos/engine@1.0.0
  - @agentaos/sdk@1.0.0
  - @agentaos/pay@1.0.1

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @agentaos/engine@0.2.1
  - @agentaos/sdk@0.2.1
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
  - @agentaos/engine@0.2.0
  - @agentaos/sdk@0.2.0
