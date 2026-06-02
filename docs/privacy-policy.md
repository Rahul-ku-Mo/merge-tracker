# Privacy Policy — Merge Request Tracker

_Last updated: 2 June 2026_

Merge Request Tracker ("the extension") is a browser extension that displays your
GitLab, GitHub, and Bitbucket merge/pull requests and notifies you when their
status changes.

## Summary

- The extension runs **entirely in your browser**.
- It has **no backend server**. The developer never receives, stores, or sees
  any of your data.
- Your credentials and data **never leave your device**, except for the API
  requests your browser makes **directly to the Git provider you configured**.
- There is **no analytics, tracking, advertising, or third‑party data sharing**.

## What data the extension handles

| Data | Where it comes from | Where it is stored | Purpose |
|------|--------------------|--------------------|---------|
| Access tokens / app passwords | You enter them in Settings | `chrome.storage.local` on your device only | Authenticate API requests to your provider |
| Account settings (host, workspace, scope, filters) | You enter them in Settings | `chrome.storage.local` on your device only | Configure what to fetch |
| Merge/pull request metadata (title, state, author, URL) | The provider's API | `chrome.storage.local` on your device only | Display the list and detect status changes for notifications |

All storage is **local** to your browser profile. None of it is transmitted to
the developer or any third party.

## Where your data goes

When syncing, your browser sends authenticated HTTPS requests **directly** to the
host(s) you configured, for example:

- `https://gitlab.com` (or your self‑hosted GitLab)
- `https://api.github.com` (or GitHub Enterprise)
- `https://api.bitbucket.org`

These requests go from your device straight to the provider. They do not pass
through any server operated by the developer.

## Permissions and why they are needed

- **storage** — save your settings and cached requests locally.
- **alarms** — schedule periodic background syncs.
- **notifications** — show desktop notifications for new/changed requests.
- **Host access** to the provider APIs above — make the read requests that fetch
  your merge/pull requests. Self‑hosted hosts are requested only when you add a
  custom host, and only with your explicit approval.

## Data retention and deletion

- Data persists locally until you remove it.
- Clearing the token fields and saving deletes the stored credentials.
- **Uninstalling the extension permanently deletes all locally stored data.**

## Data sale and sharing

The developer does **not** sell, rent, or share your data with anyone. No data
is collected by the developer in the first place.

## Changes to this policy

Any changes will be reflected in this document with an updated date.

## Contact

Created by Rahul K M. For questions about this policy, contact the developer
through the support contact listed on the Chrome Web Store listing.
