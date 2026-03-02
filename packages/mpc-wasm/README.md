# @agentaos/crypto

**CGGMP24 threshold ECDSA WASM module for AgentaOS.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](../../LICENSE-APACHE)
[![npm](https://img.shields.io/npm/v/@agentaos/crypto)](https://www.npmjs.com/package/@agentaos/crypto)

Rust-compiled WebAssembly module implementing CGGMP24 threshold ECDSA (2-of-3) over secp256k1. Built from the [LFDT-Lockness/cggmp21](https://github.com/LFDT-Lockness/cggmp21) Rust crate.

## Install

```bash
npm install @agentaos/crypto
```

## What It Does

- **DKG** -- Distributed Key Generation (3-party, produces 3 shares + public key)
- **Signing** -- Interactive threshold signing (2-of-3, 3-round protocol)
- **Aux Info** -- Pre-computation of auxiliary information for signing efficiency
- **Key Refresh** -- Proactive share refresh without changing the public key

## Build from Source

Requires Rust toolchain with `wasm32-unknown-unknown` target:

```bash
cd packages/mpc-wasm
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/agenta_crypto_wasm.wasm --out-dir pkg/
```

## Usage

This module is consumed by `@agentaos/engine`. Direct usage is not recommended -- use the higher-level `Agenta` facade from `@agentaos/sdk` instead.

## License

Apache-2.0 -- see [LICENSE-APACHE](../../LICENSE-APACHE).
