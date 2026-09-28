---
"@agentaos/pay": minor
---

Connect — manage your clients' businesses and act for them, the way Stripe Connect does.
Add `businesses.list/retrieve/create/resendInvitation/revokeInvitation/createVerificationLink()`. `create` invites your client as admin and returns `inviteUrl`; pass `sendInvitationEmail: false` to send it yourself (white-label). `createVerificationLink` is the identity check link only your client can complete (Stripe's Account Links).
Act for a business with `new AgentaOS(key, { business })` or `{ business }` as the last argument of any call — sent as `AgentaOS-Account` (Stripe's `Stripe-Account`).
`WebhookEvent` now lists every event we send — adds `dispute.created`, `dispute.closed`, `account.updated` and `webhook.test` — and each carries `business`: the business it happened in.
Fix: a call answered with 204 No Content resolves instead of failing.
