---
'@agentaos/pay': minor
---

`bankAccounts`: a platform saves bank accounts for the businesses it manages, from its own app, once we have opened bank accounts by API for it. `requirements(currency)`, `refreshRequirements(params)`, `create(params)`, `list()`, `deactivate(id)`, each taking `{ business }`. Adding and retiring need the switch and a live key; the other calls do not.

`platformFee.fixedDisplay` on a business's share: the fixed part of the platform fee, printed as money.
