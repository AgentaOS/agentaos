# @agentaos/checkout

## 0.1.1

### Patch Changes

- [#64](https://github.com/AgentaOS/agentaos/pull/64) [`94de2d2`](https://github.com/AgentaOS/agentaos/commit/94de2d21d48377e1e1828527f21e276ea929f95b) Thanks [@PancheI](https://github.com/PancheI)! - The npm pages now link to agentaos.ai (the CLI to the Claude Code setup page, the SDK to the docs, the checkout to the embedded checkout guide) instead of the GitHub repo.

## 0.1.0

### Minor Changes

- [#48](https://github.com/AgentaOS/agentaos/pull/48) [`32afd60`](https://github.com/AgentaOS/agentaos/commit/32afd601a85d2b26927784883450c366ee8fa7f9) Thanks [@PancheI](https://github.com/PancheI)! - New package: the AgentaOS checkout on your own page — inline or overlay. `loadAgentaOS()` loads the checkout script once (SSR-safe), typed options and events (`checkout.loaded`, `checkout.completed`, `checkout.closed`, `checkout.error`), and `@agentaos/checkout/react` with `<AgentaOSCheckout>` and `useAgentaOSCheckout()`.
