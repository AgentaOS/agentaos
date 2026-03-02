# Examples

Working integration examples for AgentaOS. Each one sends a real transaction on Base Sepolia.

## Prerequisites

- Node.js 20+, pnpm 9+
- A signer created at [app.agentaos.ai](https://app.agentaos.ai)
- Foundry (for the forge-proxy example only)

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/AgentaOS/agentaos.git
cd agentaos
pnpm install
pnpm build

# 2. Create a signer at app.agentaos.ai
#    The wizard gives you an API Key and API Secret (copy both).

# 3. Configure examples
cp examples/.env.example examples/.env
#    Fill in AGENTA_API_KEY and AGENTA_API_SECRET from step 2.

# 4. Run
pnpm example:viem 0xRecipient 0.001
```

## Environment variables

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `AGENTA_API_KEY` | Yes | Shown when you create a signer at [app.agentaos.ai](https://app.agentaos.ai) |
| `AGENTA_API_SECRET` | Yes | API Secret copied during signer creation |
| `GOOGLE_API_KEY` | LangChain / Vercel AI only | [aistudio.google.com](https://aistudio.google.com/apikey) |
| `ANTHROPIC_API_KEY` | Claude agent / MCP agent only | [console.anthropic.com](https://console.anthropic.com) |

## Run examples

```bash
# viem — send ETH (requires to address and amount)
pnpm example:viem <to> <amount>

# LangChain agent — balance check, sign, send
pnpm example:langchain

# Vercel AI SDK agent — balance check, sign, send
pnpm example:vercel-ai

# Claude autonomous agent — processes an invoice queue with zero human input
pnpm example:claude-agent

# Full lifecycle — health, init, balance, sign, send, audit
./examples/full-lifecycle/demo.sh

# Forge proxy — deploy a Solidity contract via threshold signing
./examples/forge-proxy/deploy.sh
```

## What each example does

| Example | Integration | What it demonstrates |
|---------|-------------|---------------------|
| [viem-client](viem-client/) | `ThresholdSigner.toViemAccount()` | Drop-in viem WalletClient — 10 lines to threshold-signed transactions |
| [langchain](langchain/) | `DynamicStructuredTool` | AI agent with balance, send, and sign tools (Gemini via OpenAI endpoint) |
| [vercel-ai-sdk](vercel-ai-sdk/) | Vercel AI `tool()` | AI agent with the same tools using Vercel's SDK (Gemini via OpenAI endpoint) |
| [full-lifecycle](full-lifecycle/) | CLI | 7-step demo: health, init, balance, sign, send, audit log, CSV export |
| [claude-agent-sdk](claude-agent-sdk/) | Claude Agent SDK + MCP | **Autonomous** DeFi rebalancing agent — reads Uniswap V3 prices, manages 50/50 ETH/USDC portfolio, swaps via threshold signing. Zero human input. |
| [forge-proxy](forge-proxy/) | Foundry | Deploy a Solidity contract through the AgentaOS signing proxy |
