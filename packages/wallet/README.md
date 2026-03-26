# agenta

**AgentaOS CLI + MCP Server -- threshold signing for AI agents.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/agentaos)](https://www.npmjs.com/package/agentaos)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org)

CLI and [MCP](https://modelcontextprotocol.io/) server for [AgentaOS](https://github.com/AgentaOS/agentaos). Gives AI agents (Claude, GPT, custom) secure on-chain spending power through threshold ECDSA -- the full private key never exists.

## Install

```bash
npm install -g agentaos
# or
npx agentaos --help
```

## Quick Start

```bash
# Sign in via browser (creates account + wallet)
agenta login

# Check account status
agenta status

# Create a payment checkout
agenta pay checkout -a 50 -c EUR

# Create an agent sub-account
agenta sub create --name trading-bot

# Send ETH from sub-account
agenta sub send 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 0.001
```

## CLI

```bash
agenta --help
```

### Account

| Command | Description |
|---------|-------------|
| `agenta login` | Sign in via browser (device-code flow) |
| `agenta status` | Account, wallet, and readiness overview |
| `agenta logout` | Clear session |

### Payments

| Command | Description |
|---------|-------------|
| `agenta pay checkout -a <amount>` | Create a checkout session |
| `agenta pay get <sessionId>` | Get checkout details |
| `agenta pay list` | List checkouts |

### Agent Sub-accounts

| Command | Description |
|---------|-------------|
| `agenta sub create --name <name>` | Create a sub-account |
| `agenta sub import --name <name> --api-key ... --api-secret ...` | Import existing |
| `agenta sub info <name>` | Show sub-account details |
| `agenta sub balance` | ETH and token balances |
| `agenta sub send <to> <amount>` | Send ETH — threshold-signed, policy-checked |
| `agenta sub sign-message <msg>` | Sign a message (EIP-191) |
| `agenta sub deploy <bytecode>` | Deploy a contract |
| `agenta sub proxy` | JSON-RPC signing proxy for Foundry/Hardhat |
| `agenta sub policies get` | View signing policies |
| `agenta sub policies set --file p.json` | Set policies from JSON |
| `agenta sub pause` / `resume` | Pause or resume signing |
| `agenta sub audit` | View signing audit log |

All commands support `--json` for machine-readable output.

### Multiple Sub-accounts

Each sub-account gets its own config under `~/.agenta/signers/`.

```bash
agenta sub create --name my-agent
agenta sub create --name trading-bot

# Use a specific sub-account
agenta --signer trading-bot sub send 0x... 0.01
agenta --signer my-agent sub balance
```

### Policies

Manage signing policies for your sub-accounts. Requires `agenta login`.

```bash
# View current policy
agenta sub policies get --json

# Set policy from JSON file
agenta sub policies set --file policy.json

# Pause/resume signing
agenta sub pause
agenta sub resume

# Audit log
agenta sub audit                         # last 20 signing requests
agenta sub audit --limit 50             # more results
```

### Config Layout

```
~/.agenta/
  signers/
    my-agent.json           # { serverUrl, apiKey, apiSecret, network, ... }
    trading-bot.json
  admin/
    my-agent.token          # SHA-256(userShare) -- admin auth credential
  .default                  # default signer name

OS Keychain (service: agenta):
  my-agent/user-share       # user share for admin auth + backup signing
```

## MCP Server

When invoked with no arguments, runs as an MCP server over stdio. This lets AI agents interact with the wallet through the [Model Context Protocol](https://modelcontextprotocol.io/).

### 18 Tools

| Tool | Description |
|------|-------------|
| `agenta_wallet_overview` | Wallet address, balances, recent activity |
| `agenta_list_signers` | List all signers |
| `agenta_get_status` | Server health and vault connectivity |
| `agenta_list_networks` | Available networks and chain IDs |
| `agenta_get_balances` | ETH and token balances |
| `agenta_get_audit_log` | Transaction history and audit trail |
| `agenta_resolve_address` | Resolve ENS names or validate addresses |
| `agenta_simulate` | Simulate a transaction (gas estimate) |
| `agenta_read_contract` | Read from any smart contract |
| `agenta_sign_message` | Sign an EIP-191 message |
| `agenta_sign_typed_data` | Sign EIP-712 typed data |
| `agenta_send_eth` | Send ETH to an address |
| `agenta_send_token` | Send ERC-20 tokens |
| `agenta_call_contract` | Call any smart contract function |
| `agenta_execute` | Execute a raw transaction |
| `agenta_x402_check` | Check if a URL requires x402 payment |
| `agenta_x402_discover` | Discover x402-protected endpoints |
| `agenta_x402_fetch` | Fetch a 402-protected resource with auto-payment |

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agenta": {
      "command": "npx",
      "args": ["-y", "agentaos", "mcp"],
      "env": {
        "AGENTA_API_KEY": "your-api-key",
        "AGENTA_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agenta": {
      "command": "npx",
      "args": ["-y", "agentaos", "mcp"],
      "env": {
        "AGENTA_API_KEY": "your-api-key",
        "AGENTA_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

### From Source (development)

```json
{
  "mcpServers": {
    "agenta": {
      "command": "node",
      "args": ["packages/wallet/dist/index.js"],
      "env": {
        "AGENTA_API_KEY": "your-api-key",
        "AGENTA_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

## JSON-RPC Proxy

The `agenta sub proxy` command starts a local HTTP server that acts as an Ethereum JSON-RPC endpoint. It intercepts signing methods (`eth_sendTransaction`, `eth_signTransaction`, `eth_sign`, `personal_sign`) and routes them through Agenta's threshold signing, while forwarding all other calls to the upstream RPC.

```bash
agenta sub proxy --port 8545 --rpc-url https://sepolia.base.org

# Use with Foundry
forge script Deploy.s.sol --rpc-url http://localhost:8545

# Use with cast
cast send 0x... "transfer(address,uint256)" 0x... 1000000 --rpc-url http://localhost:8545
```

## x402 Payment Support

Built-in support for the [x402 payment protocol](https://www.x402.org/). AI agents can discover, check, and pay for 402-protected resources automatically.

```bash
# Check if a URL requires payment
# (via MCP: agenta_x402_check)

# Discover protected endpoints on a domain
# (via MCP: agenta_x402_discover)

# Fetch and auto-pay
# (via MCP: agenta_x402_fetch)
```

## Environment Variables

Environment variables are an alternative to file-based config. Useful for CI/CD, Docker, or MCP server mode.

| Variable | Description | Required |
|----------|-------------|----------|
| `AGENTA_API_KEY` | API key for authentication | Yes |
| `AGENTA_API_SECRET` | Base64-encoded signer key share | Yes |
| `AGENTA_SERVER` | Server URL (defaults to `https://api.agentaos.ai`) | No |
| `AGENTA_NETWORK` | Default network name (e.g. `base-sepolia`, `mainnet`) | No |

## Security

- The full private key **never exists** -- not in memory, not on disk, not ever
- Signing is a distributed MPC protocol between your signer share and the server share
- Signer share stored in config file (`chmod 600`)
- User share stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Admin auth uses a Bitwarden-model double hash -- server never stores raw credentials
- Server shares wiped from memory after every operation

## License

Apache-2.0 -- see [LICENSE](../../LICENSE).
