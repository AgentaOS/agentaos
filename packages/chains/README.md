# @agentaos/chains

**Ethereum chain adapter for AgentaOS.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agentaos/chains)](https://www.npmjs.com/package/@agentaos/chains)

Implements the `IChain` interface from `@agentaos/core` for Ethereum-compatible chains. Handles transaction building, decoding, serialization, and signature assembly using [viem](https://viem.sh/).

## Install

```bash
npm install @agentaos/chains
```

## Usage

```typescript
import { EthereumChain } from '@agentaos/chains';
```

This package is used internally by `@agentaos/server` for transaction processing. Most users should use the higher-level `Agenta` facade from the SDK package instead.

## What It Does

- **Transaction Building** -- construct EIP-1559 transactions with gas estimation
- **Transaction Decoding** -- decode calldata using known ABI selectors
- **Signature Serialization** -- assemble `(r, s, v)` into RLP-encoded signed transactions
- **Balance Queries** -- fetch ETH balance via RPC

## Dependencies

- `@agentaos/core` -- interfaces and types
- `viem` -- Ethereum client library

## License

Apache-2.0 -- see [LICENSE](../../LICENSE).
