# Paywall demo: a Notes app with a Pro plan

A small Express app that puts a paid plan behind a login with `@agentaos/pay`. It shows the whole integration from your server's side:

- **Upgrade**: `POST /upgrade` creates a checkout for the signed-in user, with the user's ID in `metadata`.
- **Confirm**: `GET /success` reads the checkout with `checkouts.retrieve` and unlocks Pro when it is `completed`.
- **Webhook**: `POST /webhooks` verifies the signature, unlocks Pro on the first payment, and matches renewals by the stored subscription ID.
- **Access check**: `GET /pro` opens only for a subscription that is `active` or `trialing`.
- **Invoices**: the home page lists the user's invoices with `subscriptions.invoices` and streams the invoice PDF and the receipt.
- **Manage plan**: cancel at the period end, or quote an upgrade with `previewPlanChange` and apply it with `changePlan`.

The login is fake (pick Ada or Grace) and the "database" is `data.json`. Everything else is the real API, in test mode.

| File | What it does |
|---|---|
| `src/agentaos.ts` | The SDK client and the settings from `.env` |
| `src/checkout.ts` | `POST /upgrade` and `GET /success` |
| `src/webhooks.ts` | `POST /webhooks` |
| `src/grant.ts` | Unlocks Pro once per checkout, from the success page or the webhook |
| `src/access.ts` | Reads the subscription and guards Pro routes |
| `src/invoices.ts` | Lists the user's invoices and streams the PDFs |
| `src/plan.ts` | Cancel, quote and apply an upgrade |
| `src/store.ts`, `src/session.ts`, `src/views.ts` | The fake database, the fake login, and the HTML |
| `scripts/send-test-webhook.ts` | Sends signed sample events to `/webhooks` |

## Run it

You need Node.js 20.6 or later, pnpm, and `openssl`. The demo lives in the AgentaOS monorepo and uses the SDK from `packages/pay`.

1. Install from the repository root, and build the SDK:

   ```bash
   pnpm install
   pnpm -F @agentaos/pay build
   ```

2. Create the plan in the dashboard: **Products**, **New product**, **Subscription**, **Monthly**. On the plan's page, open **Building this into your site?** and click **Copy ID**. For the upgrade button, create a second plan with the same currency and interval.

3. Copy the settings and fill them in:

   ```bash
   cd examples/paywall-demo
   cp .env.example .env
   ```

   Set `AGENTAOS_API_KEY` to a test key (Settings, Developers, **Generate Test Key**), `PRO_LINK_ID` and `PRO_PLUS_LINK_ID` to the two plan IDs, and `AGENTAOS_WEBHOOK_SECRET` to the dashboard's signing secret.

4. Make a local certificate. The checkout only returns buyers to an `https` address, and it refuses `localhost`, so the demo runs on `https://127.0.0.1:4567`:

   ```bash
   pnpm cert
   ```

5. Start the app and open https://127.0.0.1:4567. Your browser warns about the self-signed certificate once; continue to the site.

   ```bash
   pnpm dev
   ```

6. Sign in as Ada, click **Upgrade to Pro**, and pay with the test card `4242 4242 4242 4242`, any future expiry, any CVC. You come back to `/success`, and the home page shows the plan, **Manage plan**, and **My invoices**.

A plan with a free trial charges nothing at checkout. The subscription is `trialing`, and **My invoices** stays empty until the first charge at the end of the trial. Use a plan without a trial to see an invoice at once.

## Test the webhook on your machine

AgentaOS does not deliver webhooks to a private address such as `127.0.0.1`, so a local app gets no events. The success page unlocks Pro without them. To test the webhook route, send it signed sample events:

```bash
pnpm webhook:test
```

The script signs each body the way AgentaOS does (`X-AgentaOS-Signature: t=<unix seconds>,v1=<HMAC-SHA256 of "<t>.<raw body>">`) with `AGENTAOS_WEBHOOK_SECRET`, and prints the status for each:

```text
bad signature        -> 400
renewal              -> 200
same renewal again   -> 200
subscription.updated -> 200
```

To receive real events, expose the app through a public HTTPS tunnel, enter the tunnel's `/webhooks` URL in Settings, Developers, **Webhook URL**, and click **Send test event**.

## Take it to production

- **Login**: replace `src/session.ts` with your own authentication.
- **Database**: replace `src/store.ts` with tables. Put a unique constraint on the processed session ID, so two deliveries of the same payment cannot both grant it.
- **Webhook**: register `https://yourapp.com/webhooks` in the dashboard and set its signing secret.
- **Keys**: use your live key (`sk_live_...`) on the live server, and keep it out of the browser and out of git.
- **Test and live**: every event carries `data.livemode`. Ignore test events on the live server.
- **HTTPS**: remove `TLS_CERT` and `TLS_KEY` when a proxy terminates TLS in front of the app, and set `APP_URL` to your public address.

Outside this monorepo, replace `"@agentaos/pay": "workspace:*"` in `package.json` with the published version.
