# is-stripe-available

Is Stripe available in your country? And if it isn't, which payment providers pay out there?

Open data for 85 countries and 9 providers (Stripe, PayPal, Paddle, Lemon Squeezy, Polar, Creem, Dodo Payments, Gumroad, Wise), checked against each provider's own country list. Every answer comes with the provider's note.

## CLI

```bash
npx is-stripe-available "North Macedonia"
# North Macedonia: Stripe is NOT available.
# Pays out there: Paddle, Lemon Squeezy, Polar, Creem, Dodo Payments, Gumroad, Wise
# Guide: https://agentaos.ai/countries/north-macedonia

npx is-stripe-available IN       # name or 2-letter ISO code
npx is-stripe-available --list   # every country without Stripe
```

## Library

```js
import { isStripeAvailable, countriesWithoutStripe } from 'is-stripe-available';

const result = isStripeAvailable('RS');
// {
//   country: 'Serbia', iso2: 'RS',
//   stripe: 'no',                 // 'yes' | 'limited' (preview or extended network) | 'no'
//   paysOut: ['paddle', ...],     // providers with bank payouts there
//   limited: [...],               // e.g. PayPal payouts only
//   providers: { stripe: { status, note }, ... },
//   guide: 'https://agentaos.ai/countries/serbia',
//   checked: '2026-10-06'
// }

countriesWithoutStripe(); // ['Albania', 'Andorra', ...]
```

The raw data is exported as `is-stripe-available/data.json`.

## Data

- Source and CSV: [Hugging Face](https://huggingface.co/datasets/agentaos/payment-provider-country-coverage-2026), CC BY 4.0. Also served as JSON at `https://agentaos.ai/data/payment-provider-coverage-2026.json`.
- "yes" means the provider pays out to a local bank there; "limited" usually means PayPal payouts only, an account that can receive but not hold money, or Stripe's preview or extended network.
- Checked monthly. If a cell is wrong for your country, [open an issue](https://github.com/AgentaOS/agentaos/issues).

Maintained by [AgentaOS](https://agentaos.ai/?src=npm-isa), a merchant of record that pays out in countries Stripe doesn't support. The table includes our competitors as they are.
