# AgentaOS — Full Lifecycle Demo

End-to-end demonstration of AgentaOS: signer creation, policies, signing, and audit.

## Prerequisites

- Node.js 20+
- AgentaOS CLI: `npm install -g agentaos`
- A signer created at [app.agentaos.ai](https://app.agentaos.ai)

## Run

```bash
# 1. Configure your credentials
cp examples/.env.example examples/.env
#    Fill in AGENTA_API_KEY and AGENTA_API_SECRET from app.agentaos.ai

# 2. Run the demo script
cd examples/full-lifecycle
chmod +x demo.sh
./demo.sh
```

## What the Demo Does

1. **Health check** — verifies the server is reachable
2. **Status** — shows signer info (address, chain, scheme)
3. **Balance** — checks the signer's ETH balance
4. **Sign message** — signs a proof-of-liveness attestation
5. **Send transaction** — sends a small ETH transfer
6. **Audit log** — fetches recent signing requests
7. **CSV export** — exports the full audit trail

## Manual Flow

```bash
# Sign in and activate wallet
agenta login

# Create a sub-account
agenta sub create --name demo

# Send a transaction
agenta sub send 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 0.001

# Sign a message
agenta sub sign-message "Hello from AgentaOS"

# Check status
agenta status

# Check balance
agenta sub balance

# Create a payment checkout
agenta pay checkout -a 50 -c EUR
```

## Policy Enforcement

Set policies via the CLI or [app.agentaos.ai](https://app.agentaos.ai):

```bash
# After adding a spending limit, try to exceed it — blocked with 403
agenta sub send 0x... 0.5
# Error: Policy violation: spending_limit — amount exceeds limit
```
