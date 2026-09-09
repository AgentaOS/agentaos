# agentaos (Claude Code plugin)

Merchant-of-record billing for AI agents and SaaS. This plugin gives a coding
agent:

- The AgentaOS MCP server (`agentaos`, hosted at mcp.agentaos.ai) with tools for
  checkouts, subscriptions, customers and receipts, connected with one browser
  approval and no key to paste.
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

The plugin's MCP server is the hosted one at `https://mcp.agentaos.ai/mcp`.
There is no key to paste: in Claude Code type `/mcp`, choose `agentaos`, then
**Authenticate**. An AgentaOS page opens in your browser; pick Test or Live and
press **Approve**. The tools are live in that session and every later one.

The connection is a normal API key on your account, named "Claude Code" under
app.agentaos.ai → Settings → Developers. Revoke it there to disconnect.

Then sign in the CLI itself (separate from the MCP connection, needed for the
`agenta` skill's terminal commands):

```bash
agenta login
```

## Verify it worked

```bash
claude mcp list   # expect "agentaos: https://mcp.agentaos.ai/mcp (HTTP) - Connected"
```

## Headless agents and CI

An agent that cannot open a browser can run the same tools locally over stdio
with a long-lived key instead. Create a test-mode key at app.agentaos.ai →
Settings → Developers, then:

```bash
claude mcp add agentaos-local -e AGENTAOS_GATEWAY_KEY=sk_test_... -- npx -y agentaos
```

## ChatGPT, Claude.ai and other hosted assistants

Hosted assistants cannot run `npx`; they connect over HTTPS instead. Add
`https://mcp.agentaos.ai/mcp` as a custom connector (ChatGPT: Settings →
Connectors; Claude.ai: Customize → Connectors → Add custom connector). An
AgentaOS page opens: pick Test or Live and press **Approve**. The assistant then
has the same `agenta_pay_*` tools as this plugin. To disconnect, revoke the key
on app.agentaos.ai → Developers.

## Docs

- Skill reference: `skills/agentaos/SKILL.md` (source of truth:
  https://agentaos.ai/SKILL.md)
- Full API reference: https://docs.agentaos.ai/llms-full.txt
- Dashboard: https://app.agentaos.ai
