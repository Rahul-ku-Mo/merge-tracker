/**
 * Demo-only stand-in for the chrome.* APIs, so the real popup/options UI can run
 * in a plain browser tab (landing page demo + store screenshots).
 * All data below is SYNTHETIC. Scenes: ?scene=list|connect|filtered|muted|options  &mode=light|dark|system
 */
(() => {
  const q = new URLSearchParams(location.search);
  const scene = q.get("scene") || "list";
  const mode = q.get("mode") || "system";
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

  const accounts = [
    { id: "a-gh", provider: "github", label: "GitHub", host: "", token: "ghp_demo", workspace: "acme", scope: "needs_my_review", states: ["open"], enabled: true, color: "#1971c2" },
    { id: "a-gl", provider: "gitlab", label: "GitLab", host: "https://gitlab.com", token: "glpat-demo", scope: "assigned_to_me", states: ["open", "merged"], enabled: true, color: "#e8590c" },
    { id: "a-bb", provider: "bitbucket", label: "Bitbucket", host: "", token: "demo", username: "dev", workspace: "mobile", scope: "all", states: ["open"], enabled: true, color: "#2f9e44" }
  ];

  const mr = (acct, number, title, state, repo, author, min, draft = false) => ({
    key: `${acct.id}:${repo}:${number}`,
    accountId: acct.id,
    accountLabel: acct.label,
    provider: acct.provider,
    number,
    title,
    state,
    url: "#",
    author,
    repo,
    updatedAt: ago(min),
    draft
  });
  const [gh, gl, bb] = accounts;
  const mergeRequests = [
    mr(gl, 1204, "Rate limit per API key, not per IP", "open", "platform/api-gateway", "marcus.t", 8),
    mr(gh, 482, "Add retry with backoff to the sync client", "open", "acme/web-app", "priya-n", 17),
    mr(bb, 96, "Dark mode: fix tab bar tint on iOS 17", "open", "mobile/ios-app", "jlee", 41),
    mr(gh, 131, "Tokens: introduce semantic spacing scale", "open", "acme/design-system", "sofia.r", 66),
    mr(gl, 1198, "Upgrade Postgres driver to 5.2", "merged", "platform/api-gateway", "marcus.t", 130),
    mr(gl, 377, "Handle proration on mid-cycle plan change", "open", "platform/billing", "dana.k", 300),
    mr(gh, 479, "Fix flaky checkout test on CI", "open", "acme/web-app", "priya-n", 190, true),
    mr(bb, 58, "Add staging VPC peering", "open", "infra/terraform", "omar.h", 380, true),
    mr(bb, 94, "Remove deprecated push token flow", "closed", "mobile/ios-app", "jlee", 1500)
  ];

  // Everything counts as "seen" except two, so the "updated" marker shows.
  const fresh = new Set([mergeRequests[0].key, mergeRequests[1].key]);
  const seen = {};
  for (const m of mergeRequests) if (!fresh.has(m.key)) seen[m.key] = m.updatedAt;
  const opened = [mergeRequests[3].key, mergeRequests[4].key];

  const config = {
    accounts: scene === "connect" ? [] : accounts,
    syncIntervalMinutes: 5,
    notifyOn: { newMr: true, statusChange: true, newComment: false },
    mutedRepos: scene === "muted" || scene === "filtered" ? ["platform/billing", "infra/terraform"].slice(0, scene === "filtered" ? 1 : 2) : [],
    mode,
    display: { themeControls: true, filters: true, sort: true, openAll: true, credit: false }
  };

  const popupPrefs =
    scene === "filtered"
      ? { project: "platform/api-gateway", state: "all", sort: "updated_desc" }
      : { project: "all", state: "all", sort: "updated_desc" };

  const data = {
    config,
    popupPrefs,
    uiState: { seen, opened },
    mrSnapshot: { mergeRequests, lastSyncAt: ago(1), lastSyncReason: "alarm" }
  };

  const pick = (keys) => {
    const out = {};
    for (const k of typeof keys === "string" ? [keys] : keys || Object.keys(data)) if (k in data) out[k] = structuredClone(data[k]);
    return out;
  };

  window.chrome = {
    storage: { local: { get: async (k) => pick(k), set: async (o) => void Object.assign(data, o) } },
    runtime: {
      sendMessage: async () => ({ ok: true, count: mergeRequests.length, notified: 0, reason: "manual", errors: [] }),
      openOptionsPage: () => {},
      getURL: (p) => p
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { create: () => {} },
    alarms: { create: () => {}, clear: async () => true }
  };
})();

// Headless captures can land mid-page once async content renders; keep demos at the top.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("load", () => setTimeout(() => window.scrollTo(0, 0), 300));
