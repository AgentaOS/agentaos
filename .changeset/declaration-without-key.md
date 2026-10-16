---
"agentaos": patch
---

`agenta_verify_declaration` (and `agenta verify declaration`) now answers without an API key. It only returns the verification statements, so it no longer fails with "Not authenticated" for merchants who have not created a key yet, or for directories that test the server.
