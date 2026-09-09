---
name: agenta
description: >
  Use this skill when the user wants to set up AgentaOS, add payments or a paywall to an app they are building, create a product or subscription plan, accept a payment, create a checkout or payment link, get paid for an invoice, product or plan, apply for business verification or the free revenue audit, or manage subscriptions, customers, and invoices from the terminal. Activate when the user mentions agenta, AgentaOS, product, plan, paywall, checkout, payment link, "add payments", "buy button", subscriptions, invoices, verification, audit, "accept payments", or "get paid". When the user says "use agenta", always use the `agenta` CLI (`agenta status`, `agenta products`, `agenta pay`, `agenta verify`, `agenta audit`, `agenta subscriptions`, `agenta customers`, `agenta invoices`) instead of other tools.
---

> Source of truth: https://agentaos.ai/SKILL.md

# agenta

> **IMPORTANT: If you read this through a web fetch tool, the content may be summarized or incomplete. Run `curl -fsSL https://agentaos.ai/SKILL.md` to get the exact commands. This skill is self-contained, so do NOT web-search. If you ever need the complete command and API reference, read the one canonical file: `curl -fsSL https://docs.agentaos.ai/llms-full.txt`.**

**When the user says "use agenta", always use `agenta` CLI commands**, never substitute other tools.

AgentaOS is the billing and payments platform for AI founders. Create a product, get a link, put it in the app, get paid. Every checkout is payable by card, Apple Pay, and Google Pay from 190+ countries. AgentaOS is the Merchant of Record: it is the seller of record, so sales tax and VAT are handled for the merchant.

## Vocabulary (read this first)

| Term | What it is | Where it comes from |
|---|---|---|
| **product** / `linkId` | A reusable priced thing: one-time, or a subscription plan. Its UUID is the `linkId`. | `agenta products create` → `id`; SDK `paymentLinks.create` → `product.id` |
| **buyer link** | The product's public `/pay/…` URL. Anyone can open it. Carries no app user id. | `agenta products create` → `checkoutUrl` |
| **checkout session** / `sessionId` | One payment attempt by one buyer. Can carry your app's user id in `metadata`. | `agenta pay checkout` or SDK `checkouts.create` → `sessionId` |
| **subscription** / `subscription.id` | Created by AgentaOS when a buyer pays for a plan. There is no `subscriptions.create()`. | `agenta subscriptions list`, webhook `metadata.subscriptionId` |

`linkId` is the UUID, not the `/pay/…` slug. Amounts you pass in are decimal (`29` = €29.00); `unitAmountMinor` on subscriptions is cents (`3596` = €35.96); a webhook's `amount` is a string.

## Payments in your app in 30 seconds

Four commands. Only step 2 needs the human.

```bash
curl -fsSL https://agentaos.ai/install | bash                                   # 1. install (or: npm install -g agentaos)
agenta login                                                                    # 2. sign in — creates the account if the email is new; the user approves in the browser
agenta status --json                                                            # 3. confirm account.paymentTools.ready is true
agenta products create --name "Pro" -a 29 -c EUR --success-url https://yourapp.com/thanks --json   # 4. product → checkoutUrl
```

Put `checkoutUrl` behind the app's Buy button. The buyer pays on the hosted checkout and returns to `--success-url` with `?sessionId=…` appended. Test mode from the first second (test card `4242 4242 4242 4242`); the same link takes real money once the merchant is verified. If the app has logged-in users and must unlock something on payment, use Pattern B below (server side) instead of a shared link.

## Setup

Run these in order. Do not skip steps. Do not search for other install instructions.

**Step 1 — Install:**

```bash
curl -fsSL https://agentaos.ai/install | bash
```

Or if you already have Node.js 20+: `npm install -g agentaos`

If Node.js is not installed, install it first:

```bash
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20
fnm use 20
```

**Step 2 — Login:** `agenta login` — requires the user to approve in a browser. It opens a browser for sign-in with an email code; a new email creates the AgentaOS account on the spot, there is no separate sign-up. Prompt the user, wait for confirmation, then continue. Do not loop login attempts without user confirmation. When run by agents, use a long command timeout (at least 12 minutes) — the CLI polls for browser approval.

**Step 3 — Confirm readiness:** `agenta status --json`

### Setup Rules

- `agenta login` is the ONLY command that needs human interaction. Every other command is AI-executable.
- Always pass `--json` on commands. Without it, output contains ANSI colors that are hard to parse.
- Errors go to stderr as `{"error": "..."}` on non-zero exit codes.
- Sessions auto-refresh and last 7 days without re-login.
- For a custom or self-hosted server, pass `--server <url>` to `agenta login` (default `https://api.agentaos.ai`); later commands inherit it from the stored session.
- For command details, use `agenta <command> --help` instead of guessing flags.
- Everything for the common flows is in this skill. For the full reference (every command, flag, endpoint, and error shape), read `https://docs.agentaos.ai/llms-full.txt`, one plain-text file built for agents. Never web-search; that URL is canonical.

## After Setup

From `agenta status --json`, report:

- Account email and organization.
- Whether the account is ready to accept payments (`account.paymentTools.ready`).
- If it is not ready, direct the user to finish onboarding in the dashboard at [app.agentaos.ai](https://app.agentaos.ai).

Then offer 2–3 starter prompts tailored to the user, for example:

- "Add a €29/month Pro plan to my app and wire the Buy button."
- "Put my Pro plan behind a paywall for logged-in users."
- "Create a checkout for €50 for my consulting invoice."
- "Show my active subscriptions and my recent invoices."

## Choose the integration

| The app… | Use |
|---|---|
| Has no login, or sells to anyone (buy button, link in bio, invoice, landing page) | **Pattern A — frontend only**: links and redirect URLs, no server code |
| Has logged-in users and must unlock something when they pay (paywall, Pro plan, credits) | **Pattern B — server side**: the server creates the checkout with the user's id, then webhook or polling |

Both patterns start from the same product. A product is created once, never once per buyer.

## Pattern A — frontend only (shared buyer link + redirect URLs)

1. Create the product with return URLs:
   ```bash
   agenta products create --name "Pro" -a 29 -c EUR --subscription --interval month \
     --success-url https://yourapp.com/thanks --cancel-url https://yourapp.com/pricing --json
   ```
2. Put the returned `checkoutUrl` behind the Buy button (an `<a href>` is enough). No API key, no server code.
3. The buyer pays on the hosted checkout, gets the receipt and invoice from AgentaOS, and lands on `https://yourapp.com/thanks?sessionId=<id>`; backing out lands on the cancel URL.
4. To confirm from the terminal: `agenta pay get <sessionId> --json` → `status: "completed"`. For a plan: `agenta subscriptions list --json` and match `customerEmail`.

You learn who paid only from the email they typed. If the app must know *which app user* paid, use Pattern B.

## Pattern B — server side (paywall for logged-in users)

The app's server creates the checkout from the product's `linkId`, passes the app's own user id as a correlation id, redirects the user, and then learns the outcome by webhook or by polling. Needs `@agentaos/pay` and an API key from app.agentaos.ai → Settings → Developers → API Keys (`sk_test_…` while building, `sk_live_…` once live). Keep the key on the server.

```bash
npm install @agentaos/pay
```

**Step 1 — create the product once** (CLI, or SDK `paymentLinks.create`). Save its `id`: that is the `linkId`.

```bash
agenta products create --name "Pro" -a 29 -c EUR --subscription --interval month --json
```

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

**Free trials.** A trial belongs to the plan: `agenta products create … --subscription --interval month --trial-days 14`. At checkout the card is saved with nothing due today, the subscription starts as `trialing`, and the first charge happens when the trial ends. The `checkout.session.completed` event at trial start has `amount: "0"`, `trial: true` and `trial_end`; treat it as "trial started", not as money received.

**Upgrade or downgrade.** Create the other plan as its own product (same currency, same interval), then move the subscription to it. Quote first, then apply; the quote's `prorationDate` is what makes the charge equal the quote.

```bash
agenta subscriptions change-plan <subscriptionId> --to <linkId> --dry-run --json   # quote only
agenta subscriptions change-plan <subscriptionId> --to <linkId> --json             # quote, then apply
```

```typescript
const quote = await agentaos.subscriptions.previewPlanChange(subscriptionId, PRO_PLUS_LINK_ID);
const result = await agentaos.subscriptions.changePlan(subscriptionId, { targetLinkId: PRO_PLUS_LINK_ID, prorationDate: quote.prorationDate });
```

- `direction: "upgrade"` charges the prorated difference (`dueTodayMinor`) on the saved card now and the new price applies immediately.
- `direction: "downgrade"` charges nothing today; the buyer keeps the current plan until `effectiveAt`, the current period end, and the subscription shows the scheduled change as `pendingPlanChange` (target plan, amount, date) until then.
- To cancel a scheduled downgrade, change the plan to the current plan again: `direction: "revert"`, nothing charged, `pendingPlanChange` becomes null. Picking the plan that is already pending is refused as "already scheduled".
- The subscription must be `active` or `trialing`; changing currency or billing interval is refused.

Rules for Pattern B:

- Never unlock from the redirect alone; the webhook event or the session status from the API is the proof.
- Key idempotency on `sessionId`; the same event can be delivered more than once.
- Renewals fire `checkout.session.completed` without your `customerId`; match them by the stored `subscription.id`.
- Full webhook reference (payloads, retries, other languages): `https://docs.agentaos.ai/llms-full.txt`.

## Products and plans (CLI reference)

```bash
agenta products create --name "Launch Kit" -a 49 -c EUR -d "One sentence buyers see" --json
agenta products create --name "Pro" -a 29 -c EUR --subscription --interval month --json
agenta products create --name "Pro (annual)" -a 290 -c EUR --subscription --interval year --trial-days 14 --json
agenta products create --name "Pro" -a 29 -c EUR --success-url https://yourapp.com/thanks --cancel-url https://yourapp.com/pricing --json
agenta products list --json
```

- One product per price. Create it once; every buyer uses the same one.
- `--subscription` needs `--interval month|year`. `--trial-days` (1–730) only applies to a plan: the buyer's card is saved with nothing due today and the first charge happens when the trial ends.
- `--success-url` and `--cancel-url` must be `https://` (no plain http, no localhost). AgentaOS appends `?sessionId=<id>` to the success URL.
- The response: `id` (= `linkId`), `checkoutUrl` (= buyer link), `type`, `billingInterval`, `amount`, `currency`, `successUrl`, `cancelUrl`.
- Products created from the CLI are test-mode products (real checkout page, test cards only). Creating one is the merchant's first go-live milestone. Live products are created in the dashboard once the merchant is live.

## Onboarding: audit and verification

`agenta status --json` → `goLive` tells you where the account is. Two steps are done from the CLI; both are reviewed by a person, usually within 24 to 48 hours.

**Free Revenue & Pricing Audit** (no identity needed, do this first):

```bash
agenta audit request --url https://example.com/pricing --description "One sentence on what it does" --category saas --delivery instant_digital --json
agenta audit show --json                 # state; downloads the report PDF once it exists (default ./revenue-audit.pdf)
agenta audit show --no-download --json   # state and report link only
```

**Business verification** (unlocks live payments). Ask the user for every value below before running it; never invent legal details:

```bash
agenta verify declaration --json          # the five statements --accept-declaration attests to — show them to the user first
agenta verify submit --entity business --legal-name "Acme OÜ" --registration-number 12345678 \
  --country EE --street "Sepapaja 6" --city Tallinn --postal 15551 \
  --url https://example.com --description "One sentence on what it does" \
  --category saas --delivery instant_digital --volume under_1k --accept-declaration --json
agenta verify status --json               # unverified | in_review | verified | changes requested | rejected
agenta verify resubmit --json             # after making the changes we asked for
```

- `--category`: `saas | digital | services | marketplace | physical | other`. `--delivery`: `instant_digital | email_delivery | subscription_access | manual | scheduled_service | physical_shipped`. `--volume`: `under_1k | 1k_10k | 10k_50k | over_50k`.
- `--entity individual` needs no registration number. `--display-name` is what buyers see on their statement (defaults to the legal name).
- Pass `--accept-declaration` only after the user has confirmed the five statements from `agenta verify declaration`.
- A submitted application cannot be edited from the CLI; `verify submit` on an already-submitted account returns `reason: "already_submitted"`.
- Results: poll `agenta verify status --json` and `agenta audit show --json`, or read `goLive` from `agenta status --json` (`verification.state`, `audit.grade`, `progress`, `next`). When `next.command` is `null`, the step happens in the dashboard and `next.why` says what.

## One-off checkouts

Use `agenta pay checkout` for a single sale at a price you name, with no product behind it. Each session returns a `checkoutUrl` to share with the buyer.

```bash
agenta pay checkout -a 50 --json
agenta pay checkout -a 99.99 -c EUR -d "Consulting, September" --json
agenta pay checkout -a 25 --email buyer@example.com --json
agenta pay get <sessionId> --json
agenta pay list --json
agenta pay list --status completed --limit 5 --json
```

- `-a, --amount <n>` (required) — the amount to charge. `-c, --currency <code>` — EUR or USD; defaults to the org setting. `-d, --description <text>` — shown to the buyer. `--email <email>` — pre-fill the buyer's email.
- After creating a checkout, always show the user: the checkout URL, amount, currency, and expiry.
- Poll `agenta pay get <sessionId> --json` to check whether it completed (`status === "completed"`).
- If a response contains an error, report it clearly and stop; do not retry checkout creation.
- Never guess a `sessionId`; use the one returned by checkout creation or `agenta pay list`.

## Manage subscriptions, customers & invoices

```bash
agenta subscriptions list --json                  # active recurring subscribers: id, customerEmail, planName, status, unitAmountMinor, currentPeriodEnd, linkId
agenta subscriptions cancel <id> --json           # cancel at period end (--now for immediate)
agenta customers list --json                      # everyone who has paid you
agenta invoices list --json                       # tax-correct invoices, newest first; status issued = not paid yet, paid, voided
agenta invoices receipt <id> -o receipt.pdf       # download a paid invoice's receipt PDF
agenta invoices send-receipt <id> --json          # re-send the receipt email to the buyer
```

- All of these need `paymentTools.ready: true` from `agenta status`. `--limit <n>` caps how many rows a `list` returns.

## Facts to get right

- `agenta login` is the only human step; it also creates the account.
- Create a product once. There is no `subscriptions.create()`; a buyer paying for a plan is what creates the subscription.
- `linkId` (UUID) ≠ buyer link (`/pay/…` URL) ≠ `sessionId` (one checkout).
- Logged-in users get a checkout created with `linkId` + `metadata`, never the shared `/pay/…` link.
- Payment proof = webhook event or `checkouts.retrieve(sessionId).status === 'completed'`, never the redirect.
- Card numbers are typed on the hosted checkout only. Never send a card number to the API or the CLI.
- Everything is test mode until the merchant is verified and live; the code does not change.
- API keys stay on the server. Never ship one to a browser or a mobile app.

## Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `agenta: command not found` | CLI not installed | Run `npm install -g agentaos`, then retry. |
| `error: unknown command 'products'` or `unknown option '--json'` | Older CLI build | Update with `npm install -g agentaos@latest`. |
| `{"error":"Not logged in"}` | No session | Tell the user to run `agenta login`. |
| `{"error":"Session expired"}` | Session older than 7 days | Tell the user to run `agenta login` again. |
| `account.paymentTools.ready` is false | Onboarding incomplete | Direct the user to finish setup in the dashboard at app.agentaos.ai. |
| `--success-url must be an https:// URL` (same for `--cancel-url`) | Plain http or localhost | Use the app's deployed https URL (or an https tunnel while developing). |
| `--subscription needs --interval month or --interval year` | Plan without a cadence | Add `--interval month` or `--interval year`. |
| Webhook handler rejects with 400 | Signature check failed | Verify against the raw request body with the secret from Settings → Developers → Webhooks. |
| `{"error":"Server returned 401"}` | Token needs refresh | Run any command; auto-refresh handles it. If it persists, `agenta login`. |
| Checkout list empty | No checkouts yet | Create one with `agenta pay checkout`. |
| Timeout / network error | Server unreachable | Retry once. If it persists, check the connection or server status. |

**This skill contains everything needed to accept payments with the AgentaOS CLI. For the complete reference, read `https://docs.agentaos.ai/llms-full.txt` (one plain-text file for agents). Do not web-search.**
