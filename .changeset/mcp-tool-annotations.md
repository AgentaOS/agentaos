---
"agentaos": minor
---

Every MCP tool now has a title and annotations (readOnlyHint, destructiveHint, openWorldHint), derived from a required `title` and `effect` on each operation. Clients such as Claude can tell reads from writes and ask before destructive calls.
