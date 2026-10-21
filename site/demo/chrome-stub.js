/**
 * Demo-only stand-in for the chrome.* APIs, so the real popup/options UI can run
 * in a plain browser tab (landing page demo + store screenshots).
 * All data below is SYNTHETIC. Scenes: ?scene=list|connect|filtered|muted|blocked|options  &mode=light|dark|system
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

  const mr = (acct, number, title, state, repo, author, min, draft = false, extra = {}) => ({
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
    draft,
    ...extra
  });
  const [gh, gl, bb] = accounts;
  // Detail fields (CI, approvals, review requests, branches) mirror what sync's enrichment fills in.
  const mergeRequests = [
    mr(gl, 1204, "Rate limit per API key, not per IP", "open", "platform/api-gateway", "marcus.t", 8, false,
      { ci: "pass", approvals: 1, sourceBranch: "feat/PLAT-212-key-limits", targetBranch: "main" }),
    mr(gh, 482, "Add retry with backoff to the sync client", "open", "acme/web-app", "priya-n", 17, false,
      { ci: "fail", approvals: 0, authoredByMe: true, sourceBranch: "fix/WEB-88-sync-retry", targetBranch: "main" }),
    mr(bb, 96, "Dark mode: fix tab bar tint on iOS 17", "open", "mobile/ios-app", "jlee", 41, false,
      { ci: "pending", approvals: 1, sourceBranch: "fix/IOS-301-tab-tint", targetBranch: "develop" }),
    mr(gh, 131, "Tokens: introduce semantic spacing scale", "open", "acme/design-system", "sofia.r", 66, false,
      { ci: "pass", approvals: 0, reviewRequestedFromMe: true, sourceBranch: "feat/DS-40-spacing", targetBranch: "main" }),
    mr(gl, 1198, "Upgrade Postgres driver to 5.2", "merged", "platform/api-gateway", "marcus.t", 130),
    mr(gl, 377, "Handle proration on mid-cycle plan change", "open", "platform/billing", "dana.k", 300, false,
      { ci: "pass", approvals: 1, authoredByMe: true, threadsResolved: false, sourceBranch: "feat/BILL-17-proration", targetBranch: "main" }),
    mr(gh, 479, "Fix flaky checkout test on CI", "open", "acme/web-app", "priya-n", 190, true,
      { ci: "pending", approvals: 0, sourceBranch: "fix/WEB-91-flaky-checkout", targetBranch: "main" }),
    mr(bb, 58, "Add staging VPC peering", "open", "infra/terraform", "omar.h", 380, true,
      { ci: "none", approvals: 0, sourceBranch: "infra/staging-peering", targetBranch: "main" }),
    mr(bb, 94, "Remove deprecated push token flow", "closed", "mobile/ios-app", "jlee", 1500),
    // Stacked on !1204: it targets that MR's source branch.
    mr(gl, 1207, "Per-key quota editor in the admin UI", "open", "platform/api-gateway", "marcus.t", 12, false,
      { ci: "pass", approvals: 0, reviewRequestedFromMe: true, sourceBranch: "feat/PLAT-213-quota-ui", targetBranch: "feat/PLAT-212-key-limits" })
  ];

  // Everything counts as "seen" except two, so the "updated" marker shows.
  const fresh = new Set([mergeRequests[0].key, mergeRequests[1].key]);
  const seen = {};
  for (const m of mergeRequests) if (!fresh.has(m.key)) seen[m.key] = m.updatedAt;
  const opened = [mergeRequests[3].key, mergeRequests[4].key];

  const config = {
    accounts: scene === "connect" ? [] : accounts,
    syncIntervalMinutes: 5,
    notifyOn: { newMr: true, statusChange: true, newComment: false, reviewRequested: true, ciFailed: true },
    quietHours: { enabled: false, start: 22, end: 8 },
    digestNotifications: false,
    ticketBaseUrl: "https://acme.atlassian.net/browse/",
    mutedRepos: scene === "muted" || scene === "filtered" ? ["platform/billing", "infra/terraform"].slice(0, scene === "filtered" ? 1 : 2) : [],
    mode,
    display: { themeControls: true, filters: true, sort: true, openAll: true, credit: false }
  };

  const popupPrefs = {
    project: "all",
    state: "all",
    sort: "updated_desc",
    tab: scene === "blocked" ? "needs" : "all",
    group: scene === "filtered" ? "project" : "priority"
  };

  const data = {
    config,
    popupPrefs,
    uiState: { seen, opened, hidden: {} },
    mrSnapshot: { mergeRequests, lastSyncAt: ago(1), lastSyncReason: "alarm" }
  };

  const pick = (keys) => {
    const out = {};
    for (const k of typeof keys === "string" ? [keys] : keys || Object.keys(data)) if (k in data) out[k] = structuredClone(data[k]);
    return out;
  };

  // Load the English catalog synchronously (chrome.i18n.getMessage is sync). The
  // demo pages sit in site/demo/src/<page>/, and public/_locales is copied to site/demo/_locales.
  const en = (() => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "../../_locales/en/messages.json", false);
    xhr.send();
    return xhr.status === 200 ? JSON.parse(xhr.responseText) : {};
  })();

  window.chrome = {
    storage: { local: { get: async (k) => pick(k), set: async (o) => void Object.assign(data, o) } },
    i18n: {
      getMessage: (name, subs) => {
        let msg = en[name]?.message ?? "";
        [].concat(subs ?? []).forEach((s, i) => { msg = msg.replaceAll(`$${i + 1}`, s); });
        return msg;
      },
      getUILanguage: () => "en"
    },
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
