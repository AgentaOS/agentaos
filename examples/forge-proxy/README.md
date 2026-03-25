# AgentaOS + Forge Proxy

Deploy smart contracts using Foundry through AgentaOS signing proxy. The full private key never exists.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`forge`, `cast`)
- AgentaOS CLI installed: `npm install -g agentaos`
- AgentaOS server running with a configured signer

## Setup

```bash
# Sign in and create a sub-account
agenta login
agenta sub init --create --name forge-deployer

# Verify status
agenta status
```

## Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

## How It Works

1. `agenta sub proxy` starts an RPC proxy on port 8545
2. The proxy intercepts `eth_sendTransaction` and `eth_signTransaction` calls
3. Each transaction is signed via the interactive CGGMP24 protocol (2-of-3 MPC)
4. The AgentaOS server enforces all configured policies before co-signing
5. Forge/Cast see a standard JSON-RPC endpoint — no code changes needed

This means you can use **any** Ethereum tooling (Foundry, Hardhat, ethers.js) with threshold signing, just by pointing it at the proxy.

## Manual Steps

```bash
# Start proxy in one terminal
agenta sub proxy --port 8545

# In another terminal, deploy with Forge
forge create --rpc-url http://localhost:8545 --unlocked \
    --constructor-args "Hello!" \
    AgentaTest.sol:AgentaTest

# Or use cast
cast send --rpc-url http://localhost:8545 --unlocked \
    0xContractAddress "setGreeting(string)" "New greeting"
```
