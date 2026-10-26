# @agentaos/nextjs

## 0.1.0

### Minor Changes

- [#79](https://github.com/AgentaOS/agentaos/pull/79) [`a82b50f`](https://github.com/AgentaOS/agentaos/commit/a82b50f859480172495cf19c36ab59ffb665d395) Thanks [@PancheI](https://github.com/PancheI)! - New `@agentaos/nextjs`: a `Checkout` route that redirects to a checkout for one of your products (ignores HEAD requests and router prefetches, accepts your own client), and a `Webhooks` route that verifies deliveries, refuses to start without a secret and calls one handler per event. `@agentaos/pay` exports `WebhooksResource`, so webhooks can be verified without an API key.

### Patch Changes

- Updated dependencies [[`a82b50f`](https://github.com/AgentaOS/agentaos/commit/a82b50f859480172495cf19c36ab59ffb665d395)]:
  - @agentaos/pay@2.6.0
