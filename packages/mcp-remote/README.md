# @agentaos/mcp-remote

The AgentaOS remote MCP server: a Cloudflare Worker at `https://mcp.agentaos.ai/mcp`
that lets ChatGPT, Claude.ai, Claude Desktop and any other hosted MCP client use the
same seven `agenta_pay_*` merchant tools the `agentaos` CLI serves over stdio.

Hosted assistants speak OAuth 2.1 to the MCP server. `@cloudflare/workers-oauth-provider`
implements that front door; the AgentaOS device-code approval page is the consent step.
No new platform endpoints, no new auth mechanism.

## Flow

1. The assistant hits `/mcp` without a token and discovers `/authorize`.
2. `/authorize` starts a device-code login on the platform, parks the OAuth request in KV
   under a random `state`, and redirects the merchant to the existing approve page.
3. The merchant signs in if needed, picks Test or Live, and approves.
4. The approve page returns the merchant to `/callback?state=…&mode=test|live`.
5. `/callback` redeems the device code for a one-shot session, mints a secret key for the
   chosen mode's networks, drops the session, and stores only the key in the grant.
6. The assistant exchanges the code at `/token`; every tool call runs with that key.

Revoking the key on the Developers tab disconnects the assistant. The Pay SDK has no
custom-fetch hook, so after a revoke the tools surface the API's own 401 message rather
than a dedicated "reconnect" sentence.

## Local development

```bash
cp .dev.vars.example .dev.vars      # points at the local API on :8080
pnpm --filter agentaos build         # the Worker imports the tools from agentaos/mcp
pnpm --filter @agentaos/mcp-remote dev
npx @modelcontextprotocol/inspector@latest   # connect to http://localhost:8788/mcp
```

The approve page honours `return` for `http://localhost:*` in dev, so the whole flow
runs against the local API and app.

## Deploy

```bash
wrangler login
wrangler kv namespace create OAUTH_KV     # paste the id into wrangler.jsonc
wrangler deploy                            # binds the custom domain mcp.agentaos.ai
```

## Connecting an assistant

- **ChatGPT**: Settings → Connectors → add `https://mcp.agentaos.ai/mcp`, then Approve on
  the AgentaOS page that opens.
- **Claude.ai / Claude Desktop**: Customize → Connectors → Add custom connector with the
  same URL, then Approve.

## Disconnecting

Revoke the key on app.agentaos.ai → Developers. Its name carries the key prefix the
connection was issued with.

## Tests

```bash
pnpm --filter @agentaos/mcp-remote test
```

The tests run on Node with a fake platform API, a fake KV and a fake OAuth helper.
`vitest.config.ts` aliases `cloudflare:workers` to a stub because the OAuth provider
imports it at module load.
