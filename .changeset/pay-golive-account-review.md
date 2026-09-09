---
"@agentaos/pay": minor
---

Add `goLive.get()` and `accountReview.get/submit/resubmit/requestAudit()` so the CLI and the MCP tools share one client for onboarding.
Add the `orgId` client option: a session-token user who belongs to several organizations names the one to act for, and it goes on every request as `?orgId=`.
Export the plan-change types (`PlanChangePreview`, `ChangePlanParams`, `ChangePlanResult`, `PlanChangeDirection`, `PendingPlanChange`) that `subscriptions.previewPlanChange/changePlan` already return.
