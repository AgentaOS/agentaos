# @agentaos/migrate

## 0.2.0

### Minor Changes

- [#76](https://github.com/AgentaOS/agentaos/pull/76) [`74d44c0`](https://github.com/AgentaOS/agentaos/commit/74d44c08f1f29d01ba0dbe7bffd7a2a8ad17d5b7) Thanks [@PancheI](https://github.com/PancheI)! - New package: `npx @agentaos/migrate --from <paddle|lemonsqueezy|creem|gumroad>` moves products, plans, trials and discount codes to AgentaOS (dry run by default, `--apply` to create), lists active subscribers with their renewal date and new link, and writes a report with redirects and a subscriber email. The old account is only read. Plus an `agentaos-migrate` skill in the Claude plugin.
