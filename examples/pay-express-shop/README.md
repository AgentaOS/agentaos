# Express Shop — AgentaOS Payment Integration

A real e-commerce backend showing how to accept stablecoin payments with AgentaOS.

## What this does

1. Customer clicks "Buy" → your server creates a checkout session
2. Customer is redirected to the AgentaOS checkout page
3. Customer pays with their crypto wallet
4. AgentaOS sends a webhook to your server → you fulfill the order
5. Customer is redirected back to your success page

## Setup

```bash
cp .env.example .env
# Edit .env with your API key and webhook secret
npm install
npm run dev
```

## Environment

```
AGENTAOS_API_KEY=sk_live_...        # From app.agentaos.ai → Developer → API Keys
AGENTAOS_WEBHOOK_SECRET=whsec_...   # From app.agentaos.ai → Developer → Webhooks
PORT=3001                            # (set your webhook URL first, secret is shown once)
BASE_URL=http://localhost:3001
```

## Getting your credentials

### API Key
1. Go to [app.agentaos.ai](https://app.agentaos.ai) → Developer → API Keys
2. Click "Create Key"
3. Copy the key (`sk_live_...`) to your `.env`

### Webhook Secret
1. Go to [app.agentaos.ai](https://app.agentaos.ai) → Developer → Webhooks
2. Set your webhook URL (e.g. `https://myshop.com/webhooks`)
3. Click "Reveal signing secret"
4. Copy the secret (`whsec_...`) to your `.env`

The secret is stable — it doesn't change when you update the URL.
You can rotate it anytime with the "Rotate secret" button.
