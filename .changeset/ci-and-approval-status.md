---
"merge-tracker": minor
---

Each open MR now shows its CI status (pass, fail, or running) and approval count.

- GitLab: head pipeline status and approvals given.
- GitHub: check runs plus commit statuses, and the number of reviewers whose latest review is "Approved".
- Bitbucket: pipeline build statuses and participants who approved.

Approval counts are shown only where the provider reports them, and each provider counts them differently.
