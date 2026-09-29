<div align="center">

# AgentaOS

### Turn your users into paying customers

The growth merchant of record for founders who sell digital products.

[![npm](https://img.shields.io/npm/v/@agentaos/pay?label=%40agentaos%2Fpay)](https://www.npmjs.com/package/@agentaos/pay)
[![npm](https://img.shields.io/npm/v/agentaos?label=agenta%20CLI)](https://www.npmjs.com/package/agentaos)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](LICENSE)

[Website](https://agentaos.ai) · [Docs](https://docs.agentaos.ai) · [Quickstart](https://docs.agentaos.ai/getting-started/quickstart) · [SDK](packages/pay) · [CLI](packages/wallet)

</div>

## What AgentaOS does

AgentaOS sells your product in its own name, as the merchant of record. For each sale, AgentaOS:

- takes the payment by card, or by bank transfer on EUR sales.
- charges the VAT that applies to the buyer.
- issues the invoice and sends the receipt.
- pays you out to your bank account. Stablecoin payouts are in public preview.

The same account also gives you:

- subscriptions with trials, plan changes and credits.
- discount codes, including codes that only track who a referral brought in.
- invoices, receipts and a customer list.
- a checkout you can embed on your own page.
- platforms, to run billing for your clients' businesses (private preview).

Your account starts in test mode. Verify your business to take live payments.

## Start selling

Sign up at [app.agentaos.ai](https://app.agentaos.ai), or start from the terminal:

```bash
npm install -g agentaos
agenta login
agenta products create --name "Pro" -a 29 -c EUR --subscription --interval month
```

The last command prints the product's buyer link. Share the link anywhere: every buyer who opens it gets a checkout.

To start a checkout from your own server, use the SDK:

```bash
npm install @agentaos/pay
```

```typescript
import { AgentaOS } from '@agentaos/pay';

const agentaos = new AgentaOS(process.env.AGENTAOS_API_KEY!);

const checkout = await agentaos.checkouts.create({
  amount: 49,
  currency: 'EUR',
  description: 'Pro plan',
  successUrl: 'https://example.com/welcome',
});

// Send the buyer to checkout.checkoutUrl
```

The [quickstart](https://docs.agentaos.ai/getting-started/quickstart) takes you from sign-up to the first paid sale.

## Set up billing with your AI coding agent

The Claude Code plugin gives your coding agent the AgentaOS tools and a guide to the integration patterns:

```bash
claude plugin marketplace add AgentaOS/agentaos
claude plugin install agentaos@agentaos
```

In Claude Code, type `/mcp`, choose `agentaos`, then **Authenticate**. You approve the connection in your browser, so there is no key to paste.

Other MCP clients can run the MCP server from the `agentaos` package. It has 31 tools, the same operations as the CLI. See [MCP setup](https://docs.agentaos.ai/mcp/setup).

## Embed the checkout on your page

The embedded checkout shows your product's checkout inline, or as an overlay. Card, bank transfer, trials, discount codes and VAT work the same as on the hosted checkout.

```html
<script src="https://app.agentaos.ai/v1/agentaos.js"></script>
<div id="checkout"></div>
<script>
  AgentaOS.checkout.open({
    link: 'https://app.agentaos.ai/pay/<your-product-link>',
    target: '#checkout',
  });
</script>
```

Add your site under **Settings → Developers → Approved sites** first. See [Embedded checkout](https://docs.agentaos.ai/payments/embedded-checkout).

## Packages

| Package | What it is | Docs |
|---|---|---|
| [`@agentaos/pay`](packages/pay) | TypeScript SDK for your server: checkouts, products, subscriptions, discount codes, customers, invoices, webhooks | [SDK overview](https://docs.agentaos.ai/sdk/pay-overview) |
| [`agentaos`](packages/wallet) | The `agenta` CLI and the MCP server, one command per operation | [CLI install](https://docs.agentaos.ai/cli/install) |
| [`@agentaos/checkout`](packages/checkout) | The embedded checkout for the browser, with React support. Not on npm yet: use the script tag above | [Embedded checkout](https://docs.agentaos.ai/payments/embedded-checkout) |
| [`plugins/agentaos`](plugins/agentaos) | The Claude Code plugin | [MCP setup](https://docs.agentaos.ai/mcp/setup) |
| [`packages/mcp-remote`](packages/mcp-remote) | The hosted MCP server at `mcp.agentaos.ai`, for assistants that connect over the web | [MCP setup](https://docs.agentaos.ai/mcp/setup) |

To run billing for other businesses from one account, see [Build a platform](https://docs.agentaos.ai/guides/build-a-platform).

## Example

[`examples/paywall-demo`](examples/paywall-demo) is a small Express app with a paid Pro plan behind a login. It creates the checkout, confirms the payment, verifies the webhook and checks access.

## Also in this repository

The agent wallet packages (`core`, `signer`, `schemes`, `chains` and `mpc-wasm`) are an on-chain wallet that an AI agent operates, with threshold signing so that no single party holds the full key. The agent wallet is in private preview. See [Agent wallet](https://docs.agentaos.ai/experimental/agent-wallet) and the [paper](https://doi.org/10.5281/zenodo.18684027).

## Contributing

```bash
git clone https://github.com/AgentaOS/agentaos.git && cd agentaos
pnpm install && pnpm build && pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues to [security@agentaos.ai](mailto:security@agentaos.ai), as [SECURITY.md](SECURITY.md) describes.

## License

Apache-2.0. See [LICENSE](LICENSE).

Copyright 2025-2026 Aristokrates OÜ
