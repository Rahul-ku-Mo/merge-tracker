# Chrome Web Store Listing — copy & answers

Everything you need to paste into the Developer Dashboard. Copy each block as‑is.

---

## Item name

```
Merge Request Tracker
```

## Summary (≤132 chars)

```
Track your GitLab, GitHub & Bitbucket merge/pull requests in one place and get notified when their status changes.
```

## Detailed description

```
Merge Request Tracker keeps all your open work in one place. Connect GitLab,
GitHub, and Bitbucket accounts and see every merge/pull request assigned to,
created by, or involving you — without switching tabs.

Features
- Multiple providers and accounts at once (GitLab, GitHub, Bitbucket)
- Self-hosted GitLab and GitHub Enterprise supported
- Desktop notifications when a request is opened or changes status
- Filter by scope (assigned to me / created by me / all) and state
- Lightweight, fast, and private

Privacy first
- Runs entirely in your browser. There is no backend server.
- Your tokens and data never leave your device, except for requests sent
  directly to the provider you configured.
- No analytics, no tracking, no third parties.

You authenticate with a read-only personal access token (GitLab/GitHub) or app
password (Bitbucket) that you create yourself and paste into Settings.
```

## Category

```
Developer Tools
```

## Privacy policy URL

Host `docs/privacy-policy.md` somewhere public (e.g. GitHub Pages or a Gist) and
paste the URL here. Example:

```
https://<your-username>.github.io/mr-tracker/privacy-policy.html
```

---

## Single purpose (Privacy tab)

```
This extension has a single purpose: to fetch and display the signed-in user's
merge/pull requests from GitLab, GitHub, and Bitbucket and notify them when a
request's status changes.
```

## Permission justifications (Privacy tab)

Paste one justification per permission.

**storage**
```
Stores the user's settings and the access token/app password they enter, plus a
local cache of fetched merge/pull requests, in chrome.storage.local on their own
device. Nothing is sent to the developer.
```

**alarms**
```
Schedules a periodic background sync so the extension can fetch new requests and
surface notifications at the user-chosen interval without keeping a tab open.
```

**notifications**
```
Shows a desktop notification when a new merge/pull request appears or an existing
one changes status, based on the user's preferences.
```

**Host permission: https://gitlab.com/*, https://api.github.com/*, https://api.bitbucket.org/***
```
Required to make authenticated read requests directly to the official provider
APIs to fetch the user's merge/pull requests.
```

**Optional host permission: https://*/***
```
Requested only at runtime, with the user's explicit approval, when the user adds
a self-hosted GitLab or GitHub Enterprise server. It is used solely to call that
server's API to fetch the user's merge/pull requests. Most users never grant it.
```

---

## Data usage disclosures (Privacy tab checkboxes)

- **What data do you collect?** Check **Authentication information**
  (the access token / app password the user enters).
  - Optionally also **Personally identifiable information** is *not* collected by
    the developer — the token stays on-device, so you generally do **not** check
    other categories.
- **How is the data used?** Select: **App functionality** only.
- Certify the three required statements:
  - [x] I do **not** sell or transfer user data to third parties (outside approved use cases).
  - [x] I do **not** use or transfer user data for purposes unrelated to the item's single purpose.
  - [x] I do **not** use or transfer user data to determine creditworthiness or for lending.

Rationale: the token never leaves the user's device, and the developer operates
no server, so no data is collected by the developer or transferred to third
parties.

---

## Assets you still need to produce

- **Icon 128×128** — already bundled (`icons/icon128.png`).
- **At least 1 screenshot** — 1280×800 or 640×400 PNG/JPEG. Capture the popup
  with a few requests and the Settings page.
- **Small promo tile (optional)** — 440×280.

---

## Pre-submit checklist

- [ ] `pnpm zip` produced `mr-tracker.zip` (manifest.json at the root).
- [ ] Version bumped in `package.json` for each new upload.
- [ ] Privacy policy hosted and URL added.
- [ ] Single purpose + permission justifications filled.
- [ ] Data-usage disclosures completed and certified.
- [ ] Visibility set to **Unlisted** (link-only) or **Private** for personal/team use.
- [ ] At least one screenshot uploaded.
```
