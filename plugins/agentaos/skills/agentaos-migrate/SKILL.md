---
name: agentaos-migrate
description: >
  Use this skill when the user wants to move, switch or migrate their payments, products, subscription plans, discount codes or subscribers from Paddle, Lemon Squeezy, Creem or Gumroad to AgentaOS. Activate on "migrate to AgentaOS", "switch from Paddle", "move off Lemon Squeezy", "leave Gumroad", "import my products", "move my subscribers". Runs the `@agentaos/migrate` CLI: a dry run first, then apply after the user approves, then helps the user move their subscribers.
---

# Move to AgentaOS

You help a seller move from Paddle, Lemon Squeezy, Creem or Gumroad to AgentaOS with `npx @agentaos/migrate`. The tool only **reads** the old account (GET requests); it never changes or cancels anything there.

## What moves, said plainly

- **Moves:** products, prices, monthly and yearly plans, trials, discount codes.
- **Listed, not moved:** active subscribers, with their plan, renewal date and new link.
- **Does not move:** saved cards. The old provider holds them and does not hand them over. Each subscriber subscribes once on the new link, timed to their renewal date, so nobody pays twice. Say this to the user before they start. Do not promise a card transfer.
- **Left behind with a reason:** quarterly or weekly billing, currencies other than EUR or USD, free or pay-what-you-want products, codes AgentaOS cannot express. All are in `skipped.csv`.

## Steps

1. **Ask which provider** they are leaving, if they have not said.
2. **Keys go in the environment, never in the chat or a flag.** Ask the user to set the key themselves in their terminal:
   - Paddle: `PADDLE_API_KEY` (a key with read permissions)
   - Lemon Squeezy: `LEMONSQUEEZY_API_KEY`
   - Creem: `CREEM_API_KEY`
   - Gumroad: `GUMROAD_ACCESS_TOKEN`
   - AgentaOS: `AGENTAOS_API_KEY` from app.agentaos.ai, Settings, Developers. Start with an `sk_test_` key.
   If the user pastes a key into the chat, do not repeat it, and suggest they rotate it.
3. **Dry run:** `npx @agentaos/migrate --from <paddle|lemonsqueezy|creem|gumroad>`. Add `--test` for Paddle sandbox or Creem test mode.
4. **Show the plan** from `agentaos-migration/summary.md`: how many products, codes and subscribers, and every line in `skipped.csv` with its reason. Ask what to do about each skipped item (usually: create it by hand on a monthly or yearly cadence, or set a EUR or USD price).
5. **Apply only after the user says yes:** `npx @agentaos/migrate --from <source> --apply`. Add `--switch-code` if they have subscribers: it makes one code, capped at their number of subscribers and valid for 60 days, that makes the first invoice on AgentaOS free, because they already paid the old provider for the current period. Running it again is safe: it finds what it already made.
6. **Check it:** open one new link from `products.csv` and pay with the test card `4242 4242 4242 4242`. With the AgentaOS tools connected, `agenta_products_list` shows the new products.
7. **Swap links:** `redirects.csv` maps each old buy link to the new one. Offer to replace them in the user's code (search the repo for the old URLs, or for the old price or variant ids in `products.csv`).
8. **Subscribers:** `subscribers.csv` has each subscriber's plan, renewal date and new link, and `email-to-subscribers.md` has a short email. The user sends it from their own email, a week or two before each renewal. You never send email for them. Rows with a note need a choice first (for example a Gumroad tier).
9. **Close the loop:** when a subscriber pays on AgentaOS, the user cancels that subscriber's old subscription at the end of the paid period, in the old provider's dashboard.

## Going live

Everything works in test mode first. Real money needs the AgentaOS account verified: `agenta_status_get` says what is left. Then run step 5 again with an `sk_live_` key.

## Card transfer

Moving saved cards directly is possible only between card processors that both agree, takes weeks, and merchant-of-record providers do not offer it. If the user insists, send them to hello@agentaos.ai. Do not promise it.
