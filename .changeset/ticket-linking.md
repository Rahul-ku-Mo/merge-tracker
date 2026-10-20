---
"merge-tracker": minor
---

Ticket links: set a Jira or Linear base URL in Settings, and each MR whose branch or title contains a key like ABC-123 gets a linked key chip. The branch name is checked first, then the title. The feature is off until you set a base URL. Branch names like `release-2` can still match as a key, so check the chip if your branches use that pattern.
