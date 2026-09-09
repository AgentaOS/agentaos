# agentaos (Claude Code plugin)

Merchant-of-record billing for AI agents and SaaS. This plugin gives a coding
agent:

- An MCP server (`agentaos`) with tools for products, checkouts, subscriptions,
  customers, and invoices, backed by the AgentaOS API.
- A skill (`agenta`) that teaches the agent the `agenta` CLI and the
  AgentaOS integration patterns (frontend-only buy links, server-side paywalls,
  webhooks, subscriptions).

## Install

```bash
claude plugin marketplace add AgentaOS/agentaos
claude plugin install agentaos@agentaos
```

(`claude plugins marketplace add …` / `claude plugins install …` also work —
`plugin`/`plugins` are aliases of the same command in the Claude Code CLI.)

## After installing

The MCP server runs via `npx -y agentaos` and needs an AgentaOS API key in the
`AGENTAOS_GATEWAY_KEY` environment variable (read by
`packages/wallet/src/mcp/tools/pay-utils.ts` in this repo). Get a test-mode key
from app.agentaos.ai → Settings → Developers → API Keys, then either:

**Export it in your shell profile** (the plugin's `.mcp.json` reads
`${AGENTAOS_GATEWAY_KEY}` from your environment):

```bash
export AGENTAOS_GATEWAY_KEY=sk_test_...
```

**Or, if `${VAR}` expansion does not pick it up** (there is a known upstream
issue with environment variable expansion inside a plugin-root `.mcp.json`;
see anthropics/claude-code#9427), add the server directly with the key baked
into your local (never committed) Claude Code config instead:

```bash
claude mcp add agentaos -e AGENTAOS_GATEWAY_KEY=sk_test_... -- npx -y agentaos
```

Then sign in the CLI itself (separate from the MCP key, needed for the `agenta`
skill's terminal commands):

```bash
agenta login
```

## Verify it worked

```bash
claude mcp list   # expect an "agentaos" server, connected
```

## Docs

- Skill reference: `skills/agentaos/SKILL.md` (source of truth:
  https://agentaos.ai/SKILL.md)
- Full API reference: https://docs.agentaos.ai/llms-full.txt
- Dashboard: https://app.agentaos.ai
