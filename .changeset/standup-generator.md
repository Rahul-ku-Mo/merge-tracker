---
"merge-tracker": minor
---

Standup button in the popup footer copies a Markdown summary of your synced MRs:

- Merged in the last 24 hours.
- Your open MRs still waiting on review (no approvals yet).
- Your MRs with failing CI.
- Reviews you still owe.

It runs on data already on your machine and makes no extra requests. "Merged" uses each MR's last-updated time, since the list doesn't include merge time.
