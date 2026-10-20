---
"merge-tracker": minor
---

New "Blocked on me" filter in the State dropdown. It shows open MRs that need your next action:

- A review is requested from you and not yet given.
- Your MR has failing CI.
- Your GitLab MR has unresolved threads.

Each row shows a chip with the reason. The view covers MRs inside each account's configured scope. GitHub doesn't expose unresolved review threads through its API, so that check is GitLab-only.
