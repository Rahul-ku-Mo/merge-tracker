---
"merge-tracker": minor
---

Stacked MRs now show as a chain. When an MR's target branch is another open MR's source branch, it's indented under that MR with a "Stacked on <branch>" hint, so you can see the review order at a glance.

Detection works within one repo and one account. It only links an MR when there's exactly one match, so ambiguous cases stay flat. GitHub branch names come from the pull detail request, so they're only filled in for open PRs.
