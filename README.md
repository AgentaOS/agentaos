<div align="center">

# AgentaOS

### The Financial OS for the Agent Economy

Accept payments. Automate spending. Enforce guardrails on every transaction.

[![npm](https://img.shields.io/npm/v/@agentaos/sdk?label=%40agentaos%2Fsdk)](https://www.npmjs.com/package/@agentaos/sdk)
[![npm](https://img.shields.io/npm/v/agenta?label=agenta%20CLI)](https://www.npmjs.com/package/agenta)
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
npm install -g agenta
agenta login
agenta init
agenta send 0xRecipient 0.01
```

### From code

```bash
npm install @agentaos/sdk
```

```typescript
import { ThresholdSigner } from '@agentaos/sdk';
import { createWalletClient, http, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';

const signer = await ThresholdSigner.fromSecret({
  apiSecret: process.env.AGENTA_API_SECRET!,
  apiKey: process.env.AGENTA_API_KEY!,
});

const client = createWalletClient({
  account: signer.toViemAccount(),
  chain: baseSepolia,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: '0xRecipient...',
  value: parseEther('0.01'),
});

signer.destroy();
```

---

## Packages

| Package | npm | What it does |
|---------|-----|--------------|
| [`@agentaos/sdk`](packages/signer) | [![npm](https://img.shields.io/npm/v/@agentaos/sdk)](https://www.npmjs.com/package/@agentaos/sdk) | Threshold signing SDK — load shares, sign transactions, viem integration |
| [`agenta`](packages/wallet) | [![npm](https://img.shields.io/npm/v/agenta)](https://www.npmjs.com/package/agenta) | CLI + MCP server for AI assistants |
| [`@agentaos/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@agentaos/core)](https://www.npmjs.com/package/@agentaos/core) | Interfaces and types (zero deps) |
| [`@agentaos/engine`](packages/schemes) | [![npm](https://img.shields.io/npm/v/@agentaos/engine)](https://www.npmjs.com/package/@agentaos/engine) | CGGMP24 threshold ECDSA scheme |
| [`@agentaos/chains`](packages/chains) | [![npm](https://img.shields.io/npm/v/@agentaos/chains)](https://www.npmjs.com/package/@agentaos/chains) | Ethereum chain adapter (viem) |
| [`@agentaos/crypto`](packages/mpc-wasm) | [![npm](https://img.shields.io/npm/v/@agentaos/crypto)](https://www.npmjs.com/package/@agentaos/crypto) | CGGMP24 Rust WASM bindings |

---

## SDK

### Load a Signer

```typescript
import { ThresholdSigner } from '@agentaos/sdk';

// From API credentials (app.agentaos.ai → Create Wallet → copy credentials)
const signer = await ThresholdSigner.fromSecret({
  apiSecret: process.env.AGENTA_API_SECRET!,
  apiKey: process.env.AGENTA_API_KEY!,
});

// From a secret file (CLI-style)
const signer = await ThresholdSigner.fromFile('~/.gw/my-agent.secret');
```

### Send ETH

```typescript
const txHash = await signer.signTx({
  to: '0xRecipient...',
  value: parseEther('0.01'),
});
```

### Call a Contract

```typescript
const txHash = await signer.signTx({
  to: '0xContract...',
  data: '0xa9059cbb...', // ERC-20 transfer
  value: 0n,
});
```

### Sign a Message

```typescript
const { signature, r, s, v } = await signer.signMessage('Hello from AgentaOS');
```

### viem Drop-in

```typescript
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createWalletClient({
  account: signer.toViemAccount(), // LocalAccount — works everywhere viem does
  chain: baseSepolia,
  transport: http(),
});

const hash = await client.sendTransaction({ to, value });
const sig = await client.signMessage({ message: 'hello' });
const sig = await client.signTypedData({ domain, types, primaryType, message });
```

### Cleanup

```typescript
signer.destroy(); // Wipes share material from memory
```

---

## CLI

```bash
npm install -g agenta
```

| Command | What it does |
|---------|--------------|
| `agenta init` | Interactive setup — server URL, API key, network |
| `agenta status` | Signer info and connection status |
| `agenta balance` | ETH balance |
| `agenta send <to> <amount>` | Send ETH — threshold-signed, policy-checked |
| `agenta sign-message <msg>` | Sign an arbitrary message |
| `agenta deploy <bytecode>` | Deploy a smart contract |
| `agenta proxy` | JSON-RPC signing proxy for Foundry/Hardhat |

```bash
agenta init
agenta send 0xRecipient 0.01 --network base-sepolia
agenta sign-message "proof-of-liveness"
agenta proxy --port 8545  # then: forge script Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
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
      "args": ["-y", "agenta", "mcp"],
      "env": {
        "AGENTA_API_KEY": "your-api-key",
        "AGENTA_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

Your **API Key** and **API Secret** are generated when you create a wallet at [app.agentaos.ai](https://app.agentaos.ai). Copy them from the credentials screen.

### Tools

| Tool | What it does |
|------|--------------|
| `wallet_overview` | Address, balance, network |
| `get_balances` | ETH + ERC-20 balances |
| `send_eth` | Send ETH |
| `send_token` | Send ERC-20 tokens |
| `sign_message` | Sign a message |
| `sign_typed_data` | Sign EIP-712 typed data |
| `call_contract` | Write to a contract |
| `read_contract` | Read contract state |
| `simulate` | Simulate a transaction |
| `list_signers` | List configured signers |
| `list_networks` | Supported networks |
| `get_audit_log` | Signing history |

---

## Framework Integrations

### Vercel AI SDK

```typescript
import { tool } from 'ai';
import { ThresholdSigner } from '@agentaos/sdk';
import { parseEther } from 'viem';
import { z } from 'zod';

const sendETH = tool({
  description: 'Send ETH using threshold signing',
  parameters: z.object({
    to: z.string().describe('Recipient address'),
    amount: z.string().describe('Amount in ETH'),
  }),
  execute: async ({ to, amount }) => {
    const signer = await ThresholdSigner.fromSecret({
      apiSecret: process.env.AGENTA_API_SECRET!,
      apiKey: process.env.AGENTA_API_KEY!,
    });
    const hash = await signer.signTx({ to, value: parseEther(amount) });
    signer.destroy();
    return { txHash: hash };
  },
});
```

### LangChain

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ThresholdSigner } from '@agentaos/sdk';
import { parseEther } from 'viem';
import { z } from 'zod';

const sendETH = new DynamicStructuredTool({
  name: 'agenta_send_eth',
  description: 'Send ETH using threshold signing',
  schema: z.object({ to: z.string(), amount: z.string() }),
  func: async ({ to, amount }) => {
    const signer = await ThresholdSigner.fromSecret({
      apiSecret: process.env.AGENTA_API_SECRET!,
      apiKey: process.env.AGENTA_API_KEY!,
    });
    const hash = await signer.signTx({ to, value: parseEther(amount) });
    signer.destroy();
    return JSON.stringify({ txHash: hash });
  },
});
```

### Foundry / Hardhat

```bash
agenta proxy --port 8545
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
| `AGENTA_API_KEY` | API key — generated when you create a wallet |
| `AGENTA_API_SECRET` | API secret — your signing credential, shown once at creation |
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
