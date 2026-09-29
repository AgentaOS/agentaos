# agentaos

## 3.2.0

### Minor Changes

- [#48](https://github.com/AgentaOS/agentaos/pull/48) [`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9) Thanks [@PancheI](https://github.com/PancheI)! - Connect — `agenta businesses list | get | create | invite | revoke-invite | id-link` for the businesses you manage (your clients' businesses and your other apps), and `--business <id>` on every command to act as one of them (`agenta products create … --business <id>`). The MCP server has the same six `agenta_businesses_*` tools and an optional `business` input on every tool.

- [#48](https://github.com/AgentaOS/agentaos/pull/48) [`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9) Thanks [@PancheI](https://github.com/PancheI)! - Six new operations, on both the CLI and the MCP tools (25 in total): `discounts create|list|show|archive` for codes buyers type at checkout, and `subscriptions credit|credits` for credit against a subscriber's next invoice. `subscriptions list --code` shows who one code brought in.
  `products create --trial-amount` prices a trial, so a plan can sell "9 for the first 30 days, then 29 a month"; the created plan now says what the trial costs before it renews.
  The credit command mints one idempotency key per invocation and reports it under `--json`, so running it twice is two deliberate credits while a network retry inside one call is not.

### Patch Changes

- Updated dependencies [[`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9), [`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9)]:
  - @agentaos/pay@2.4.0

## 3.1.0

### Minor Changes

- [#45](https://github.com/AgentaOS/agentaos/pull/45) [`967b34f`](https://github.com/AgentaOS/agentaos/commit/967b34f2a90e20e096ececf2379c980aa562eb8f) Thanks [@PancheI](https://github.com/PancheI)! - The CLI and the MCP server are one operations catalogue: every command is a tool (19), with merchant-readable output on both. New tools: status, audit, verify, products, invoices; `registerAgentaTools` (alias `registerPayTools`).

### Patch Changes

- Updated dependencies [[`967b34f`](https://github.com/AgentaOS/agentaos/commit/967b34f2a90e20e096ececf2379c980aa562eb8f)]:
  - @agentaos/pay@2.3.0

## 3.0.0

### Major Changes

- [#41](https://github.com/AgentaOS/agentaos/pull/41) [`828f3eb`](https://github.com/AgentaOS/agentaos/commit/828f3ebe6d113c2aeb3cc3c5d6dcc17b10b8ea61) Thanks [@PancheI](https://github.com/PancheI)! - The `agentaos` / `agenta` CLI is now the merchant's CLI and MCP server for AgentaOS payments.

  - Removed the self-custody crypto-wallet surface: `send`, `sign`, `balance`, `receive`, `deploy`, `x402`, signer and network management, and the seventeen token-moving MCP tools. Scripts that relied on them must pin `agentaos@2`.
  - The CLI now covers onboarding and money: `login` (browser approval), `status`, `audit`, `verify`, `products`, `pay`, `subscriptions`.
  - The MCP server (run the binary with no arguments from an agent) exposes the seven `agenta_pay_*` tools against `AGENTAOS_GATEWAY_KEY`; the same tools are exported as `agentaos/mcp` (`registerPayTools(server, getClient)`) for hosted servers.
  - A refused key tells the merchant it may have been revoked in AgentaOS and how to reconnect.

### Patch Changes

- Updated dependencies [[`5f52799`](https://github.com/AgentaOS/agentaos/commit/5f52799cbb3dea15de80aaf720c5fccb8a08e15b), [`0b3489a`](https://github.com/AgentaOS/agentaos/commit/0b3489af518ea41a5453949707dc5ddb72a80288), [`0d4ab68`](https://github.com/AgentaOS/agentaos/commit/0d4ab68fb7c28fa6002ee96729cef8951ffb78e2)]:
  - @agentaos/pay@2.2.0

## 2.0.0

### Major Changes

- [#32](https://github.com/AgentaOS/agentaos/pull/32)
  [`fc672b8`](https://github.com/AgentaOS/agentaos/commit/fc672b802997174b6e79ceed7f4cc77de5dc3e27)
  Thanks [@PancheI](https://github.com/PancheI)! - 2.0.0 — unified AgentaOS 2.0.
  Add subscription/customer/invoice management to the CLI and MCP server,
  mirroring the @agentaos/pay 2.0 management surface

  - `agenta subscriptions list` / `agenta subscriptions cancel <id>` — list and
    cancel subscriptions (cancel at period end by default, `--now` for
    immediate)
  - `agenta customers list` — list customers who have paid you
  - `agenta invoices list` / `agenta invoices receipt <id>` /
    `agenta invoices send-receipt <id>` — list invoices, download a receipt PDF,
    re-send the receipt email
  - New MCP tools: `agenta_pay_list_subscriptions`,
    `agenta_pay_cancel_subscription`, `agenta_pay_list_customers`,
    `agenta_pay_send_receipt`

### Patch Changes

- Updated dependencies
  [[`a161935`](https://github.com/AgentaOS/agentaos/commit/a16193567d0a9223f5463394149d1d07bea93b83)]:
  - @agentaos/pay@2.0.0
  - @agentaos/core@2.0.0
  - @agentaos/engine@2.0.0
  - @agentaos/sdk@2.0.0

## 1.2.0

### Patch Changes

- Updated dependencies
  [[`7affbd4`](https://github.com/AgentaOS/agentaos/commit/7affbd4509e606a08c0910e59f3325ecbe491257)]:
  - @agentaos/core@1.2.0
  - @agentaos/engine@1.2.0
  - @agentaos/sdk@1.2.0

## 1.1.1

### Patch Changes

- [#22](https://github.com/AgentaOS/agentaos/pull/22)
  [`1c3b97c`](https://github.com/AgentaOS/agentaos/commit/1c3b97cab3c6a8c6d2d14f8c78585f62be560959)
  Thanks [@PancheI](https://github.com/PancheI)! - x402 fetch falls back to
  local signer config

  - `agenta sub x402 fetch` no longer requires `AGENTA_API_SECRET` env var when
    the secret is already saved locally from `agenta sub create`
  - `SignerManager` checks env vars first (MCP/CI), then falls back to
    `~/.agenta/signers/` config (CLI)

- Updated dependencies []:
  - @agentaos/core@1.1.1
  - @agentaos/engine@1.1.1
  - @agentaos/sdk@1.1.1

## 1.1.0

### Minor Changes

- [#19](https://github.com/AgentaOS/agentaos/pull/19)
  [`62ad7d8`](https://github.com/AgentaOS/agentaos/commit/62ad7d8e46c760527cd740d31d85a652e4606473)
  Thanks [@PancheI](https://github.com/PancheI)! - Split init into
  create/import, add x402 CLI commands, add switch

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

- [#16](https://github.com/AgentaOS/agentaos/pull/16)
  [`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c)
  Thanks [@PancheI](https://github.com/PancheI)! - Device-code CLI login, MCP
  payment tools, CLI restructure

  - `agenta login` opens browser for authentication + wallet activation
  - `agenta pay checkout/get/list` — create and manage payment checkouts
  - `agenta sub` namespace — all sub-account commands (init, send, balance,
    policies, etc.)
  - `agenta status` — full account overview with `--json` mode for AI agents
  - Non-interactive `agenta sub init --create/--import` with flag-based
    interface
  - Auto-refresh JWT on expiry or scope upgrade
  - MCP: 3 new payment tools (create_checkout, get_checkout, list_checkouts) —
    21 total
  - All commands support `--json` for machine-readable output

### Patch Changes

- Updated dependencies
  [[`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c),
  [`beb6eea`](https://github.com/AgentaOS/agentaos/commit/beb6eeaa1d0a0cfa8df5d42b511b305913e0ec1c)]:
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

- [`f3a9ebd`](https://github.com/AgentaOS/agentaos/commit/f3a9ebde8594353a8cb416e99c481abc2af71959)
  Thanks [@PancheI](https://github.com/PancheI)! - Initial public release —
  threshold ECDSA signing for autonomous agents

  - 2-of-3 CGGMP24 threshold signing via Rust WASM (full key never exists)
  - Three signing paths: Signer+Server, User+Server, Signer+User
  - Rules-based guardrails engine with criterion catalog
  - CLI (`agenta`): init, send, sign-message, deploy, proxy, admin
  - SDK: `ThresholdSigner` with viem `toAccount()` integration
  - MCP server for AI assistant signing (Claude, Cursor)
  - JSON-RPC proxy for Foundry/Hardhat

### Patch Changes

- Updated dependencies
  [[`f3a9ebd`](https://github.com/AgentaOS/agentaos/commit/f3a9ebde8594353a8cb416e99c481abc2af71959)]:
  - @agentaos/core@0.2.0
  - @agentaos/engine@0.2.0
  - @agentaos/sdk@0.2.0
