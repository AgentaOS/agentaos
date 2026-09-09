# agentaos (Claude Code plugin)

Merchant-of-record billing for AI agents and SaaS. This plugin gives a coding
agent:

- The AgentaOS MCP server (`agentaos`, hosted at mcp.agentaos.ai) with 19 tools
  covering status, audit, verification, products, checkouts, subscriptions,
  customers and invoices, connected with one browser approval and no key to
  paste.
- A skill (`agenta`) that teaches the agent those tools and the AgentaOS
  integration patterns (frontend-only buy links, server-side paywalls,
  webhooks, trials, plan changes), with the `agenta` CLI as the same
  operations for terminals and CI.

## Tools

| Tool | What it does |
|------|--------------|
| `agenta_status_get` | Account and go-live overview |
| `agenta_audit_request` | Ask for the free Revenue & Pricing Audit |
| `agenta_audit_show` | The audit state, and the report PDF once it exists |
| `agenta_verify_declaration` | The five statements verification attests to |
| `agenta_verify_submit` | Submit business verification so the merchant can accept live payments |
| `agenta_verify_status` | Where the verification has got to |
| `agenta_verify_resubmit` | Send back for review after making the changes we asked for |
| `agenta_products_create` | Create a product (one-time) or a subscription plan |
| `agenta_products_list` | List products and plans |
| `agenta_pay_checkout` | Create a checkout session |
| `agenta_pay_get` | Get checkout session status |
| `agenta_pay_list` | List checkout sessions |
| `agenta_subscriptions_list` | List subscriptions |
| `agenta_subscriptions_cancel` | Cancel a subscription (at period end by default) |
| `agenta_subscriptions_change_plan` | Move a subscription to another plan (upgrade charges now, downgrade at period end) |
| `agenta_customers_list` | List customers |
| `agenta_invoices_list` | List invoices |
| `agenta_invoices_receipt` | The receipt PDF for a paid invoice |
| `agenta_invoices_send_receipt` | Re-send the receipt email to the buyer on file |

Every tool is also a CLI command (`agenta_products_create` = `agenta products
create`) with the same inputs and the same merchant-readable output.

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

The CLI is optional: it is the same 19 operations for a terminal, a headless
agent or CI, signed in separately from the MCP connection:

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
has the same 19 `agenta_*` tools as this plugin. To disconnect, revoke the key
on app.agentaos.ai → Developers.

## Docs

- Skill reference: `skills/agentaos/SKILL.md`
- Full API reference: https://docs.agentaos.ai/llms-full.txt
- Dashboard: https://app.agentaos.ai
