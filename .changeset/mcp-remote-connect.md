---
"@agentaos/mcp-remote": patch
---

The hosted connector answers GET with 405 and replies with plain JSON (a stateless server has nothing to stream), and every tool passes `business` on, so a platform acting for a managed business never runs as itself.
