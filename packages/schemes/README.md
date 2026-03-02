# @agentaos/engine

**CGGMP24 threshold ECDSA signing scheme for AgentaOS.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agentaos/engine)](https://www.npmjs.com/package/@agentaos/engine)

Implements the `IThresholdScheme` interface from `@agentaos/core` using CGGMP24 (Canetti-Gennaro-Goldfeder-Makriyannis-Peled 2024) threshold ECDSA over secp256k1. Wraps a Rust WASM module for the cryptographic operations.

## Install

```bash
npm install @agentaos/engine
```

## Usage

```typescript
import { CGGMP24Scheme, SchemeRegistry } from '@agentaos/engine';

// Direct usage
const scheme = new CGGMP24Scheme();

// Or via registry
const scheme = SchemeRegistry.get('cggmp24');
```

This package is used internally by `@agentaos/sdk` and `@agentaos/server`. Most users should use the higher-level `Agenta` facade from the signer package instead.

## What It Does

- **DKG (Distributed Key Generation)** -- 3-party key generation ceremony producing 3 shares
- **Threshold Signing** -- 2-of-3 interactive signing protocol (3 rounds)
- **Aux Info Generation** -- Pre-computation for efficient signing
- **Address Derivation** -- secp256k1 public key to Ethereum address

## Dependencies

- `@agentaos/core` -- interfaces and types
- `@agentaos/crypto` -- Rust WASM binary (CGGMP24 implementation)

## License

Apache-2.0 -- see [LICENSE](../../LICENSE).
