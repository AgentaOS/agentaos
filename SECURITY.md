# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AgentaOS, please report it responsibly.

**Primary contact:** [security@agentaos.ai](mailto:security@agentaos.ai)

- You will receive an acknowledgment within **48 hours** of your report.
- We will provide a detailed response within **5 business days**, including an assessment of the issue and an expected timeline for a fix.
- If you prefer, you may also report vulnerabilities through [GitHub Security Advisories](https://github.com/AgentaOS/agentaos/security/advisories/new).

Please include as much detail as possible: steps to reproduce, affected versions, and any proof-of-concept code.

## Scope

### In Scope

| Package | Description |
|---------|-------------|
| `@agentaos/sdk` | Signer SDK (share loading, partial signing, HTTP client) |
| `agenta` | CLI + MCP server |
| `@agentaos/core` | Shared interfaces and types |
| `@agentaos/chains` | Chain-specific transaction logic (Ethereum) |
| `@agentaos/engine` | Threshold signing implementations (CGGMP24) |
| `@agentaos/crypto` | CGGMP24 WASM bindings (Rust) |

### Out of Scope

- Example code and documentation
- Server and dashboard vulnerabilities (report to the [platform repo](https://github.com/AgentaOS/platform))

## Core Security Invariant

```
THE FULL PRIVATE KEY MUST NEVER EXIST.
Not in memory, not in logs, not in any variable, not in any code path.
Every signing operation is a distributed computation between two share holders.
```

Any code path that reconstructs, combines, or exposes the full private key -- even transiently -- is a critical vulnerability.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Disclosure Policy

We follow a **coordinated disclosure** process:

1. Reporter submits vulnerability details via the channels listed above.
2. We acknowledge receipt within 48 hours and begin investigation.
3. We work with the reporter to understand and validate the issue.
4. A fix is developed, tested, and prepared for release.
5. We notify the reporter before public disclosure.
6. The vulnerability is disclosed publicly **no later than 90 days** after the initial report, unless both parties agree to an extension.

We will credit reporters in the advisory unless they prefer to remain anonymous.
