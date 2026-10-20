---
"merge-tracker": minor
---

Smarter notifications, with choices in Settings:

- New events: review requested from you, and CI failing on your MR (both on by default).
- Quiet hours: pick a daily window. Notifications are held during it and sent on the first sync after it ends.
- Digest mode: batch a sync's notifications into one summary. Clicking it opens the first MR.

Mention alerts aren't included. They need notification access that this read-only, no-backend extension doesn't have.
