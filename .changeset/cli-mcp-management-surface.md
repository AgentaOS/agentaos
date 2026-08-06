---
"agentaos": minor
---

Add subscription/customer/invoice management to the CLI and MCP server, mirroring the @agentaos/pay management surface

- `agenta subscriptions list` / `agenta subscriptions cancel <id>` — list and cancel subscriptions (cancel at period end by default, `--now` for immediate)
- `agenta customers list` — list customers who have paid you
- `agenta invoices list` / `agenta invoices receipt <id>` / `agenta invoices send-receipt <id>` — list invoices, download a receipt PDF, re-send the receipt email
- New MCP tools: `agenta_pay_list_subscriptions`, `agenta_pay_cancel_subscription`, `agenta_pay_list_customers`, `agenta_pay_send_receipt`
