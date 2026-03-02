# @agentaos/core

**Type definitions and interfaces for AgentaOS.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agentaos/core)](https://www.npmjs.com/package/@agentaos/core)

Zero-dependency package that defines the contracts all Agenta packages implement. Contains TypeScript interfaces, type definitions, and enums -- no runtime code.

## Install

```bash
npm install @agentaos/core
```

## What's Inside

### Interfaces

| Interface | Purpose |
|-----------|---------|
| `IThresholdScheme` | MPC signing scheme (DKG, signing rounds, aux info) |
| `IChain` | Chain adapter (build tx, decode, broadcast, balance) |
| `IVaultStore` | Secret storage (store/retrieve/delete shares) |
| `IShareStore` | Generic share persistence |
| `IPolicyEngine` | Policy evaluation engine |
| `IRulesEngine` | Rules-based policy evaluation |
| `IKmsProvider` | Key management service abstraction |

### Types

| Type | Purpose |
|------|---------|
| `Share`, `ShareFile`, `KeyMaterial` | Key share structures |
| `Signer` | Signer entity (address, status, metadata) |
| `SigningRequest` | Transaction/message signing request |
| `Policy`, `PolicyRule`, `PolicyDocument` | Policy definitions with 9 criterion types |
| `TransactionRequest`, `DecodedAction` | Transaction building and decoding |
| `DKGState`, `EncryptedEnvelope` | DKG ceremony and encryption types |

### Enums

`SchemeName`, `CurveName`, `ChainName`, `NetworkName`, `SignerType`, `SignerStatus`, `SigningPath`, `PolicyType`, `RequestStatus`, `RequestType`

## Usage

```typescript
import { SignerStatus, PolicyType } from '@agentaos/core';
import type { IThresholdScheme, Share, Policy } from '@agentaos/core';
```

## Dependency Rules

`@agentaos/core` imports nothing. All other Agenta packages depend on it.

```
core     -> imports NOTHING
engine   -> imports core
chains   -> imports core
sdk      -> imports core, engine
server   -> imports core, engine, chains
```

## License

Apache-2.0 -- see [LICENSE](../../LICENSE).
