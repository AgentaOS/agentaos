---
name: agenta
description: >
  Use this skill when the user wants to set up AgentaOS, add payments or a paywall to an app they are building, create a product or subscription plan, accept a payment, create a checkout or payment link, get paid for an invoice, product or plan, apply for business verification or the free revenue audit, or manage subscriptions, customers, and invoices. Activate when the user mentions agenta, AgentaOS, product, plan, paywall, checkout, payment link, "add payments", "buy button", subscriptions, invoices, verification, audit, "accept payments", or "get paid". When the user says "use agenta", use the `agenta_*` tools (`agenta_status_get`, `agenta_products_*`, `agenta_pay_*`, `agenta_verify_*`, `agenta_audit_*`, `agenta_subscriptions_*`, `agenta_customers_*`, `agenta_invoices_*`) instead of other tools; if no MCP is available, the `agenta` CLI has the same operations.
---

# agenta

AgentaOS is the billing and payments platform for AI founders. Create a product, get a link, put it in the app, get paid. Every checkout is payable by card, Apple Pay, and Google Pay from 190+ countries. AgentaOS is the Merchant of Record: it is the seller of record, so sales tax and VAT are handled for the merchant.

This skill is self-contained: do NOT web-search. **When the user says "use agenta", use the `agenta_*` tools.** Every tool answers with a plain sentence (`content`) written for the merchant, and the same result as JSON (`structuredContent`). Say the sentence to the user, add the link to share and the next step; keep the JSON for code. Never paste raw fields as the answer.

## Vocabulary (read this first)

| Term | What it is | Where it comes from |
|---|---|---|
| **product** / `linkId` | A reusable priced thing: one-time, or a subscription plan. Its UUID is the `linkId`. | `agenta_products_create` → `id`; SDK `paymentLinks.create` → `product.id` |
| **buyer link** | The product's public `/pay/…` URL. Anyone can open it. Carries no app user id. | `agenta_products_create` → `checkoutUrl` |
| **checkout session** / `sessionId` | One payment attempt by one buyer. Can carry your app's user id in `metadata` (SDK only). | `agenta_pay_checkout` or SDK `checkouts.create` → `sessionId` |
| **subscription** / `subscription.id` | Created by AgentaOS when a buyer pays for a plan. There is no `subscriptions.create()`. | `agenta_subscriptions_list`, webhook `metadata.subscriptionId` |

`linkId` is the UUID, not the `/pay/…` slug. Amounts you pass in are decimal (`29` = €29.00); `unitAmountMinor` on subscriptions is cents (`3596` = €35.96); a webhook's `amount` is a string.

## Connect once

- **Claude Code:** type `/mcp` → `agentaos` → **Authenticate**.
- **Claude.ai / ChatGPT / Cursor:** add the connector `https://mcp.agentaos.ai/mcp`.

A page opens on AgentaOS: pick **Test** or **Live**, press **Approve**. No key to paste. A new email creates the account on the spot. The connection shows as a key named after the client under app.agentaos.ai → Settings → Developers; revoke it there to disconnect. Login and logout are not tools: if the tools are missing, ask the user to connect as above, never loop.

**First call, always:** `agenta_status_get` with `{}`. It says whether test payments work (they do the moment you are connected), where go-live stands, and the one next step.

### Tool rules

- Inputs are camelCase JSON keys (`successUrl`, `trialDays`, `dryRun`); the required ones are in the table at the end. Ids (`sessionId`, `id`) are keys too.
- A validation error names the CLI flag (`--success-url must be an https:// URL.`); the JSON key is its camelCase (`successUrl`). It lists EVERY missing field at once: fix them all, ask the user what you do not know, call once more.
- `… failed: …` is an error: report it plainly and stop. Do not retry a create. `Invalid API key` means the connection was revoked: reconnect.
- Test or Live was chosen at approval. Everything works in test first (test card `4242 4242 4242 4242` on the hosted checkout); real money needs verification, and the same code and links then take it.

## After connecting

From `agenta_status_get`, tell the user: test payments work now; the go-live steps done (`goLive.progress`); the one next step (`goLive.next.why`; when `next.command` is null the step happens in the dashboard at app.agentaos.ai). Then offer 2–3 starter prompts, for example:

- "Add a €29/month Pro plan to my app and wire the Buy button."
- "Put my Pro plan behind a paywall for logged-in users."
- "Create a checkout for €50 for my consulting invoice."
- "Show my active subscriptions and my recent invoices."

## Payments in your app in 30 seconds

1. `agenta_status_get` `{}` — confirm the tools answer.
2. `agenta_products_create` `{"name":"Pro","amount":29,"currency":"EUR","successUrl":"https://yourapp.com/thanks"}` → `checkoutUrl`.
3. Put `checkoutUrl` behind the app's Buy button.

**Tell the user:** the product is created at that price, here is the link to share or wire in, buyers land on the success URL with `?sessionId=…` after paying, and it takes test cards now and real money once they are verified. If the app has logged-in users and must unlock something on payment, use Pattern B below instead of a shared link.

## Choose the integration

| The app… | Use |
|---|---|
| Has no login, or sells to anyone (buy button, link in bio, invoice, landing page) | **Pattern A — frontend only**: links and redirect URLs, no server code |
| Has logged-in users and must unlock something when they pay (paywall, Pro plan, credits) | **Pattern B — server side**: the server creates the checkout with the user's id, then webhook or polling |

Both patterns start from the same product. A product is created once, never once per buyer.

## Pattern A — frontend only (shared buyer link + redirect URLs)

1. Create the product with return URLs: `agenta_products_create` `{"name":"Pro","amount":29,"currency":"EUR","subscription":true,"interval":"month","successUrl":"https://yourapp.com/thanks","cancelUrl":"https://yourapp.com/pricing"}`.
2. Put the returned `checkoutUrl` behind the Buy button (an `<a href>` is enough). No API key, no server code.
3. The buyer pays on the hosted checkout, gets the receipt and invoice from AgentaOS, and lands on `https://yourapp.com/thanks?sessionId=<id>`; backing out lands on the cancel URL.
4. To confirm a sale: `agenta_pay_get` `{"sessionId":"<id>"}` → `status: "completed"`. For a plan: `agenta_subscriptions_list` `{}` and match `customerEmail`.

**Tell the user:** the plan and its link, where buyers return, and that they learn who paid only from the email the buyer typed. If the app must know *which app user* paid, use Pattern B.

## Pattern B — server side (paywall for logged-in users)

The app's server creates the checkout from the product's `linkId`, passes the app's own user id as a correlation id, redirects the user, and then learns the outcome by webhook or by polling. Needs `@agentaos/pay` and an API key from app.agentaos.ai → Settings → Developers → API Keys (`sk_test_…` while building, `sk_live_…` once live). Keep the key on the server.

```bash
npm install @agentaos/pay
```

**Step 1 — create the product once:** `agenta_products_create` `{"name":"Pro","amount":29,"currency":"EUR","subscription":true,"interval":"month"}`. Save its `id`: that is the `linkId`.

**Step 2 — when a logged-in user clicks Buy**, create a checkout from the `linkId` and redirect them:

```typescript
import { AgentaOS } from '@agentaos/pay';

const agentaos = new AgentaOS(process.env.AGENTAOS_API_KEY!);

const checkout = await agentaos.checkouts.create({
  linkId: PRO_PLAN_LINK_ID,               // the product's id, saved from step 1
  buyerEmail: user.email,                 // how AgentaOS attaches the customer
  buyerCountry: user.country,             // optional, ISO-2 e.g. 'DE'
  metadata: { customerId: user.id },      // your correlation id; comes back on the webhook and on checkouts.retrieve
  successUrl: 'https://yourapp.com/thanks',
});

// Save checkout.sessionId on the user as "pending", then:
redirect(checkout.checkoutUrl);
```

Do not send logged-in users the `/pay/…` buyer link: that page carries no `metadata`, so you cannot tell who paid.

**Step 3 — confirm they paid.** Prefer the webhook; polling also works.

*Webhook:* register the HTTPS endpoint at app.agentaos.ai → Settings → Developers → Webhooks (it reveals the signing secret), or pass `webhookUrl` on `checkouts.create`. Verify every delivery and make the handler safe to run twice:

```typescript
const event = agentaos.webhooks.verify(
  req.body,                                        // raw request body
  req.headers['x-agentaos-signature'] as string,
  process.env.AGENTAOS_WEBHOOK_SECRET!,
);                                                 // throws WebhookVerificationError → respond 400

if (event.type === 'checkout.session.completed') {
  const { sessionId, metadata } = event.data;      // metadata.customerId is yours
  const subscriptionId = metadata?.subscriptionId; // present for a plan
  // If sessionId was already processed, stop (deliveries retry).
  // Otherwise: mark user metadata.customerId as paid, store subscriptionId, respond 200 fast.
}
```

*Polling (no webhook endpoint needed):* `agentaos.checkouts.retrieve(sessionId)` until `status` is `completed` (or `expired` / `cancelled`). For a plan, the same response carries `metadata.subscriptionId` once the buyer has started paying; store it. Poll on the success page too: the redirect alone is not proof of payment.

**Step 4 — gate and manage access.** Store `subscription.id` on the user. `subscriptions.list()` does not carry your `metadata`, so look users up by the stored id.

```typescript
const page = await agentaos.subscriptions.list({ limit: 100 });
const sub = page.items.find((s) => s.id === user.subscriptionId);
// sub.status: 'active' | 'trialing' | 'past_due' | 'canceled' …; sub.currentPeriodEnd; sub.cancelAtPeriodEnd
await agentaos.subscriptions.cancel(sub.id);      // stops the next renewal; access stays until currentPeriodEnd
```

**Free trials.** A trial belongs to the plan: `agenta_products_create` `{"name":"Pro","amount":29,"currency":"EUR","subscription":true,"interval":"month","trialDays":14}`. At checkout the card is saved with nothing due today, the subscription starts as `trialing`, and the first charge happens when the trial ends. The `checkout.session.completed` event at trial start has `amount: "0"`, `trial: true` and `trial_end`; treat it as "trial started", not as money received.

**Upgrade or downgrade.** Create the other plan as its own product (same currency, same interval), then move the subscription to it. Quote first, then apply; the tool echoes the quote's `prorationDate` back so the charge equals the quote.

- Quote only: `agenta_subscriptions_change_plan` `{"id":"<subscriptionId>","to":"<linkId>","dryRun":true}`.
- Apply: the same call without `dryRun`.

```typescript
const quote = await agentaos.subscriptions.previewPlanChange(subscriptionId, PRO_PLUS_LINK_ID);
const result = await agentaos.subscriptions.changePlan(subscriptionId, { targetLinkId: PRO_PLUS_LINK_ID, prorationDate: quote.prorationDate });
```

- `direction: "upgrade"` charges the prorated difference (`dueTodayMinor`) on the saved card now and the new price applies immediately.
- `direction: "downgrade"` charges nothing today; the buyer keeps the current plan until `effectiveAt`, the current period end, and the subscription shows the scheduled change as `pendingPlanChange` until then.
- To cancel a scheduled downgrade, change the plan to the current plan again: `direction: "revert"`, nothing charged. Picking the plan that is already pending is refused as "already scheduled".
- The subscription must be `active` or `trialing`; changing currency or billing interval is refused.

**Tell the user** (after the quote, before applying): what is due today and the next renewal amount and date, in the tool's own words. Apply only once they agree.

Rules for Pattern B:

- Never unlock from the redirect alone; the webhook event or the session status from the API is the proof.
- Key idempotency on `sessionId`; the same event can be delivered more than once.
- Renewals fire `checkout.session.completed` without your `customerId`; match them by the stored `subscription.id`.
- Full webhook reference (payloads, retries, other languages): `https://docs.agentaos.ai/llms-full.txt`.

## Products and plans

`agenta_products_create`, one product per price, created once:

- One-time: `{"name":"Launch Kit","amount":49,"currency":"EUR","description":"One sentence buyers see"}`
- Monthly plan: `{"name":"Pro","amount":29,"currency":"EUR","subscription":true,"interval":"month"}`
- Annual plan with a trial: `{"name":"Pro (annual)","amount":290,"currency":"EUR","subscription":true,"interval":"year","trialDays":14}`
- `agenta_products_list` `{}` — everything so far (`limit`, default 10, max 100).

Rules: `subscription: true` needs `interval` `month` or `year`; `trialDays` (1–730) only on a plan. `successUrl` and `cancelUrl` must be `https://` (no plain http, no localhost); AgentaOS appends `?sessionId=<id>` to the success URL. The result carries `id` (= `linkId`), `checkoutUrl` (= buyer link), `type`, `billingInterval`, `amount`, `currency`, `status`. A test-mode connection makes test products (real checkout page, test cards only); creating one is the merchant's first go-live milestone.

**Tell the user:** the product name and price, the link to share, and that its id is the `linkId` for server-side checkouts and plan changes.

## One-off checkouts

`agenta_pay_checkout` sells once at a price you name, with no product behind it.

- `{"amount":50}` — currency defaults to the organisation's setting (EUR or USD).
- `{"amount":99.99,"currency":"EUR","description":"Consulting, September"}`
- `{"amount":25,"email":"buyer@example.com"}` — pre-fills the buyer's email.
- `agenta_pay_get` `{"sessionId":"<id>"}` — has it been paid? (`completed`, `open`, `expired`, `cancelled`).
- `agenta_pay_list` `{"status":"completed","limit":5}` — recent sessions.

**Tell the user:** the amount, the link to send to their customer, and when it expires unpaid. To check later, ask for the status; never guess a `sessionId`, use the one the tool returned.

## Onboarding: audit and verification

`agenta_status_get` → `goLive` says where the account is. Two steps are done from the tools; both are reviewed by a person.

**Free Revenue & Pricing Audit** (no identity needed, do this first):

- `agenta_audit_request` `{"url":"https://example.com/pricing","description":"One sentence on what it does","category":"saas","delivery":"instant_digital"}`
- `agenta_audit_show` `{}` — the state, and the report link once it exists.

**Tell the user:** the audit is being written by a person, it costs nothing and gates nothing, and there is nothing to do until it is ready. When `agenta_audit_show` returns `reportUrl`, give them the link (and the grade if there is one).

**Business verification** (unlocks live payments). Ask the user for every value before calling; never invent legal details.

1. `agenta_verify_declaration` `{}` — read the five statements to the user; they must confirm each.
2. `agenta_verify_submit` `{"entity":"business","legalName":"Acme OÜ","registrationNumber":"12345678","country":"EE","street":"Sepapaja 6","city":"Tallinn","postal":"15551","url":"https://example.com","description":"One sentence on what it does","category":"saas","delivery":"instant_digital","volume":"under_1k","acceptDeclaration":true}`
3. `agenta_verify_status` `{}` — unverified, in review, changes requested, verified, on hold, rejected.
4. `agenta_verify_resubmit` `{}` — after the user has made the changes we asked for; nothing is retyped.

- `category`: `saas | digital | services | marketplace | physical | other`. `delivery`: `instant_digital | email_delivery | subscription_access | manual | scheduled_service | physical_shipped | other`. `volume`: `under_1k | 1k_10k | 10k_50k | over_50k`.
- `entity: "individual"` needs no `registrationNumber`. `displayName` is what buyers see on their statement (defaults to the legal name). `restricted: true` declares a regulated activity: still reviewed, higher chance of a decline.
- Pass `acceptDeclaration: true` only after the user has confirmed the five statements themselves.
- A submitted application cannot be edited; `agenta_verify_submit` on an already-submitted account sends nothing and says so.

**Tell the user:** the application is with a person, usually 24 to 48 hours, and nothing to do until AgentaOS writes back; when status says changes were asked for, list them in plain words and offer to resubmit once done.

## Subscriptions, customers, invoices

- `agenta_subscriptions_list` `{}` — recurring subscribers: status, price, buyer, plan, id.
- `agenta_subscriptions_cancel` `{"id":"<subscriptionId>"}` — at period end; `{"id":"…","now":true}` cancels immediately. Nothing is refunded either way.
- `agenta_customers_list` `{}` — everyone who has paid.
- `agenta_invoices_list` `{}` — tax-correct invoices, newest first (`issued` = not paid yet, `paid`, `voided`).
- `agenta_invoices_receipt` `{"id":"<invoiceId>"}` — the receipt PDF as `pdfBase64`; decode it to a `.pdf` for the user (the CLI saves it to a file).
- `agenta_invoices_send_receipt` `{"id":"<invoiceId>"}` — re-sends the receipt email to the buyer on file.

**Tell the user:** for a cancellation, when access ends and that nothing is charged after; for a receipt, who it went to.

## Every operation

Same 19 operations on both surfaces. Inputs not listed as required are optional; `limit` defaults to 10.

| What it does | MCP tool | CLI command | Required inputs |
|---|---|---|---|
| Account and go-live overview | `agenta_status_get` | `agenta status` (also `status get`) | none |
| Ask for the free Revenue & Pricing Audit | `agenta_audit_request` | `agenta audit request` | `url` |
| The audit state, and the report PDF once it exists | `agenta_audit_show` | `agenta audit show` | none (`download`, `output` are CLI-only) |
| The five statements verification attests to | `agenta_verify_declaration` | `agenta verify declaration` | none |
| Submit business verification for live payments | `agenta_verify_submit` | `agenta verify submit` | `legalName`, `country`, `street`, `city`, `url`, `acceptDeclaration`; `registrationNumber` for a business |
| Where the verification has got to | `agenta_verify_status` | `agenta verify status` | none |
| Send back for review after the changes we asked for | `agenta_verify_resubmit` | `agenta verify resubmit` | none |
| Create a product (one-time) or a subscription plan | `agenta_products_create` | `agenta products create` | `name`, `amount` (+ `interval` with `subscription`) |
| List products and plans | `agenta_products_list` | `agenta products list` | none |
| Create a checkout session | `agenta_pay_checkout` | `agenta pay checkout` | `amount` |
| Get checkout session status | `agenta_pay_get` | `agenta pay get <sessionId>` | `sessionId` |
| List checkout sessions | `agenta_pay_list` | `agenta pay list` | none |
| List subscriptions | `agenta_subscriptions_list` | `agenta subscriptions list` | none |
| Cancel a subscription (at period end by default) | `agenta_subscriptions_cancel` | `agenta subscriptions cancel <id>` | `id` |
| Move a subscription to another plan | `agenta_subscriptions_change_plan` | `agenta subscriptions change-plan <id>` | `id`, `to` |
| List customers | `agenta_customers_list` | `agenta customers list` | none |
| List invoices | `agenta_invoices_list` | `agenta invoices list` | none |
| The receipt PDF for a paid invoice | `agenta_invoices_receipt` | `agenta invoices receipt <id>` | `id` |
| Re-send the receipt email to the buyer on file | `agenta_invoices_send_receipt` | `agenta invoices send-receipt <id>` | `id` |

## Facts to get right

- Connecting is the only human step; it also creates the account. Login and logout are not tools.
- Create a product once. There is no `subscriptions.create()`; a buyer paying for a plan is what creates the subscription.
- `linkId` (UUID) ≠ buyer link (`/pay/…` URL) ≠ `sessionId` (one checkout).
- Logged-in users get a checkout created with `linkId` + `metadata` from the SDK, never the shared `/pay/…` link.
- Payment proof = webhook event or `checkouts.retrieve(sessionId).status === 'completed'`, never the redirect.
- Card numbers are typed on the hosted checkout only. Never send a card number to a tool, the API, or the CLI.
- Everything is test mode until the merchant is verified and connected as Live; the code does not change.
- API keys stay on the server. Never ship one to a browser or a mobile app.

## Common issues

| Issue | Cause | Fix |
|---|---|---|
| No `agenta_*` tools in the session | Not connected | Claude Code: `/mcp` → `agentaos` → Authenticate. Elsewhere: add the connector `https://mcp.agentaos.ai/mcp`. |
| `… failed: Invalid API key` | Connection revoked on app.agentaos.ai → Developers | Reconnect (Authenticate / re-add the connector). |
| `--success-url must be an https:// URL` (same for `cancelUrl`) | Plain http or localhost | Use the app's deployed https URL (or an https tunnel while developing). |
| `--subscription needs --interval month or --interval year` | Plan without a cadence | Add `"interval":"month"` or `"year"`. |
| `Missing required flags: --legal-name, …` | Verification fields absent | Ask the user for each named field, then call once with all of them. |
| Webhook handler rejects with 400 | Signature check failed | Verify against the raw request body with the secret from Settings → Developers → Webhooks. |
| Live money not arriving | Merchant not verified, or connected as Test | Run `agenta_status_get`; follow `goLive.next`. Reconnect and pick Live once verified. |
| Checkout list empty | No checkouts yet | Create one with `agenta_pay_checkout`. |
| Timeout / network error | Server unreachable | Retry once. If it persists, check the connection or server status. |

## No MCP where you run? Use the CLI

Terminals, headless agents and CI get the same 19 operations from the `agenta` CLI:

```bash
curl -fsSL https://agentaos.ai/install | bash   # or: npm install -g agentaos (Node.js 20+)
agenta login                                    # browser approval; creates the account if the email is new
agenta status --json
```

Commands and flags mirror the tools 1:1: `agenta_products_create` `{"trialDays":14}` is `agenta products create --trial-days 14`; an `id`/`sessionId` key is the positional argument; `dryRun: true` is `--dry-run`. Pass `--json` for the same JSON the tools return as `structuredContent`; without it the CLI prints the same sentence the tool puts in `content`. `agenta login` is the only command that needs a human (allow a long timeout, it polls for browser approval); sessions last 7 days. `agenta audit show` and `agenta invoices receipt` save the PDF next to you (`-o <file>`). For the complete reference, read `https://docs.agentaos.ai/llms-full.txt`, one plain-text file for agents. Do not web-search.
