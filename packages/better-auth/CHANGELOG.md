# @agentaos/better-auth

## 1.1.0

### Minor Changes

- [#79](https://github.com/AgentaOS/agentaos/pull/79) [`a82b50f`](https://github.com/AgentaOS/agentaos/commit/a82b50f859480172495cf19c36ab59ffb665d395) Thanks [@PancheI](https://github.com/PancheI)! - Webhooks get one handler per event (`onCheckoutCompleted`, `onSubscriptionRenewed`, ...); `onEvent` still runs after the handler. Handlers written as methods keep their `this`. Checkout metadata now includes the product slug, and AgentaOS refusals keep their reason and status instead of an empty 500.

### Patch Changes

- Updated dependencies [[`a82b50f`](https://github.com/AgentaOS/agentaos/commit/a82b50f859480172495cf19c36ab59ffb665d395)]:
  - @agentaos/pay@2.6.0

## 1.0.0

### Major Changes

- [#72](https://github.com/AgentaOS/agentaos/pull/72) [`b9f4a72`](https://github.com/AgentaOS/agentaos/commit/b9f4a72570f4b991869c76baa5d192b5678e6782) Thanks [@PancheI](https://github.com/PancheI)! - First release: Better Auth plugin with checkout for signed-in users, their subscriptions, and verified webhooks.
