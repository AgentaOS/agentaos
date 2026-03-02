<div align="center">

# AgentaOS

### Threshold signing SDK for autonomous agents.

Give your AI agents a wallet where the private key never exists.

[![npm](https://img.shields.io/npm/v/@agentaos/sdk?label=%40agentaos%2Fsdk)](https://www.npmjs.com/package/@agentaos/sdk)
[![npm](https://img.shields.io/npm/v/agenta?label=agenta%20CLI)](https://www.npmjs.com/package/agenta)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](LICENSE)
[![MPC](https://img.shields.io/badge/MPC-CGGMP24-8B5CF6.svg)](https://eprint.iacr.org/2021/060)

[Quick Start](#quick-start) · [SDK](#sdk) · [CLI](#cli) · [MCP Server](#mcp-server) · [Examples](#examples)

</div>

---

## What is AgentaOS?

AgentaOS splits every private key into 3 shares using the CGGMP24 threshold ECDSA protocol. Any 2 shares can co-sign a transaction. The full key is never reconstructed — not in memory, not in logs, not anywhere.

**This repo contains the open-source SDK and CLI.** For the self-hosted server and dashboard, see [AgentaOS Platform](https://github.com/AgentaOS/platform).

---

## Quick Start

```bash
npm install @agentaos/sdk
```

```typescript
import { ThresholdSigner } from '@agentaos/sdk';
import { createWalletClient, http, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';

// Load signer from API credentials (issued by the AgentaOS server)
const signer = await ThresholdSigner.fromSecret({
  apiSecret: process.env.AGENTA_API_SECRET!,
  serverUrl: process.env.AGENTA_SERVER!,
  apiKey: process.env.AGENTA_API_KEY!,
});

// Use as a drop-in viem account
const client = createWalletClient({
  account: signer.toViemAccount(),
  chain: baseSepolia,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: '0xRecipient...',
  value: parseEther('0.01'),
});

console.log('Transaction hash:', hash);

// Always clean up — wipes share material from memory
signer.destroy();
```

---

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@agentaos/sdk`](packages/signer) | [![npm](https://img.shields.io/npm/v/@agentaos/sdk)](https://www.npmjs.com/package/@agentaos/sdk) | TypeScript SDK — share loading, threshold signing, viem integration |
| [`agenta`](packages/wallet) | [![npm](https://img.shields.io/npm/v/agenta)](https://www.npmjs.com/package/agenta) | CLI + MCP server for AI assistants |
| [`@agentaos/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@agentaos/core)](https://www.npmjs.com/package/@agentaos/core) | Shared interfaces and types (zero dependencies) |
| [`@agentaos/engine`](packages/schemes) | [![npm](https://img.shields.io/npm/v/@agentaos/engine)](https://www.npmjs.com/package/@agentaos/engine) | CGGMP24 threshold ECDSA scheme |
| [`@agentaos/chains`](packages/chains) | [![npm](https://img.shields.io/npm/v/@agentaos/chains)](https://www.npmjs.com/package/@agentaos/chains) | Ethereum chain adapter (viem) |
| [`@agentaos/crypto`](packages/mpc-wasm) | [![npm](https://img.shields.io/npm/v/@agentaos/crypto)](https://www.npmjs.com/package/@agentaos/crypto) | CGGMP24 Rust WASM bindings |

---

## SDK

### `ThresholdSigner`

The main entry point. Loads shares, signs transactions, and integrates with viem.

```typescript
import { ThresholdSigner } from '@agentaos/sdk';

// From API credentials (most common)
const signer = await ThresholdSigner.fromSecret({
  apiSecret: process.env.AGENTA_API_SECRET!,
  serverUrl: process.env.AGENTA_SERVER!,
  apiKey: process.env.AGENTA_API_KEY!,
});

// From a secret file (CLI-style)
const signer = await ThresholdSigner.fromFile('~/.gw/my-agent.secret', {
  serverUrl: process.env.AGENTA_SERVER!,
});
```

### Sign Transactions

```typescript
// Send ETH
const txHash = await signer.signTx({
  to: '0xRecipient...',
  value: parseEther('0.01'),
});

// Send with data (contract call)
const txHash = await signer.signTx({
  to: '0xContract...',
  data: '0xa9059cbb...', // ERC-20 transfer
  value: 0n,
});
```

### Sign Messages

```typescript
const { signature, r, s, v } = await signer.signMessage('Hello from AgentaOS');

// Sign hex data
const sig = await signer.signMessage('0xdeadbeef');
```

### viem Integration

```typescript
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createWalletClient({
  account: signer.toViemAccount(),  // Drop-in LocalAccount
  chain: baseSepolia,
  transport: http(),
});

// Use like any viem wallet client
const hash = await client.sendTransaction({ to, value });
const sig = await client.signMessage({ message: 'hello' });
const sig = await client.signTypedData({ domain, types, primaryType, message });
```

### Cleanup

```typescript
// Wipes share material from memory
signer.destroy();
```

---

## CLI

```bash
npm install -g agenta
```

| Command | Description |
|---------|-------------|
| `agenta init` | Interactive setup — server URL, API key, network |
| `agenta status` | Signer info and connection status |
| `agenta balance` | ETH balance for the configured signer |
| `agenta send <to> <amount>` | Send ETH (threshold-signed, policy-checked) |
| `agenta sign-message <msg>` | Sign an arbitrary message |
| `agenta deploy <bytecode>` | Deploy a smart contract |
| `agenta proxy` | JSON-RPC signing proxy for Foundry/Hardhat |

### Examples

```bash
# Set up a new signer
agenta init

# Send 0.01 ETH on Base Sepolia
agenta send 0xRecipient 0.01 --network base-sepolia

# Sign a message
agenta sign-message "Hello from AgentaOS"

# Start a Foundry-compatible proxy
agenta proxy --port 8545

# Deploy with Forge through the proxy
forge script Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

---

## MCP Server

AgentaOS ships an MCP server so AI assistants (Claude, Cursor, etc.) can sign transactions.

### Claude Desktop

```json
{
  "mcpServers": {
    "agenta": {
      "command": "npx",
      "args": ["-y", "agenta", "mcp"],
      "env": {
        "AGENTA_SERVER": "http://localhost:8080",
        "AGENTA_API_KEY": "your-api-key",
        "AGENTA_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `wallet_overview` | Signer address, balance, network |
| `get_balances` | ETH + token balances |
| `send_eth` | Send ETH to an address |
| `send_token` | Send ERC-20 tokens |
| `sign_message` | Sign an arbitrary message |
| `sign_typed_data` | Sign EIP-712 typed data |
| `call_contract` | Call a smart contract function |
| `read_contract` | Read contract state |
| `simulate` | Simulate a transaction |
| `list_signers` | List all configured signers |
| `list_networks` | List supported networks |
| `get_audit_log` | View signing history |

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
      serverUrl: process.env.AGENTA_SERVER!,
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
      serverUrl: process.env.AGENTA_SERVER!,
      apiKey: process.env.AGENTA_API_KEY!,
    });
    const hash = await signer.signTx({ to, value: parseEther(amount) });
    signer.destroy();
    return JSON.stringify({ txHash: hash });
  },
});
```

### Claude Agent SDK

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ThresholdSigner } from '@agentaos/sdk';

const signer = await ThresholdSigner.fromSecret({
  apiSecret: process.env.AGENTA_API_SECRET!,
  serverUrl: process.env.AGENTA_SERVER!,
  apiKey: process.env.AGENTA_API_KEY!,
});

// Register as a tool for Claude
const tools = [{
  name: 'send_eth',
  description: 'Send ETH using threshold signing',
  input_schema: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      amount: { type: 'string' },
    },
    required: ['to', 'amount'],
  },
}];
```

### Foundry / Hardhat

```bash
# Start the signing proxy
agenta proxy --port 8545

# Foundry
forge script Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Hardhat (hardhat.config.ts)
# networks: { agenta: { url: 'http://localhost:8545' } }
```

---

## Examples

See the [`examples/`](examples/) directory for complete working examples:

- **[viem-client](examples/viem-client/)** — Send ETH using the SDK + viem
- **[vercel-ai-sdk](examples/vercel-ai-sdk/)** — AI agent with signing tools
- **[langchain](examples/langchain/)** — LangChain agent integration
- **[claude-agent-sdk](examples/claude-agent-sdk/)** — Claude agent with signing
- **[mcp](examples/mcp/)** — MCP server usage and testing
- **[forge-proxy](examples/forge-proxy/)** — Foundry deployment through signing proxy

---

## How It Works

AgentaOS uses the CGGMP24 threshold ECDSA protocol to split every private key into 3 shares. Any 2 can co-sign.

### Three Signing Paths

| Path | Shares | Use Case |
|------|--------|----------|
| **Signer + Server** | Agent share + Server share | Normal autonomous operation |
| **User + Server** | Passkey-encrypted share + Server share | Dashboard manual signing |
| **Signer + User** | Agent share + User share | Server down or bypass |

### Security

- The full private key is **never reconstructed** — signing is a distributed computation
- Server shares are wiped from memory after every operation
- API keys are stored as SHA-256 hashes
- The MPC implementation is based on the audited [LFDT-Lockness/cggmp21](https://github.com/LFDT-Lockness/cggmp21) Rust crate

### Supported Networks

Ethereum, Base, Arbitrum, Optimism, Polygon, and their testnets. All EVM-compatible chains are supported.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTA_SERVER` | AgentaOS server URL (e.g., `http://localhost:8080`) |
| `AGENTA_API_KEY` | API key (issued when creating a signer) |
| `AGENTA_API_SECRET` | API secret (base64-encoded share material) |

---

## Self-Hosting the Server

The SDK connects to an AgentaOS server that manages shares and policies. To run your own:

```bash
git clone https://github.com/AgentaOS/platform.git
cd platform
docker compose up -d
```

See [AgentaOS Platform](https://github.com/AgentaOS/platform) for full server setup instructions.

---

## Research

The cryptographic foundation is described in:

- **Canetti, Gennaro, Goldfeder, Makriyannis, Peled** — *UC Non-Interactive, Proactive, Threshold ECDSA with Identifiable Aborts* ([ePrint 2021/060](https://eprint.iacr.org/2021/060))

---

## Contributing

```bash
git clone https://github.com/AgentaOS/agentaos.git
cd agentaos
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

Apache-2.0. See [LICENSE](LICENSE).

Copyright 2025-2026 Aristokrates OU

---

## Links

- **Website:** [agentaos.ai](https://agentaos.ai)
- **Platform (server + dashboard):** [github.com/AgentaOS/platform](https://github.com/AgentaOS/platform)
- **npm:** [@agentaos/sdk](https://www.npmjs.com/package/@agentaos/sdk) · [agenta](https://www.npmjs.com/package/agenta)
- **Security:** [security@agentaos.ai](mailto:security@agentaos.ai)
- **Issues:** [GitHub Issues](https://github.com/AgentaOS/agentaos/issues)
