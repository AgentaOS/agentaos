# @agentaos/migrate

Move your products, plans and discount codes from **Paddle, Lemon Squeezy, Creem or Gumroad** to [AgentaOS](https://agentaos.ai), the merchant of record for AI agents, in one command. Your old account is only read, never changed.

```bash
export PADDLE_API_KEY=...        # or LEMONSQUEEZY_API_KEY, CREEM_API_KEY, GUMROAD_ACCESS_TOKEN
npx @agentaos/migrate --from paddle            # dry run: reads, plans, creates nothing

export AGENTAOS_API_KEY=sk_test_...
npx @agentaos/migrate --from paddle --apply    # creates the products and codes
```

Prefer to ask your agent? With the AgentaOS plugin in Claude Code, say "move me off Paddle" and the `agentaos-migrate` skill runs these steps with you.

## What moves

| | Moves | Notes |
|---|---|---|
| One-time products | Yes | Name, description, price, image |
| Subscription plans | Yes | Monthly and yearly, with trials |
| Discount codes | Yes | On AgentaOS a code takes money off the first invoice |
| Subscribers | Listed | `subscribers.csv`: plan, renewal date and new link for each |
| Saved cards | No | See below |

Anything that cannot move as-is (quarterly or weekly billing, currencies other than EUR or USD, free or pay-what-you-want products, fixed-amount codes in another currency) is left behind and listed in `skipped.csv` with the reason, so you can recreate it by hand. Country-specific price overrides (Paddle) are not moved: each plan keeps its base price.

## Your subscribers

Saved cards stay with your old provider: Paddle, Lemon Squeezy, Creem and Gumroad do not hand card details to another seller. So each subscriber subscribes once on the new link:

1. `subscribers.csv` lists everyone with their renewal date and new link.
2. `email-to-subscribers.md` is a short email to send a week or two before each renewal.
3. `--apply --switch-code` makes one code that makes their first invoice on AgentaOS free, because they already paid for the current period. It is random, capped at your number of subscribers, and expires in 60 days. If a plan has a trial, moved subscribers get that trial too; remove it from the plan in the dashboard before you email them if you do not want that.
4. When someone subscribes on AgentaOS, cancel their old subscription at the end of the period they paid for.

## Output

Everything goes to `./agentaos-migration` (change it with `--out`):

| File | What it is |
|---|---|
| `summary.md` | What was found, what was created, next steps |
| `products.csv` | Each old product with its new product id and link |
| `redirects.csv` | Old buy link to new link, to swap on your site |
| `subscribers.csv` | Subscribers with plan, renewal date and new link |
| `email-to-subscribers.md` | The email to send them |
| `skipped.csv` | What stayed behind, and why |

`subscribers.csv` holds your customers' emails. It stays on your machine, and the folder gets its own `.gitignore` so it is never committed.

## Options

```
--from <paddle|lemonsqueezy|creem|gumroad>   where you are moving from
--apply                                      create in AgentaOS (default: dry run)
--switch-code                                one-off first-invoice-free code for subscribers
--test                                       Paddle sandbox or Creem test mode
--out <dir>                                  report folder
```

Running `--apply` again is safe: products are matched by the old id kept in their metadata, and codes by code.

## Use it from code

```typescript
import { AgentaOS } from '@agentaos/pay';
import { applyPlan, buildPlan, readSource, writeReport } from '@agentaos/migrate';

const plan = buildPlan(await readSource('lemonsqueezy', process.env.LEMONSQUEEZY_API_KEY!));
const result = await applyPlan(new AgentaOS(process.env.AGENTAOS_API_KEY!), plan, { switchCode: true });
await writeReport('agentaos-migration', plan, result);
```

## License

Apache-2.0
