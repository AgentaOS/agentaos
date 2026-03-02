# Contributing to AgentaOS

## Prerequisites
- Node.js 20+
- pnpm 9+

## Setup
```bash
git clone https://github.com/AgentaOS/agentaos.git
cd agentaos
pnpm install
pnpm build
```

## Development
```bash
# Run tests
pnpm test

# Lint and format
pnpm lint
```

## Package Structure

The monorepo follows a strict layered architecture:

- **core** -- Interfaces and shared types only (zero dependencies)
- **schemes** -- Threshold signing implementations (CGGMP24 via WASM)
- **chains** -- Chain-specific transaction logic (Ethereum via viem)
- **signer** -- SDK: ThresholdSigner, ShareLoader, HttpClient
- **wallet** -- `agenta` CLI + MCP server

Build order: `core` --> `schemes` + `chains` (parallel) --> `signer` --> `wallet`.

## Dependency Rules
- core imports NOTHING
- schemes/chains import only core
- signer imports core, schemes
- wallet imports signer

## Coding Conventions
- TypeScript strict mode, ESM modules
- Biome for linting + formatting (tabs, single quotes, semicolons always)
- File naming: kebab-case (e.g., threshold-signer.ts)
- No `any` -- use `unknown` and narrow
- Binary data: always `Uint8Array`

## Pull Requests
- Fork the repo, create a feature branch
- Ensure `pnpm build && pnpm test && pnpm lint` all pass
- Write clear commit messages
- One feature/fix per PR
- Add tests for new functionality

## Security
If you discover a security vulnerability, please report it via security@agentaos.ai rather than opening a public issue. See SECURITY.md for details.

## License
By contributing, you agree that your contributions will be licensed under Apache-2.0.
