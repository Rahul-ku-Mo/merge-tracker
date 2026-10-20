# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who juggle code reviews across GitLab, GitHub, and Bitbucket. They want to see every merge/pull request assigned to, created by, or involving them, and know when status changes, without switching tabs.

## Product Purpose
Merge Request Tracker is a Manifest V3 Chrome extension (TypeScript, Vite via CRXJS, pnpm). It syncs MRs/PRs from multiple providers and accounts, lists them in a popup, and raises desktop notifications when a request is opened or changes status. Success: a developer never has to open provider tabs to learn what needs their attention.

## Positioning
One unified, private view across providers. It runs entirely in the browser with no backend, uses user-created read-only tokens (app password for Bitbucket), and has no analytics or tracking. Provider-native dashboards cover one provider each, and a hosted aggregator could not truthfully claim the no-backend guarantee.

## Operating Context
- Surfaces: toolbar popup (list, manual sync), options page (providers, accounts, tokens, filters), background service worker (alarms, sync, notifications).
- Chrome may sleep the service worker, so sync runs in the background on alarms and messages, not in the popup.
- Users authenticate by pasting a personal access token into Settings.

## Capabilities and Constraints
- Providers: GitLab (including self-hosted), GitHub (including Enterprise), Bitbucket; multiple accounts at once.
- Filters by scope (assigned to me / created by me / all) and by state.
- Permissions: storage, alarms, notifications. Required hosts are gitlab.com, api.github.com, and api.bitbucket.org. Custom hosts use optional host permissions requested at runtime on a user gesture.
- Distribution: Chrome Web Store, listed as "Merge Request Tracker", category Developer Tools. Listing copy is in docs/store-listing.md and the privacy policy is in docs/privacy-policy.md.
- Terminology: the UI covers both "merge request" (GitLab) and "pull request" (GitHub, Bitbucket).

## Brand Commitments
Public name: "Merge Request Tracker". No other binding brand, voice, or visual commitments were stated. Existing icons are in icons/.

## Evidence on Hand
Store listing copy and privacy policy in docs/. No testimonials, user counts, or benchmarks exist; do not fabricate them.

## Product Principles
- Privacy is a product feature: local-only data, read-only credentials, no third parties.
- One glance beats many tabs: the list is scannable and provider-agnostic.
- Notify on meaningful change only.
- Be honest about provider differences instead of flattening them.
- Ask for extra permissions only when the user takes an action that needs them.

## Accessibility & Inclusion
No specific standard required; follow sensible defaults (keyboard access, contrast, reduced motion).
