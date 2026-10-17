# Installing the AgentaOS MCP server

These steps are for AI coding assistants (Cline, Cursor, Claude Code and other MCP clients) setting up the AgentaOS MCP server for a user. AgentaOS is a merchant of record: the server lets the agent create products, checkout links and subscriptions, and read customers and invoices, while AgentaOS handles VAT, sales tax and invoices as the seller.

## 1. Get an API key from the user

Ask the user to open https://app.agentaos.ai, switch the dashboard to **test mode**, open **Developers → API keys** and click **Generate Test Key**. A test key starts with `sk_test_`; a live key starts with `sk_live_`. Never print the key back in chat.

## 2. Add the server (local, works in any MCP client)

Add this to the client's MCP settings (for Cline: `cline_mcp_settings.json`, via **MCP Servers → Configure**):

```json
{
  "mcpServers": {
    "agentaos": {
      "command": "npx",
      "args": ["-y", "agentaos"],
      "env": {
        "AGENTAOS_GATEWAY_KEY": "sk_test_your-key"
      }
    }
  }
}
```

Requirements: Node.js 20 or later. `npx -y agentaos` downloads the AgentaOS CLI from npm and starts its MCP server over stdio.

## 3. Or connect the hosted server (clients with remote MCP and OAuth)

Clients that support remote MCP servers with OAuth can use the hosted server instead, with no key in the config:

```json
{
  "mcpServers": {
    "agentaos": {
      "url": "https://mcp.agentaos.ai/mcp"
    }
  }
}
```

The client opens an AgentaOS sign-in page; the user approves and picks Test or Live.

## 4. Check it works

Call the `agenta_status_get` tool. It returns the account and whether it is in test or live mode. Then, for example, create a test product with `agenta_products_create` and share its checkout link. In test mode, pay with the card `4242 4242 4242 4242`, any future date and any CVC.

More: https://docs.agentaos.ai/mcp/setup
