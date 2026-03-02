# @agentaos/sdk

**AgentaOS SDK -- threshold signing where the key never exists.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agentaos/sdk)](https://www.npmjs.com/package/@agentaos/sdk)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org)

The TypeScript SDK for [AgentaOS](https://github.com/AgentaOS/agentaos). Sign Ethereum transactions and messages using 2-of-3 threshold ECDSA -- the full private key is never constructed.

## Install

```bash
npm install @agentaos/sdk
# or
pnpm add @agentaos/sdk
```

## Quick Start

### Using the `Agenta` facade (recommended)

```typescript
import { Agenta } from '@agentaos/sdk';

const agent = await Agenta.connect({
  apiSecret: process.env.AGENTA_API_SECRET,  // base64 key share
  apiKey: process.env.AGENTA_API_KEY,         // API key for auth
});

// Sign and broadcast a transaction
const { txHash } = await agent.signTransaction({
  to: '0x...',
  value: '0.01',
  network: 'base-sepolia',
});

console.log(`Transaction: ${txHash}`);

// Query server data
const signers = await agent.listSigners();
const balance = await agent.getBalance(signers[0].id, 'base-sepolia');

// Always clean up
agent.destroy();
```

### Using `ThresholdSigner` directly

```typescript
import { ThresholdSigner } from '@agentaos/sdk';

const signer = await ThresholdSigner.fromSecret({
  apiSecret: process.env.AGENTA_API_SECRET,
  apiKey: process.env.AGENTA_API_KEY,
});

// Sign a transaction
const { txHash, signature } = await signer.signTransaction({
  to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  value: '0.001',
  network: 'base-sepolia',
});

// Sign a message (EIP-191)
const { signature } = await signer.signMessage('Hello AgentaOS');

console.log(`Address: ${signer.address}`);
signer.destroy(); // wipe key material from memory
```

### viem Integration

```typescript
import { Agenta } from '@agentaos/sdk';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const agent = await Agenta.connect({ ... });

const client = createWalletClient({
  account: agent.toViemAccount(),
  chain: baseSepolia,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: '0x...',
  value: 1000000000000000n, // 0.001 ETH
});

agent.destroy();
```

## API

### `Agenta` (facade)

| Method | Description |
|--------|-------------|
| `Agenta.connect(opts)` | Connect to server, load key share, return initialized instance |
| `agent.address` | Ethereum address derived from the threshold key |
| `agent.signTransaction(tx)` | Sign and broadcast a transaction |
| `agent.signMessage(msg)` | Sign a message (EIP-191) |
| `agent.toViemAccount()` | Get a viem-compatible account |
| `agent.listSigners()` | List all signers on the server |
| `agent.getBalance(id, network)` | Get ETH balance for a signer |
| `agent.getTokenBalances(id, chainId)` | Get tracked token balances |
| `agent.listNetworks()` | List supported networks |
| `agent.getPolicies(id)` | Get signer's policy rules |
| `agent.getAuditLog(opts?)` | Query the audit log |
| `agent.simulate(id, tx)` | Simulate a transaction (gas estimate) |
| `agent.resolveAddress(addressOrEns)` | Resolve ENS name or validate address |
| `agent.destroy()` | Wipe key material from memory |

### `ThresholdSigner`

| Method | Description |
|--------|-------------|
| `ThresholdSigner.fromSecret(opts)` | Load signer from API Secret (base64 key share) |
| `signer.signTransaction(tx)` | Sign and broadcast |
| `signer.signMessage(msg)` | Sign EIP-191 message |
| `signer.toViemAccount()` | viem account adapter |
| `signer.address` | Ethereum address |
| `signer.destroy()` | Wipe share from memory |

### `AgentaApi`

Low-level API client for server read operations. Used internally by `Agenta`, but available for advanced use:

```typescript
import { AgentaApi, HttpClient } from '@agentaos/sdk';

const client = new HttpClient({ apiKey: '...' });
const api = new AgentaApi(client);

const health = await api.getHealth();
const networks = await api.listNetworks();
```

## Security

- **The full private key never exists** -- not in memory, not in transit, not ever
- Key material is wiped from memory on `destroy()` using `buffer.fill(0)`
- Signing is an interactive multi-round CGGMP24 protocol between your share and the server's share
- The server enforces policies before co-signing (spending limits, allowlists, rate limits)
- API key authentication on every request (SHA-256 hash stored server-side)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AGENTA_API_SECRET` | Base64-encoded key share | Yes |
| `AGENTA_API_KEY` | API key for authentication | Yes |
| `AGENTA_SERVER` | Server URL (defaults to `https://api.agentaos.ai`) | No |

## License

Apache-2.0 -- see [LICENSE](../../LICENSE).
