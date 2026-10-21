import {
  getConfig,
  getMrSnapshot,
  getPopupPrefs,
  getUiState,
  setConfig,
  setPopupPrefs,
  setUiState
} from "../lib/storage";
import { requireElement } from "../lib/dom";
import { applyI18n, t } from "../lib/i18n";
import { initModeControl } from "../lib/theme";
import { hydrateIcons, iconSvg } from "../lib/icons";
import { initConnectPanel } from "./connect";
import { type Bucket, bucketOf, headlineReason, inTab, shortAge } from "../lib/triage";
import { buildStandup } from "../lib/standup";
import { type StackRow, orderStacks } from "../lib/stacks";
import { buildTicketUrl, extractTicketKey } from "../lib/tickets";
import type {
  AccountError,
  ExtensionConfig,
  MergeRequest,
  PopupGroup,
  PopupPrefs,
  PopupTab,
  SyncResult,
  UiState
} from "../types/index";

const TABS: PopupTab[] = ["needs", "mine", "reviewing", "all"];
const TAB_LABEL_KEY: Record<PopupTab, string> = {
  needs: "tabNeeds",
  mine: "tabMine",
  reviewing: "tabReviewing",
  all: "tabAll"
};
const BUCKET_LABEL_KEY: Record<Bucket, string> = {
  needs: "groupNeeds",
  ready: "groupReady",
  waiting: "groupWaiting"
};
const PROVIDER_LABEL = { gitlab: "GitLab", github: "GitHub", bitbucket: "Bitbucket" } as const;
const DAY_MS = 86_400_000;

const tabsEl = requireElement<HTMLDivElement>("tabs");
const controlsEl = requireElement<HTMLDivElement>("controls");
const groupWrap = requireElement<HTMLLabelElement>("group-wrap");
const groupEl = requireElement<HTMLSelectElement>("group-select");
const groupValueEl = requireElement<HTMLSpanElement>("group-value");
const sortBtn = requireElement<HTMLButtonElement>("sort-btn");
const openAllBtn = requireElement<HTMLButtonElement>("open-all-btn");
const mutedBar = requireElement<HTMLDivElement>("muted-bar");
const mutedText = requireElement<HTMLSpanElement>("muted-text");
const unmuteBtn = requireElement<HTMLButtonElement>("unmute-btn");
const listEl = requireElement<HTMLDivElement>("mr-list");
const emptyEl = requireElement<HTMLDivElement>("empty-state");
const emptyTitleEl = emptyEl.querySelector<HTMLParagraphElement>(".empty-title");
const emptyDescEl = emptyEl.querySelector<HTMLParagraphElement>(".empty-desc");
const emptyIconEl = requireElement<HTMLSpanElement>("empty-icon");
const emptyActionBtn = requireElement<HTMLButtonElement>("empty-action");
const alertEl = requireElement<HTMLDivElement>("sync-alert");
const alertTitleEl = requireElement<HTMLDivElement>("sync-alert-title");
const alertTextEl = requireElement<HTMLDivElement>("sync-alert-text");
const alertSettingsBtn = requireElement<HTMLButtonElement>("sync-alert-settings");
const syncBtn = requireElement<HTMLButtonElement>("sync-btn");
const lastSyncEl = requireElement<HTMLSpanElement>("last-sync");
const syncDotEl = requireElement<HTMLSpanElement>("sync-dot");
const footerEl = requireElement<HTMLElement>("footer");
const footerRightEl = requireElement<HTMLSpanElement>("footer-right");
const optionsBtn = requireElement<HTMLButtonElement>("options-btn");
const standupBtn = requireElement<HTMLButtonElement>("standup-btn");
const searchEl = requireElement<HTMLInputElement>("search-input");
const helpEl = requireElement<HTMLDivElement>("kbd-help");
const helpCloseBtn = requireElement<HTMLButtonElement>("kbd-help-close");

interface AccountMeta {
  color: string;
  label: string;
}

let allMrs: MergeRequest[] = [];
let prefs: PopupPrefs;
let uiState: UiState;
let mutedRepos = new Set<string>();
const accountMeta = new Map<string, AccountMeta>();
let enabledAccountCount = 0;
let lastSyncAtIso: string | null = null;
/** Accounts that failed on the last sync this session. Cleared by the next clean sync. */
let syncErrors: AccountError[] = [];

let showControls = true;
let connectPanel: ReturnType<typeof initConnectPanel> | null = null;

/** Free-text filter from the search box. Session-only, not persisted. */
let searchQuery = "";
/** Key of the keyboard-selected MR. Tracked by key so it survives re-renders. */
let cursorKey: string | null = null;
/** Ticket link base from Settings. Empty = ticket keys show as plain chips. */
let ticketBase = "";
/** Whether the All tab also lists MRs merged/closed in the last 24 hours. */
let showRecentClosed = false;
const collapsedRepos = new Set<string>();

optionsBtn.addEventListener("click", openSettings);
alertSettingsBtn.addEventListener("click", openSettings);
syncBtn.addEventListener("click", () => void runSync(true));

function openSettings(): void {
  void chrome.runtime.openOptionsPage();
}

async function init(): Promise<void> {
  applyI18n();
  hydrateIcons();
  prefs = await getPopupPrefs();
  uiState = await getUiState();
  groupEl.value = prefs.group;
  syncGroupLabel();
  reflectSortButton();
  buildTabs();
  attachListeners();

  const config = await getConfig();
  initModeControl({
    toggleId: "mode-toggle",
    mode: config.mode,
    onChange: (mode) => void setConfig({ mode })
  });
  loadConfig(config);
  applyDisplayPrefs(config.display);
  connectPanel = initConnectPanel(() => void enterMainView());

  const hasAccount = config.accounts.some((a) => a.enabled && a.token.trim());
  if (!hasAccount) {
    showConnectView();
    return;
  }

  await enterMainView();
}

function loadConfig(config: ExtensionConfig): void {
  accountMeta.clear();
  for (const a of config.accounts) accountMeta.set(a.id, { color: a.color, label: a.label });
  mutedRepos = new Set(config.mutedRepos);
  ticketBase = config.ticketBaseUrl;
  enabledAccountCount = config.accounts.filter((a) => a.enabled && a.token.trim()).length;
}

async function enterMainView(): Promise<void> {
  connectPanel?.hide();
  syncBtn.hidden = false;
  standupBtn.hidden = false;
  footerEl.hidden = false;
  tabsEl.hidden = false;

  loadConfig(await getConfig());
  await renderFromCache();
  await runSync(false);
}

function showConnectView(): void {
  tabsEl.hidden = true;
  controlsEl.hidden = true;
  listEl.hidden = true;
  emptyEl.hidden = true;
  mutedBar.hidden = true;
  alertEl.hidden = true;
  footerEl.hidden = true;
  syncBtn.hidden = true;
  standupBtn.hidden = true;
  connectPanel?.show();
}

/** Hide popup chrome the user opted out of (configured in Settings). */
function applyDisplayPrefs(display: ExtensionConfig["display"]): void {
  const modeToggle = document.getElementById("mode-toggle");
  if (modeToggle) modeToggle.hidden = !display.themeControls;
  groupWrap.hidden = !display.filters;
  sortBtn.hidden = !display.sort;
  openAllBtn.hidden = !display.openAll;
  document.querySelector<HTMLElement>(".credit")?.toggleAttribute("hidden", !display.credit);
  showControls = true;
}

async function renderFromCache(): Promise<void> {
  const { mergeRequests, lastSyncAt } = await getMrSnapshot();
  allMrs = mergeRequests;
  lastSyncAtIso = lastSyncAt;
  applyAndRender();
  void updateBadge();
}

function buildTabs(): void {
  tabsEl.replaceChildren();
  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.tab = tab;
    btn.setAttribute("role", "tab");
    btn.innerHTML = `${esc(t(TAB_LABEL_KEY[tab]))}<span class="tab-count"></span>`;
    btn.addEventListener("click", () => setTab(tab));
    tabsEl.appendChild(btn);
  }
}

function syncGroupLabel(): void {
  groupValueEl.textContent = groupEl.selectedOptions[0]?.textContent ?? "";
}

function setTab(tab: PopupTab): void {
  prefs.tab = tab;
  cursorKey = null;
  void persistPrefsAndRender();
}

/** MRs the user can see right now: not muted, not hidden-until-changed, matching search. */
function candidates(): MergeRequest[] {
  return allMrs.filter(
    (mr) =>
      !mutedRepos.has(mr.repo) &&
      uiState.hidden[mr.key] !== mr.updatedAt &&
      (!searchQuery || matchesSearch(mr))
  );
}

function isRecentClosed(mr: MergeRequest): boolean {
  return mr.state !== "open" && Date.now() - new Date(mr.updatedAt).getTime() < DAY_MS;
}

function tabItems(pool: MergeRequest[], tab: PopupTab): MergeRequest[] {
  if (tab === "all") return pool.filter((mr) => mr.state === "open" || (showRecentClosed && isRecentClosed(mr)));
  return pool.filter((mr) => inTab(mr, tab));
}

function applyAndRender(): void {
  syncGroupLabel();
  updateMutedBar();
  renderAlert();
  renderFooter();

  const pool = candidates();
  tabsEl.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
    const tab = btn.dataset.tab as PopupTab;
    const active = tab === prefs.tab;
    btn.setAttribute("aria-selected", String(active));
    btn.classList.toggle("is-active", active);
    const count = tab === "all" ? pool.filter((mr) => mr.state === "open").length : tabItems(pool, tab).length;
    const countEl = btn.querySelector(".tab-count");
    if (countEl) countEl.textContent = String(count);
  });

  if (!allMrs.length) {
    controlsEl.hidden = true;
    listEl.hidden = true;
    showEmpty(t("emptyNoMrTitle"), t("emptyNoMrDesc"), "git-pull-request");
    return;
  }

  controlsEl.hidden = !showControls;
  const items = sortMrs(tabItems(pool, prefs.tab));
  const recentClosed = pool.filter(isRecentClosed).length;

  if (!items.length) {
    listEl.hidden = true;
    if (prefs.tab === "needs" && !searchQuery) {
      const waiting = pool.filter((mr) => mr.state === "open").length;
      showEmpty(t("emptyNeedsTitle"), t("emptyNeedsDesc"), "check", waiting ? { label: t("emptyNeedsAction"), run: () => setTab("all") } : undefined);
    } else {
      showEmpty(t("emptyNoMatchesTitle"), t("emptyNoMatchesDesc"), "inbox");
    }
    return;
  }

  emptyEl.hidden = true;
  renderSections(buildSections(items), prefs.tab === "all" && recentClosed > 0 ? recentClosed : 0);
  listEl.hidden = false;
  markSeen();
}

interface Section {
  id: string;
  header: string;
  repo?: string;
  provider?: MergeRequest["provider"];
  items: StackRow[];
}

function buildSections(items: MergeRequest[]): Section[] {
  if (prefs.group === "project") {
    const map = new Map<string, MergeRequest[]>();
    for (const mr of items) map.set(mr.repo, [...(map.get(mr.repo) ?? []), mr]);
    return [...map.entries()].map(([repo, list]) => ({
      id: repo,
      header: repo,
      repo,
      provider: list[0].provider,
      items: orderStacks(list)
    }));
  }

  const open = items.filter((mr) => mr.state === "open");
  const rest = items.filter((mr) => mr.state !== "open");
  const sections: Section[] = [];
  for (const bucket of ["needs", "ready", "waiting"] as Bucket[]) {
    const list = open.filter((mr) => bucketOf(mr) === bucket);
    if (list.length) {
      sections.push({ id: bucket, header: t(BUCKET_LABEL_KEY[bucket]), items: orderStacks(list) });
    }
  }
  if (rest.length) sections.push({ id: "closed", header: t("tabAll"), items: orderStacks(rest) });
  return sections;
}

function matchesSearch(mr: MergeRequest): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  const ticket = extractTicketKey(mr) ?? "";
  return [mr.title, mr.repo, mr.author, `#${mr.number}`, `!${mr.number}`, ticket, mr.sourceBranch ?? ""].some(
    (field) => field.toLowerCase().includes(q)
  );
}

function sortMrs(list: MergeRequest[]): MergeRequest[] {
  const dir = prefs.sort === "updated_asc" ? 1 : -1;
  return [...list].sort(
    (a, b) => dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
  );
}

function renderSections(sections: Section[], recentClosed: number): void {
  const focusSelector = focusedRowSelector();
  const scrollTop = listEl.scrollTop;
  listEl.replaceChildren();

  for (const section of sections) {
    const collapsible = prefs.group === "project";
    const collapsed = collapsible && collapsedRepos.has(section.id);
    const el = document.createElement("section");
    el.className = `mr-group${collapsible ? " is-project" : ""}${collapsed ? " is-collapsed" : ""}`;
    const provider = section.provider
      ? `<span class="group-tag">${esc(PROVIDER_LABEL[section.provider])}</span>`
      : "";
    const chevron = collapsible ? `<span class="group-chevron">${iconSvg("chevron-down", 14)}</span>` : "";
    el.innerHTML = `
      <${collapsible ? "button type=\"button\"" : "div"} class="mr-group-header" ${collapsible ? `data-collapse="${esc(section.id)}" aria-expanded="${!collapsed}"` : ""}>
        ${chevron}
        <span class="mr-group-name">${esc(section.header)}</span>
        ${provider}
        <span class="group-spacer"></span>
        <span class="mr-group-count">${section.items.length}</span>
      </${collapsible ? "button" : "div"}>
      <ul class="mr-group-list">${collapsed ? "" : section.items.map(itemHtml).join("")}</ul>
    `;
    listEl.appendChild(el);
  }

  if (recentClosed > 0) {
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `<span>${esc(t("recentClosed", String(recentClosed)))}</span><button type="button" class="recent-btn" data-recent>${esc(showRecentClosed ? t("hide") : t("show"))}</button>`;
    listEl.appendChild(row);
  }

  listEl.scrollTop = scrollTop;
  if (focusSelector) listEl.querySelector<HTMLElement>(focusSelector)?.focus();
  applyCursorClass(false);
}

function cursorRows(): HTMLElement[] {
  return Array.from(listEl.querySelectorAll<HTMLElement>(".mr-title"));
}

function cursorRow(): HTMLElement | null {
  if (cursorKey === null) return null;
  return cursorRows().find((el) => el.dataset.key === cursorKey) ?? null;
}

/** Move the keyboard cursor by delta rows; starts at the top or bottom if none is set. */
function moveCursor(delta: number): void {
  const rows = cursorRows();
  if (!rows.length) return;
  const idx = rows.findIndex((el) => el.dataset.key === cursorKey);
  const next =
    idx < 0
      ? delta > 0
        ? 0
        : rows.length - 1
      : Math.min(rows.length - 1, Math.max(0, idx + delta));
  cursorKey = rows[next].dataset.key ?? null;
  applyCursorClass(true);
}

/** Sync the `is-cursor` highlight to cursorKey; clears the cursor if its row is gone. */
function applyCursorClass(scroll: boolean): void {
  listEl.querySelectorAll(".mr-item.is-cursor").forEach((el) => el.classList.remove("is-cursor"));
  const row = cursorRow();
  if (!row) {
    cursorKey = null;
    return;
  }
  const item = row.closest<HTMLElement>(".mr-item");
  item?.classList.add("is-cursor");
  if (scroll) item?.scrollIntoView({ block: "nearest" });
}

/** Selector that re-finds the focused row control after the list is rebuilt. */
function focusedRowSelector(): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !listEl.contains(active)) return null;
  const { key, copy, branch, hide, collapse } = active.dataset;
  if (key) return `.mr-title[data-key="${CSS.escape(key)}"]`;
  if (copy) return `[data-copy="${CSS.escape(copy)}"]`;
  if (branch) return `[data-branch="${CSS.escape(branch)}"]`;
  if (hide) return `[data-hide="${CSS.escape(hide)}"]`;
  if (collapse) return `[data-collapse="${CSS.escape(collapse)}"]`;
  return null;
}

function itemHtml({ mr, depth }: StackRow): string {
  const isNew = isUpdatedSinceSeen(mr);
  const isRead = uiState.opened.includes(mr.key);
  const reason = headlineReason(mr);
  const classes = ["mr-item", isNew ? "is-new" : "", isRead ? "is-read" : ""].filter(Boolean).join(" ");
  const copyLabel = t("copyLink");
  const branchLabel = t("copyBranch");
  const hideLabel = t("hideUntilChange");
  const ticket = ticketChipHtml(mr);
  const ref = refText(mr);

  const branchBtn = mr.sourceBranch
    ? `<button class="ib sm" type="button" data-branch="${esc(mr.sourceBranch)}" title="${esc(branchLabel)}" aria-label="${esc(branchLabel)}">${iconSvg("git-branch", 15)}</button>`
    : "";

  return `
    <li class="${classes}"${depth ? ` style="--depth:${depth}"` : ""}>
      <span class="status-dot tone-${dotTone(mr)}" aria-hidden="true"></span>
      <div class="mr-body">
        <div class="mr-row">
          <a class="mr-title" href="${esc(mr.url)}" data-key="${esc(mr.key)}" data-repo="${esc(mr.repo)}" target="_blank" rel="noopener">${esc(mr.title)}</a>
          <span class="mr-actions">
            ${branchBtn}
            <button class="ib sm" type="button" data-copy="${esc(mr.url)}" title="${esc(copyLabel)}" aria-label="${esc(copyLabel)}">${iconSvg("link", 15)}</button>
            <button class="ib sm" type="button" data-hide="${esc(mr.key)}" title="${esc(hideLabel)}" aria-label="${esc(hideLabel)}">${iconSvg("eye-off", 15)}</button>
          </span>
          <span class="mr-age">${esc(shortAge(mr.updatedAt))}</span>
        </div>
        <div class="mr-line">
          <span class="chip tone-${reason.tone}">${esc(t(reason.key))}</span>
          ${ticket}
          <span class="mr-ref">${esc(ref)}</span>
        </div>
        ${signalsHtml(mr, depth)}
      </div>
    </li>
  `;
}

function dotTone(mr: MergeRequest): string {
  if (mr.state !== "open") return "gray";
  if (mr.ci === "fail") return "red";
  if (mr.ci === "pending") return "amber";
  if (mr.ci === "pass") return "green";
  return "gray";
}

/** "repo !123 · author" in priority view; "!123 · author" under a project header. */
function refText(mr: MergeRequest): string {
  const who = mr.authoredByMe ? t("refMine") : mr.author;
  const head = prefs.group === "project" ? "" : `${mr.repo.split("/").pop() ?? mr.repo} `;
  return `${head}!${mr.number}${who && (prefs.group === "project" || !mr.authoredByMe) ? ` · ${who}` : ""}`;
}

/** Third line: CI, approvals, unresolved threads, stacking. Only what the provider reported. */
function signalsHtml(mr: MergeRequest, depth: number): string {
  if (mr.state !== "open") return "";
  const parts: string[] = [];
  // The headline chip already says "CI failing"; don't repeat it.
  if (mr.ci && mr.ci !== "none" && !(mr.ci === "fail" && headlineReason(mr).key === "reasonCi")) {
    const key = mr.ci === "pass" ? "ciPass" : mr.ci === "fail" ? "ciFail" : "ciPending";
    const tone = mr.ci === "pass" ? "green" : mr.ci === "fail" ? "red" : "amber";
    parts.push(`<span class="sig tone-${tone}">${esc(t(key))}</span>`);
  }
  if (mr.approvals !== undefined) {
    const ready = bucketOf(mr) === "ready";
    parts.push(`<span class="sig${ready ? " tone-green" : ""}">${esc(t("signalApprovals", String(mr.approvals)))}</span>`);
  }
  if (mr.threadsResolved === false) {
    parts.push(`<span class="sig tone-amber">${esc(t("blockThreads"))}</span>`);
  }
  if (depth && mr.targetBranch) {
    parts.push(`<span class="sig">${esc(t("stackedOn", mr.targetBranch))}</span>`);
  }
  return parts.length ? `<div class="mr-signals">${parts.join("")}</div>` : "";
}

/** Ticket key chip, linked when a ticket base URL is set in Settings. */
function ticketChipHtml(mr: MergeRequest): string {
  const key = extractTicketKey(mr);
  if (!key) return "";
  if (!ticketBase) return `<span class="ticket">${esc(key)}</span>`;
  const url = buildTicketUrl(ticketBase, key);
  return `<a class="ticket" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(t("ticketLinkTitle", key))}">${esc(key)}</a>`;
}

function isUpdatedSinceSeen(mr: MergeRequest): boolean {
  const seenAt = uiState.seen[mr.key];
  if (!seenAt) return true;
  return new Date(mr.updatedAt).getTime() > new Date(seenAt).getTime();
}

/** Record the current updatedAt for everything so only newer changes flag next time. */
function markSeen(): void {
  for (const mr of allMrs) uiState.seen[mr.key] = mr.updatedAt;
  void setUiState(uiState);
}

function updateMutedBar(): void {
  if (!mutedRepos.size) {
    mutedBar.hidden = true;
    return;
  }
  mutedBar.hidden = false;
  const count = mutedRepos.size;
  mutedText.textContent = count === 1 ? t("mutedOne") : t("mutedMany", String(count));
}

/** Banner for accounts whose last sync failed; the list keeps showing the cached data. */
function renderAlert(): void {
  if (!syncErrors.length) {
    alertEl.hidden = true;
    return;
  }
  const first = syncErrors[0];
  alertTitleEl.textContent = t("syncErrTitle", first.accountLabel);
  alertTextEl.textContent = `${first.message}. ${t("syncErrBody")}`;
  alertEl.hidden = false;
}

function renderFooter(): void {
  const failed = new Set(syncErrors.map((e) => e.accountLabel)).size;
  const when = lastSyncAtIso ? formatClock(lastSyncAtIso) : "";
  syncDotEl.classList.toggle("is-warn", failed > 0);
  if (failed > 0) {
    lastSyncEl.textContent = t("lastSyncedAt", when);
  } else {
    lastSyncEl.textContent = lastSyncAtIso ? t("syncedAt", formatRelative(lastSyncAtIso)) : "";
  }

  if (flashing) return;
  const showHints = !failed && !listEl.hidden;
  if (showHints) {
    footerRightEl.innerHTML = `<kbd>J</kbd><kbd>K</kbd>${esc(t("hintMove"))}<kbd class="gap">↵</kbd>${esc(t("hintOpen"))}<kbd class="gap">B</kbd>${esc(t("hintBranch"))}`;
  } else if (enabledAccountCount) {
    const connected = Math.max(0, enabledAccountCount - failed);
    footerRightEl.textContent =
      failed > 0
        ? t("sourcesSome", [String(connected), String(enabledAccountCount)])
        : t("sourcesAll", String(enabledAccountCount));
  } else {
    footerRightEl.textContent = "";
  }
}

async function updateBadge(): Promise<void> {
  const open = allMrs.filter((mr) => mr.state === "open" && !mutedRepos.has(mr.repo)).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#0965ce" });
  await chrome.action.setBadgeText({ text: open > 0 ? String(open) : "" });
}

function attachListeners(): void {
  groupEl.addEventListener("change", () => {
    prefs.group = groupEl.value as PopupGroup;
    void persistPrefsAndRender();
  });
  sortBtn.addEventListener("click", () => {
    prefs.sort = prefs.sort === "updated_desc" ? "updated_asc" : "updated_desc";
    reflectSortButton();
    void persistPrefsAndRender();
  });
  openAllBtn.addEventListener("click", () => openAllVisible());
  standupBtn.addEventListener("click", () => void copyStandup());
  unmuteBtn.addEventListener("click", () => void unmuteAll());
  emptyActionBtn.addEventListener("click", () => pendingEmptyAction?.());

  listEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const copyBtn = target.closest<HTMLButtonElement>("[data-copy]");
    if (copyBtn) {
      void copyText(copyBtn.dataset.copy ?? "", t("linkCopied"));
      return;
    }
    const branchBtn = target.closest<HTMLButtonElement>("[data-branch]");
    if (branchBtn) {
      void copyText(branchBtn.dataset.branch ?? "", t("branchCopied"));
      return;
    }
    const hideBtn = target.closest<HTMLButtonElement>("[data-hide]");
    if (hideBtn) {
      hideMr(hideBtn.dataset.hide ?? "");
      return;
    }
    if (target.closest("[data-recent]")) {
      showRecentClosed = !showRecentClosed;
      applyAndRender();
      return;
    }
    const collapse = target.closest<HTMLElement>("[data-collapse]");
    if (collapse?.dataset.collapse) {
      const id = collapse.dataset.collapse;
      if (collapsedRepos.has(id)) collapsedRepos.delete(id);
      else collapsedRepos.add(id);
      applyAndRender();
      return;
    }

    const link = target.closest<HTMLAnchorElement>(".mr-title");
    if (link?.dataset.key) markOpened(link.dataset.key);
  });

  searchEl.addEventListener("input", () => {
    searchQuery = searchEl.value;
    applyAndRender();
  });
  helpCloseBtn.addEventListener("click", () => {
    helpEl.hidden = true;
  });
  document.addEventListener("keydown", onKeydown);
}

function focusSearch(): void {
  searchEl.focus();
  searchEl.select();
}

function clearSearch(): void {
  searchQuery = "";
  searchEl.value = "";
  searchEl.blur();
  applyAndRender();
}

function selectedMr(): MergeRequest | undefined {
  const key = cursorKey;
  return key ? allMrs.find((mr) => mr.key === key) : undefined;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // Connect view has no list; the sync button is hidden there, so skip all shortcuts.
  if (syncBtn.hidden) return;

  const target = e.target as HTMLElement;

  if (target === searchEl) {
    if (e.key === "Escape") {
      e.preventDefault();
      clearSearch();
    } else if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      searchEl.blur();
      if (e.key === "ArrowDown") moveCursor(1);
    }
    return;
  }
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  switch (e.key) {
    case "j":
    case "ArrowDown":
      e.preventDefault();
      moveCursor(1);
      break;
    case "k":
    case "ArrowUp":
      e.preventDefault();
      moveCursor(-1);
      break;
    case "Enter":
      // Let focused buttons and links keep their native Enter behaviour.
      if (target.closest("a, button")) return;
      e.preventDefault();
      cursorRow()?.click();
      break;
    case "b": {
      const branch = selectedMr()?.sourceBranch;
      if (branch) void copyText(branch, t("branchCopied"));
      break;
    }
    case "m": {
      const repo = cursorRow()?.dataset.repo;
      if (repo) void muteRepo(repo);
      break;
    }
    case "1":
    case "2":
    case "3":
    case "4":
      setTab(TABS[Number(e.key) - 1]);
      break;
    case "g":
      prefs.group = prefs.group === "priority" ? "project" : "priority";
      groupEl.value = prefs.group;
      void persistPrefsAndRender();
      break;
    case "s":
      syncBtn.click();
      break;
    case "/":
      e.preventDefault();
      focusSearch();
      break;
    case "?":
      helpEl.hidden = !helpEl.hidden;
      break;
    case "Escape":
      if (!helpEl.hidden) helpEl.hidden = true;
      else if (searchQuery) clearSearch();
      break;
  }
}

function reflectSortButton(): void {
  const asc = prefs.sort === "updated_asc";
  sortBtn.classList.toggle("is-asc", asc);
  sortBtn.title = asc ? t("sortOldest") : t("sortNewest");
  sortBtn.setAttribute("aria-label", sortBtn.title);
}

function openAllVisible(): void {
  const visible = sortMrs(tabItems(candidates(), prefs.tab));
  for (const mr of visible) {
    if (mr.url) void chrome.tabs.create({ url: mr.url, active: false });
  }
}

async function copyText(text: string, message: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    flashStatus(message);
  } catch {
    flashStatus(t("copyFailed"));
  }
}

/** Copy a Markdown standup of the synced MRs (ignores filters, skips muted projects). */
async function copyStandup(): Promise<void> {
  const visible = allMrs.filter((mr) => !mutedRepos.has(mr.repo));
  await copyText(buildStandup(visible, new Date()), t("standupCopied"));
}

function hideMr(key: string): void {
  const mr = allMrs.find((m) => m.key === key);
  if (!mr) return;
  uiState.hidden[key] = mr.updatedAt;
  void setUiState(uiState);
  applyAndRender();
  flashStatus(t("hiddenUntilChange"));
}

async function muteRepo(repo: string): Promise<void> {
  if (!repo) return;
  mutedRepos.add(repo);
  await setConfig({ mutedRepos: [...mutedRepos] });
  applyAndRender();
  void updateBadge();
}

async function unmuteAll(): Promise<void> {
  mutedRepos.clear();
  await setConfig({ mutedRepos: [] });
  applyAndRender();
  void updateBadge();
}

function markOpened(key: string): void {
  if (!uiState.opened.includes(key)) {
    uiState.opened.push(key);
    void setUiState(uiState);
  }
}

async function persistPrefsAndRender(): Promise<void> {
  applyAndRender();
  await setPopupPrefs(prefs);
}

async function runSync(showErrors: boolean): Promise<void> {
  syncBtn.disabled = true;
  syncBtn.classList.add("is-spinning");

  try {
    const result = (await chrome.runtime.sendMessage({
      type: "SYNC_NOW"
    })) as SyncResult | undefined;

    if (!result?.ok) {
      throw new Error(result?.error ?? t("syncFailed"));
    }

    syncErrors = result.errors;
    await renderFromCache();
  } catch (err) {
    if (showErrors) {
      const message = err instanceof Error ? err.message : String(err);
      syncErrors = [{ accountLabel: t("appName"), message }];
    }
    await renderFromCache();
  } finally {
    syncBtn.disabled = false;
    syncBtn.classList.remove("is-spinning");
  }
}

let flashing = false;
let flashTimer: number | undefined;
/** Show a short confirmation in the footer in place of the key hints. */
function flashStatus(text: string): void {
  flashing = true;
  footerRightEl.textContent = text;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flashing = false;
    renderFooter();
  }, 1500);
}

let pendingEmptyAction: (() => void) | undefined;
function showEmpty(
  title: string,
  desc: string,
  icon: "git-pull-request" | "check" | "inbox",
  action?: { label: string; run: () => void }
): void {
  if (emptyTitleEl) emptyTitleEl.textContent = title;
  if (emptyDescEl) emptyDescEl.textContent = desc;
  emptyIconEl.dataset.icon = icon;
  emptyIconEl.innerHTML = iconSvg(icon, 22);
  emptyEl.classList.toggle("is-good", icon === "check");
  pendingEmptyAction = action?.run;
  emptyActionBtn.hidden = !action;
  if (action) emptyActionBtn.textContent = action.label;
  emptyEl.hidden = false;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("hoursAgo", String(hrs));
  return new Date(iso).toLocaleString();
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

void init();
