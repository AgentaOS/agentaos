# agentaos

The AgentaOS command line tool (`agenta`) and MCP server. Sell digital products with AgentaOS as your merchant of record from your terminal, your CI, or your AI coding agent.

[![npm](https://img.shields.io/npm/v/agentaos)](https://www.npmjs.com/package/agentaos)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org)

AgentaOS sells your product in its own name. It takes the payment, charges the VAT, issues the invoice and pays you out. With this package you create products and plans, go live, and manage subscriptions, discount codes, customers and invoices. Full guides are at [docs.agentaos.ai](https://docs.agentaos.ai/cli/install).

## Install

```bash
npm install -g agentaos
```

The package installs two commands, `agenta` and `agentaos`. They are the same program. It needs Node.js 20 or later.

## Quickstart

```bash
agenta login                     # sign in in your browser
agenta status                    # your account, and what is left before live payments
agenta products create --name "Pro" -a 29 -c EUR --subscription --interval month
```

`products create` prints the buyer link. Share it anywhere: every buyer who opens it gets a checkout.

Your account starts in test mode. To take live payments, submit your business for verification:

```bash
agenta verify declaration        # read the five statements first
agenta verify submit --legal-name "Acme OÜ" --registration-number 16000000 \
  --country EE --street "Narva mnt 5" --city Tallinn \
  --url https://acme.example --accept-declaration
agenta verify status
```

`agenta verify submit --help` lists every field. A sole trader uses `--entity individual` and needs no registration number.

## Commands

`agenta login` opens your browser and stores the session in `~/.agenta/`. Every other command uses that session. `agenta logout` clears it.

Each command below is also an MCP tool with the same inputs and the same output. The tool name is `agenta_` followed by the command words, with underscores: `agenta products create` is `agenta_products_create`. The one exception is `agenta status`, whose tool is `agenta_status_get`.

| Command | What it does |
|---|---|
| **Account** | |
| `agenta status` | Your account and go-live overview. `agenta whoami` is the same command |
| **Audit** | |
| `agenta audit request --url <url>` | Ask for the free Revenue & Pricing Audit of your product page |
| `agenta audit show` | The audit state, and save the report PDF once it exists. `--no-download` returns only the link |
| **Verification** | |
| `agenta verify declaration` | The five statements that `--accept-declaration` attests to |
| `agenta verify submit` | Submit business verification, so you can accept live payments |
| `agenta verify status` | Where the verification is |
| `agenta verify resubmit` | Send the verification back for review after you make the requested changes |
| **Products** | |
| `agenta products create --name <name> -a <price>` | Create a one-time product, or a plan with `--subscription --interval month\|year`. Add `--trial-days <n>`, and `--trial-amount <price>` for a paid trial |
| `agenta products list` | List products and plans |
| **Checkouts** | |
| `agenta pay checkout -a <amount>` | Create a checkout session |
| `agenta pay get <sessionId>` | Read a checkout and its status |
| `agenta pay list` | List checkouts |
| **Subscriptions** | |
| `agenta subscriptions list` | List subscriptions. `--code <code>` shows only the subscribers one discount code brought in |
| `agenta subscriptions cancel <id>` | Cancel at the end of the paid period, or now with `--now` |
| `agenta subscriptions change-plan <id> --to <productId>` | Move a subscription to another plan. `--dry-run` shows the quote only |
| `agenta subscriptions credit <id> -a <amount> --reason <text>` | Give credit that comes off the subscriber's next invoice |
| `agenta subscriptions credits <id>` | Credits given on a subscription, and what is still unspent |
| **Discount codes** | |
| `agenta discounts create --code <code>` | Create a code buyers type at checkout. Use `--percent-off` or `--amount-off`, or neither for a code that only tracks referrals |
| `agenta discounts list` | List discount codes |
| `agenta discounts show <id>` | What one code takes off, and how many subscribers used it |
| `agenta discounts archive <id>` | Stop a code working |
| **Customers and invoices** | |
| `agenta customers list` | List customers |
| `agenta invoices list` | List invoices |
| `agenta invoices receipt <id>` | Save the receipt PDF of a paid invoice. `-o <path>` sets the file |
| `agenta invoices send-receipt <id>` | Send the receipt email to the buyer again |
| **Businesses (platforms, private preview)** | |
| `agenta businesses list` | List the businesses you manage |
| `agenta businesses get <id>` | Show one business you manage |
| `agenta businesses create --name <name> --country <code>` | Add a client's business, or another app of your company with `--same-company`. `--client-email` invites your client as its admin |
| `agenta businesses invite <id>` | Send your client's invitation again, with a new link |
| `agenta businesses revoke-invite <id>` | Withdraw your client's open invitation |
| `agenta businesses id-link <id>` | Get the identity check link for your client |

These options work on every command except `login` and `logout`, which take only `--json`:

| Option | What it does |
|---|---|
| `--json` | Print JSON instead of sentences, for scripts, CI and agents |
| `--business <id>` | Act for a business you manage. Leave it out to act for your own account |
| `--help` | Show the command's options |

Amounts on the command line are in currency units: `-a 29` is 29.00.

## MCP server

The MCP server gives an AI assistant the same 31 operations as the CLI. There are two ways to connect.

### Claude Code plugin

The plugin connects Claude Code to the hosted MCP server and adds a guide to the integration patterns. You approve the connection in your browser, so there is no key to paste.

```bash
claude plugin marketplace add AgentaOS/agentaos
claude plugin install agentaos@agentaos
```

In Claude Code, type `/mcp`, choose `agentaos`, then **Authenticate**.

### Local server over stdio

Any MCP client can run the server from this package. When the program starts with no arguments and without a terminal, it runs as an MCP server over stdio. Create an API key in [app.agentaos.ai](https://app.agentaos.ai) under **Settings → Developers**, then add this to your client's MCP configuration:

```json
{
  "mcpServers": {
    "agentaos": {
      "command": "npx",
      "args": ["-y", "agentaos"],
      "env": {
        "AGENTAOS_GATEWAY_KEY": "sk_test_..."
      }
    }
  }
}
```

Use an `sk_test_` key for test mode and an `sk_live_` key for live mode. The local server authenticates with the API key, so `agenta_subscriptions_credit` does not work there: a credit needs an owner or admin signed in with `agenta login`. See [MCP setup](https://docs.agentaos.ai/mcp/setup) for other clients.

## Environment variables

| Variable | Used by | What it does |
|---|---|---|
| `AGENTAOS_GATEWAY_KEY` | MCP server | The API key the server acts with. Required |
| `AGENTA_SERVER` | CLI and MCP server | The API URL. Default `https://api.agentaos.ai` |

## License

Apache-2.0. See [LICENSE](../../LICENSE).
