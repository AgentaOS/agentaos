<div align="center">

# AgentaOS

### The Financial OS for the Agent Economy

Accept payments. Automate spending. Enforce guardrails on every transaction.

[![npm](https://img.shields.io/npm/v/@agentaos/sdk?label=%40agentaos%2Fsdk)](https://www.npmjs.com/package/@agentaos/sdk)
[![npm](https://img.shields.io/npm/v/agentaos?label=agenta%20CLI)](https://www.npmjs.com/package/agentaos)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](LICENSE)
[![MPC](https://img.shields.io/badge/MPC-CGGMP24-8B5CF6.svg)](https://eprint.iacr.org/2021/060)
[![Paper](https://img.shields.io/badge/Paper-Zenodo-blue.svg)](https://doi.org/10.5281/zenodo.18684027)

[Quick Start](#quick-start) · [SDK](#sdk) · [CLI](#cli) · [MCP Server](#mcp-server) · [Paper](https://doi.org/10.5281/zenodo.18684027) · [Website](https://agentaos.ai)

</div>

---

## What is AgentaOS

The financial infrastructure for agents and the businesses they transact with.

- **Agents get wallets.** Your AI agents spend autonomously — pay for APIs, settle invoices, execute trades.
- **You set the rules.** Spending caps, approved vendors, daily budgets, business hours — enforced on every transaction. Agents cannot bypass them.
- **Businesses accept agent payments.** One checkout for humans and AI agents. Instant settlement. No integration headaches.
- **No single point of failure.** Private keys are split across three independent parties. No one — not even you — ever holds the full key.

---

## Get Started in 30 Seconds

### From the browser

Go to [app.agentaos.ai](https://app.agentaos.ai), create a wallet, set your guardrails, and start transacting.

### From the terminal

```bash
npm install -g agentaos
agenta login                                    # opens browser — sign in + activate wallet
agenta status                                   # account overview
agenta pay checkout -a 50 -c EUR                # create a payment checkout
agenta sub init --create --name trading-bot     # create an agent sub-account
agenta sub send 0xRecipient 0.01                # send ETH from sub-account
```

### From code

```bash
npm install @agentaos/sdk
```

```typescript
import { Agenta } from '@agentaos/sdk';
import { createWalletClient, http, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';

const agent = await Agenta.connect({
  apiSecret: process.env.AGENTA_API_SECRET!,
  apiKey: process.env.AGENTA_API_KEY!,
});

const client = createWalletClient({
  account: agent.toViemAccount(),
  chain: baseSepolia,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: '0xRecipient...',
  value: parseEther('0.01'),
});

agent.destroy();
```

---

## Packages

| Package | npm | What it does |
|---------|-----|--------------|
| [`@agentaos/sdk`](packages/signer) | [![npm](https://img.shields.io/npm/v/@agentaos/sdk)](https://www.npmjs.com/package/@agentaos/sdk) | Threshold signing SDK — load shares, sign transactions, viem integration |
| [`agentaos`](packages/wallet) | [![npm](https://img.shields.io/npm/v/agentaos)](https://www.npmjs.com/package/agentaos) | CLI + MCP server for AI assistants |
| [`@agentaos/pay`](packages/pay) | [![npm](https://img.shields.io/npm/v/@agentaos/pay)](https://www.npmjs.com/package/@agentaos/pay) | Payment SDK — create checkouts, track payments |
| [`@agentaos/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@agentaos/core)](https://www.npmjs.com/package/@agentaos/core) | Interfaces and types (zero deps) |
| [`@agentaos/engine`](packages/schemes) | [![npm](https://img.shields.io/npm/v/@agentaos/engine)](https://www.npmjs.com/package/@agentaos/engine) | CGGMP24 threshold ECDSA scheme |
| [`@agentaos/chains`](packages/chains) | [![npm](https://img.shields.io/npm/v/@agentaos/chains)](https://www.npmjs.com/package/@agentaos/chains) | Ethereum chain adapter (viem) |
| [`@agentaos/crypto`](packages/mpc-wasm) | [![npm](https://img.shields.io/npm/v/@agentaos/crypto)](https://www.npmjs.com/package/@agentaos/crypto) | CGGMP24 Rust WASM bindings |

---

## SDK

### Connect

```typescript
import { Agenta } from '@agentaos/sdk';

// Credentials from app.agentaos.ai → Create Wallet → copy credentials
const agent = await Agenta.connect({
  apiSecret: process.env.AGENTA_API_SECRET!,
  apiKey: process.env.AGENTA_API_KEY!,
});
```

### Send ETH

```typescript
const { txHash } = await agent.signTransaction({
  to: '0xRecipient...',
  value: parseEther('0.01'),
});
```

### Call a Contract

```typescript
const { txHash } = await agent.signTransaction({
  to: '0xContract...',
  data: '0xa9059cbb...', // ERC-20 transfer
  value: 0n,
});
```

### Sign a Message

```typescript
const { signature, r, s, v } = await agent.signMessage('Hello from AgentaOS');
```

### viem Drop-in

```typescript
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createWalletClient({
  account: agent.toViemAccount(), // LocalAccount — works everywhere viem does
  chain: baseSepolia,
  transport: http(),
});

const hash = await client.sendTransaction({ to, value });
const sig = await client.signMessage({ message: 'hello' });
const sig = await client.signTypedData({ domain, types, primaryType, message });
```

### Cleanup

```typescript
agent.destroy(); // Wipes share material from memory
```

---

## CLI

```bash
npm install -g agentaos
```

**Account**

| Command | What it does |
|---------|--------------|
| `agenta login` | Sign in via browser (device-code flow) |
| `agenta status` | Account, wallet, and readiness overview |
| `agenta logout` | Clear session |

**Payments** — accept payments from humans and AI agents

| Command | What it does |
|---------|--------------|
| `agenta pay checkout -a 50` | Create a checkout session |
| `agenta pay get <sessionId>` | Get checkout details |
| `agenta pay list` | List your checkouts |

**Agent Sub-accounts** — autonomous wallets with guardrails

| Command | What it does |
|---------|--------------|
| `agenta sub init --create --name bot1` | Create a sub-account |
| `agenta sub init --import --name bot1 --api-key ... --api-secret ...` | Import existing |
| `agenta sub send <to> <amount>` | Send ETH — threshold-signed, policy-checked |
| `agenta sub balance` | ETH + token balances |
| `agenta sub policies get` | View signing policies |
| `agenta sub policies set --file p.json` | Set policies from JSON |
| `agenta sub pause` / `resume` | Pause or resume signing |
| `agenta sub proxy` | JSON-RPC signing proxy for Foundry/Hardhat |

All commands support `--json` for machine-readable output (AI agents, CI/CD).

```bash
agenta login
agenta pay checkout -a 50 -c EUR -d "Invoice #42"
agenta sub init --create --name trading-bot
agenta sub send 0xRecipient 0.01 --network base-sepolia
agenta sub proxy --port 8545  # then: forge script Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

---

## MCP Server

Connect any AI assistant to AgentaOS. Claude, Cursor, Windsurf — they sign transactions through the MCP protocol.

### Claude Desktop

```json
{
  "mcpServers": {
    "agenta": {
      "command": "npx",
      "args": ["-y", "agentaos"],
      "env": {
        "AGENTA_API_KEY": "your-api-key",
        "AGENTA_API_SECRET": "your-api-secret",
        "AGENTAOS_GATEWAY_KEY": "sk_live_your-gateway-key"
      }
    }
  }
}
```

- **API Key** + **API Secret** — for wallet tools. Generated when you create a sub-account.
- **Gateway Key** — for payment tools. Generated at [app.agentaos.ai](https://app.agentaos.ai) → API Keys.

### Tools (21 total)

**Payments**

| Tool | What it does |
|------|--------------|
| `agenta_pay_create_checkout` | Create a checkout session |
| `agenta_pay_get_checkout` | Get checkout status |
| `agenta_pay_list_checkouts` | List checkouts |

**Wallet**

| Tool | What it does |
|------|--------------|
| `agenta_wallet_overview` | Address, balance, network |
| `agenta_get_balances` | ETH + ERC-20 balances |
| `agenta_send_eth` | Send ETH |
| `agenta_send_token` | Send ERC-20 tokens |
| `agenta_sign_message` | Sign a message |
| `agenta_sign_typed_data` | Sign EIP-712 typed data |
| `agenta_call_contract` | Write to a contract |
| `agenta_read_contract` | Read contract state |
| `agenta_simulate` | Simulate a transaction |

**x402 (agent-to-agent payments)**

| Tool | What it does |
|------|--------------|
| `agenta_x402_check` | Check if a URL requires payment |
| `agenta_x402_discover` | Discover x402 payment requirements |
| `agenta_x402_fetch` | Fetch a resource with x402 payment |

---

## Framework Integrations

### Vercel AI SDK

```typescript
import { Agenta } from '@agentaos/sdk';
import { tool } from 'ai';
import { parseEther } from 'viem';
import { z } from 'zod';

const agent = await Agenta.connect({
  apiSecret: process.env.AGENTA_API_SECRET!,
  apiKey: process.env.AGENTA_API_KEY!,
});

const sendETH = tool({
  description: 'Send ETH using threshold signing',
  parameters: z.object({
    to: z.string().describe('Recipient address'),
    amount: z.string().describe('Amount in ETH'),
  }),
  execute: async ({ to, amount }) => {
    const result = await agent.signTransaction({
      to,
      value: parseEther(amount).toString(),
    });
    return { txHash: result.txHash };
  },
});
```

### LangChain

```typescript
import { Agenta } from '@agentaos/sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { parseEther } from 'viem';
import { z } from 'zod';

const agent = await Agenta.connect({
  apiSecret: process.env.AGENTA_API_SECRET!,
  apiKey: process.env.AGENTA_API_KEY!,
});

const sendETH = new DynamicStructuredTool({
  name: 'agenta_send_eth',
  description: 'Send ETH using threshold signing',
  schema: z.object({ to: z.string(), amount: z.string() }),
  func: async ({ to, amount }) => {
    const result = await agent.signTransaction({
      to,
      value: parseEther(amount).toString(),
    });
    return JSON.stringify({ txHash: result.txHash });
  },
});
```

### Foundry / Hardhat

```bash
agenta sub proxy --port 8545
forge script Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

---

## Examples

See [`examples/`](examples/) for complete working code:

- **[viem-client](examples/viem-client/)** — Send ETH with the SDK
- **[vercel-ai-sdk](examples/vercel-ai-sdk/)** — AI agent with signing tools
- **[langchain](examples/langchain/)** — LangChain agent integration
- **[claude-agent-sdk](examples/claude-agent-sdk/)** — Claude agent with signing
- **[mcp](examples/mcp/)** — MCP server usage and testing
- **[forge-proxy](examples/forge-proxy/)** — Foundry deployment through signing proxy

---

## How It Works

### Three Signing Paths

| Path | Shares | When |
|------|--------|------|
| **Signer + Server** | Agent share + Server share | Normal autonomous operation |
| **User + Server** | Passkey-encrypted share + Server share | Browser manual signing |
| **Signer + User** | Agent share + User share | Server down or bypass |

### Security Model

- The full private key is **never reconstructed** — signing is a distributed computation between two share holders
- Server shares are wiped from memory (`buffer.fill(0)`) after every operation
- API keys stored as SHA-256 hashes — plaintext exists only on your machine
- Based on the audited [LFDT-Lockness/cggmp21](https://github.com/LFDT-Lockness/cggmp21) Rust crate
- Peer-reviewed cryptographic foundation: [ePrint 2021/060](https://eprint.iacr.org/2021/060)

**Read the research:** [AgentaOS: Threshold Custody for the Agent Economy](https://doi.org/10.5281/zenodo.18684027) — our published paper on the security model, signing architecture, and trust guarantees behind AgentaOS.

### Supported Networks

Ethereum, Base, Arbitrum, Optimism, Polygon — mainnet and testnet. All EVM chains supported.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTA_API_KEY` | API key — generated when you create a sub-account |
| `AGENTA_API_SECRET` | API secret — your signing credential, shown once at creation |
| `AGENTAOS_GATEWAY_KEY` | Gateway key for payment tools (`sk_live_...` or `sk_test_...`) |
| `AGENTA_SERVER` | Optional — defaults to `https://api.agentaos.ai` |

---

## Contributing

```bash
git clone https://github.com/AgentaOS/agentaos.git && cd agentaos
pnpm install && pnpm build && pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

Apache-2.0. See [LICENSE](LICENSE).

Copyright 2025-2026 Aristokrates OU

---

<div align="center">

**[agentaos.ai](https://agentaos.ai)** · **[npm](https://www.npmjs.com/package/@agentaos/sdk)** · **[Security](mailto:security@agentaos.ai)** · **[Issues](https://github.com/AgentaOS/agentaos/issues)**

</div>
