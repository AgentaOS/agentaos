---
'@agentaos/pay': minor
---

`bankAccounts`: a platform saves bank accounts for the businesses it manages, from its own app, once we have opened bank accounts by API for it. `requirements(currency)`, `refreshRequirements(params)`, `create(params)`, `list()`, `deactivate(id)`, each taking `{ business }`. The business's share now carries `platformFee.fixedDisplay`, the fixed part printed as money.
