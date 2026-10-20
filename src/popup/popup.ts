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
import { applyI18n, stateLabel, t } from "../lib/i18n";
import { initModeControl } from "../lib/theme";
import { hydrateIcons, iconSvg } from "../lib/icons";
import { providerIconSvg } from "../lib/provider-icons";
import { initConnectPanel } from "./connect";
import { type BlockReason, blockReasons } from "../lib/blocked";
import { buildStandup } from "../lib/standup";
import { type StackRow, orderStacks } from "../lib/stacks";
import type {
  CiStatus,
  ExtensionConfig,
  MergeRequest,
  NormalizedState,
  PopupPrefs,
  SyncResult,
  UiState
} from "../types/index";

const statusEl = requireElement<HTMLDivElement>("status");
const controlsEl = requireElement<HTMLDivElement>("controls");
const projectEl = requireElement<HTMLSelectElement>("filter-project");
const stateEl = requireElement<HTMLSelectElement>("filter-state");
const sortBtn = requireElement<HTMLButtonElement>("sort-btn");
const openAllBtn = requireElement<HTMLButtonElement>("open-all-btn");
const mutedBar = requireElement<HTMLDivElement>("muted-bar");
const mutedText = requireElement<HTMLSpanElement>("muted-text");
const unmuteBtn = requireElement<HTMLButtonElement>("unmute-btn");
const listEl = requireElement<HTMLDivElement>("mr-list");
const emptyEl = requireElement<HTMLDivElement>("empty-state");
const emptyTitleEl = emptyEl.querySelector<HTMLParagraphElement>(".empty-title");
const emptyDescEl = emptyEl.querySelector<HTMLParagraphElement>(".empty-desc");
const syncBtn = requireElement<HTMLButtonElement>("sync-btn");
const lastSyncEl = requireElement<HTMLSpanElement>("last-sync");
const optionsLink = requireElement<HTMLAnchorElement>("options-link");
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

/** Whether any of the controls-bar items are visible (drives the container). */
let showControls = true;
let connectPanel: ReturnType<typeof initConnectPanel> | null = null;

/** Free-text filter from the `/` search box. Session-only, not persisted. */
let searchQuery = "";
/** Key of the keyboard-selected MR. Tracked by key so it survives re-renders. */
let cursorKey: string | null = null;

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  void chrome.runtime.openOptionsPage();
});

syncBtn.addEventListener("click", () => void runSync(true));

async function init(): Promise<void> {
  applyI18n();
  hydrateIcons();
  prefs = await getPopupPrefs();
  uiState = await getUiState();
  stateEl.value = prefs.state;
  reflectSortButton();
  attachListeners();

  const config = await getConfig();
  initModeControl({
    toggleId: "mode-toggle",
    mode: config.mode,
    onChange: (mode) => void setConfig({ mode })
  });
  accountMeta.clear();
  for (const a of config.accounts) accountMeta.set(a.id, { color: a.color, label: a.label });
  mutedRepos = new Set(config.mutedRepos);
  applyDisplayPrefs(config.display);
  connectPanel = initConnectPanel(() => void enterMainView());

  const hasAccount = config.accounts.some((a) => a.enabled && a.token.trim());
  if (!hasAccount) {
    showConnectView();
    return;
  }

  await enterMainView();
}

async function enterMainView(): Promise<void> {
  connectPanel?.hide();
  statusEl.hidden = false;
  syncBtn.hidden = false;
  standupBtn.hidden = false;

  const config = await getConfig();
  accountMeta.clear();
  for (const a of config.accounts) accountMeta.set(a.id, { color: a.color, label: a.label });
  mutedRepos = new Set(config.mutedRepos);

  await renderFromCache();
  await runSync(false);
}

function showConnectView(): void {
  statusEl.hidden = true;
  controlsEl.hidden = true;
  listEl.hidden = true;
  emptyEl.hidden = true;
  mutedBar.hidden = true;
  syncBtn.hidden = true;
  standupBtn.hidden = true;
  lastSyncEl.textContent = "";
  connectPanel?.show();
}

/** Hide popup chrome the user opted out of (configured in Settings). */
function applyDisplayPrefs(display: ExtensionConfig["display"]): void {
  const setHidden = (id: string, hidden: boolean): void => {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
  };

  setHidden("mode-toggle", !display.themeControls);
  projectEl.hidden = !display.filters;
  stateEl.hidden = !display.filters;
  sortBtn.hidden = !display.sort;
  openAllBtn.hidden = !display.openAll;

  document.querySelector<HTMLElement>(".credit")?.toggleAttribute("hidden", !display.credit);

  showControls = display.filters || display.sort || display.openAll;
}

async function renderFromCache(): Promise<void> {
  const { mergeRequests, lastSyncAt } = await getMrSnapshot();
  allMrs = mergeRequests;
  populateProjectOptions();
  applyAndRender();
  void updateBadge();
  lastSyncEl.textContent = lastSyncAt ? t("syncedAt", formatRelative(lastSyncAt)) : "";
}

function populateProjectOptions(): void {
  const projects = [...new Set(allMrs.filter((mr) => !mutedRepos.has(mr.repo)).map((mr) => mr.repo))].sort(
    (a, b) => a.localeCompare(b)
  );
  const options = [
    { value: "all", label: t("filterAllProjects") },
    ...projects.map((p) => ({ value: p, label: p }))
  ];
  const hasSelected = options.some((o) => o.value === prefs.project);
  if (!hasSelected) prefs.project = "all";

  projectEl.replaceChildren();
  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    projectEl.appendChild(el);
  }
  projectEl.value = prefs.project;
}

function applyAndRender(): void {
  updateMutedBar();

  if (!allMrs.length) {
    controlsEl.hidden = true;
    listEl.hidden = true;
    showEmpty(t("emptyNoMrTitle"), t("emptyNoMrDesc"));
    setStatus(t("statusNoMr"), "default");
    return;
  }

  controlsEl.hidden = !showControls;
  const visible = allMrs.filter((mr) => !mutedRepos.has(mr.repo));
  const filtered = sortMrs(visible.filter(matchesFilters));

  if (!filtered.length) {
    listEl.hidden = true;
    showEmpty(t("emptyNoMatchesTitle"), t("emptyNoMatchesDesc"));
    setStatus(t("statusShown", ["0", String(visible.length)]), "default");
    return;
  }

  emptyEl.hidden = true;
  renderGroups(groupByRepo(filtered));
  listEl.hidden = false;

  const label =
    filtered.length === visible.length
      ? visible.length === 1
        ? t("requestsOne")
        : t("requestsMany", String(visible.length))
      : t("statusShown", [String(filtered.length), String(visible.length)]);
  setStatus(label, "success");

  markSeen();
}

function matchesFilters(mr: MergeRequest): boolean {
  if (prefs.project !== "all" && mr.repo !== prefs.project) return false;
  if (prefs.state === "blocked") {
    if (!blockReasons(mr).length) return false;
  } else if (prefs.state !== "all" && mr.state !== prefs.state) {
    return false;
  }
  if (searchQuery && !matchesSearch(mr)) return false;
  return true;
}

function matchesSearch(mr: MergeRequest): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  return [mr.title, mr.repo, mr.author, `#${mr.number}`].some((field) =>
    field.toLowerCase().includes(q)
  );
}

function sortMrs(list: MergeRequest[]): MergeRequest[] {
  const dir = prefs.sort === "updated_asc" ? 1 : -1;
  return [...list].sort(
    (a, b) => dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
  );
}

function groupByRepo(list: MergeRequest[]): { repo: string; items: StackRow[] }[] {
  const map = new Map<string, MergeRequest[]>();
  for (const mr of list) {
    const items = map.get(mr.repo) ?? [];
    items.push(mr);
    map.set(mr.repo, items);
  }
  return [...map.entries()].map(([repo, items]) => ({ repo, items: orderStacks(items) }));
}

function renderGroups(groups: { repo: string; items: StackRow[] }[]): void {
  const focusSelector = focusedRowSelector();
  const scrollTop = listEl.scrollTop;
  listEl.replaceChildren();

  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "mr-group";
    section.innerHTML = `
      <div class="mr-group-header">
        <span class="mr-group-name">${esc(group.repo)}</span>
        <span class="mr-group-count">${group.items.length}</span>
      </div>
      <ul class="mr-group-list">${group.items.map(itemHtml).join("")}</ul>
    `;
    listEl.appendChild(section);
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
  const { key, copy, mute } = active.dataset;
  if (key) return `.mr-title[data-key="${CSS.escape(key)}"]`;
  if (copy) return `[data-copy="${CSS.escape(copy)}"]`;
  if (mute) return `[data-mute="${CSS.escape(mute)}"]`;
  return null;
}

function itemHtml({ mr, depth }: StackRow): string {
  const meta = accountMeta.get(mr.accountId);
  const color = meta?.color ?? "#888";
  const copyLabel = t("copyLink");
  const muteLabel = t("muteProject");
  const isNew = isUpdatedSinceSeen(mr);
  const isRead = uiState.opened.includes(mr.key);
  const classes = ["mr-item", isNew ? "is-new" : "", isRead ? "is-read" : ""]
    .filter(Boolean)
    .join(" ");

  return `
    <li class="${classes}"${depth ? ` style="margin-left: ${depth * 16}px"` : ""}>
      <div class="mr-row">
        <span class="acct-dot" style="background:${esc(color)}" title="${esc(meta?.label ?? "")}" aria-label="${esc(t("accountLabel", meta?.label ?? ""))}" role="img"></span>
        <a class="mr-title" href="${esc(mr.url)}" data-key="${esc(mr.key)}" target="_blank" rel="noopener">${esc(mr.title)}</a>
        <span class="mr-actions">
          <button class="mr-action" type="button" data-copy="${esc(mr.url)}" title="${copyLabel}" aria-label="${copyLabel}">
            ${iconSvg("copy", 13)}
          </button>
          <button class="mr-action" type="button" data-mute="${esc(mr.repo)}" title="${muteLabel}" aria-label="${muteLabel}">
            ${iconSvg("eye-off", 13)}
          </button>
        </span>
      </div>
      <span class="mr-meta">
        ${providerBadge(mr.provider)}
        <span class="badge ${mr.state}">${stateLabel(mr.state)}</span>
        ${mr.draft ? `<span class="badge draft">${t("draft")}</span>` : ""}
        ${ciDotHtml(mr)}
        ${approvalsHtml(mr)}
        ${blockChipsHtml(mr)}
        ${depth && mr.targetBranch ? `<span class="stack-hint">↳ ${esc(t("stackedOn", mr.targetBranch))}</span>` : ""}
        <span class="mr-meta-sep">·</span>
        <span>#${mr.number}</span>
        <span class="mr-meta-sep">·</span>
        <span>${esc(mr.author)}</span>
      </span>
    </li>
  `;
}

/** CI dot for open MRs with a known, non-empty pipeline result. */
function ciDotHtml(mr: MergeRequest): string {
  if (mr.state !== "open" || !mr.ci || mr.ci === "none") return "";
  const label = t(CI_LABEL_KEY[mr.ci]);
  return `<span class="ci-dot ci-${mr.ci}" title="${esc(label)}" role="img" aria-label="${esc(label)}"></span>`;
}

/** Approval count for open MRs whose detail call succeeded. */
function approvalsHtml(mr: MergeRequest): string {
  if (mr.state !== "open" || mr.approvals === undefined) return "";
  const label = t("approvalsLabel", String(mr.approvals));
  return `<span class="approvals" title="${esc(label)}" aria-label="${esc(label)}">✓ ${mr.approvals}</span>`;
}

/** Reason chips for open MRs that need the user's action. */
function blockChipsHtml(mr: MergeRequest): string {
  return blockReasons(mr)
    .map((reason) => `<span class="badge block-reason">${t(BLOCK_LABEL_KEY[reason])}</span>`)
    .join("");
}

const BLOCK_LABEL_KEY: Record<BlockReason, string> = {
  review: "blockReview",
  ci: "blockCi",
  threads: "blockThreads"
};

const CI_LABEL_KEY: Record<Exclude<CiStatus, "none">, string> = {
  pass: "ciPass",
  fail: "ciFail",
  pending: "ciPending"
};

function providerBadge(provider: MergeRequest["provider"]): string {
  const icon = providerIconSvg(provider);
  return `<span class="badge provider-${provider} mr-provider" title="${provider}">${icon}</span>`;
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

async function updateBadge(): Promise<void> {
  const open = allMrs.filter((mr) => mr.state === "open" && !mutedRepos.has(mr.repo)).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#0965ce" });
  await chrome.action.setBadgeText({ text: open > 0 ? String(open) : "" });
}

function attachListeners(): void {
  projectEl.addEventListener("change", () => {
    prefs.project = projectEl.value;
    void persistPrefsAndRender();
  });
  stateEl.addEventListener("change", () => {
    prefs.state = stateEl.value as PopupPrefs["state"];
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

  listEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const copyBtn = target.closest<HTMLButtonElement>("[data-copy]");
    if (copyBtn) {
      void copyLink(copyBtn.dataset.copy ?? "");
      return;
    }

    const muteBtn = target.closest<HTMLButtonElement>("[data-mute]");
    if (muteBtn) {
      void muteRepo(muteBtn.dataset.mute ?? "");
      return;
    }

    const link = target.closest<HTMLAnchorElement>(".mr-title");
    if (link?.dataset.key) {
      markOpened(link.dataset.key);
    }
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

function showSearch(): void {
  searchEl.hidden = false;
  searchEl.focus();
  searchEl.select();
}

function clearSearch(): void {
  searchQuery = "";
  searchEl.value = "";
  searchEl.hidden = true;
  searchEl.blur();
  applyAndRender();
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
    case "m":
      cursorRow()?.closest(".mr-item")?.querySelector<HTMLButtonElement>("[data-mute]")?.click();
      break;
    case "s":
      syncBtn.click();
      break;
    case "/":
      e.preventDefault();
      showSearch();
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
  const visible = sortMrs(
    allMrs.filter((mr) => !mutedRepos.has(mr.repo)).filter(matchesFilters)
  );
  for (const mr of visible) {
    if (mr.url) void chrome.tabs.create({ url: mr.url, active: false });
  }
}

async function copyLink(url: string): Promise<void> {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    flashStatus(t("linkCopied"));
  } catch {
    flashStatus(t("copyFailed"));
  }
}

/** Copy a Markdown standup of the synced MRs (ignores filters, skips muted projects). */
async function copyStandup(): Promise<void> {
  const visible = allMrs.filter((mr) => !mutedRepos.has(mr.repo));
  try {
    await navigator.clipboard.writeText(buildStandup(visible, new Date()));
    flashStatus(t("standupCopied"));
  } catch {
    flashStatus(t("copyFailed"));
  }
}

async function muteRepo(repo: string): Promise<void> {
  if (!repo) return;
  mutedRepos.add(repo);
  await setConfig({ mutedRepos: [...mutedRepos] });
  populateProjectOptions();
  applyAndRender();
  void updateBadge();
}

async function unmuteAll(): Promise<void> {
  mutedRepos.clear();
  await setConfig({ mutedRepos: [] });
  populateProjectOptions();
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
  setStatus(t("syncing"), "loading");

  try {
    const result = (await chrome.runtime.sendMessage({
      type: "SYNC_NOW"
    })) as SyncResult | undefined;

    if (!result?.ok) {
      throw new Error(result?.error ?? t("syncFailed"));
    }

    await renderFromCache();

    if (result.errors.length) {
      setStatus(t("statusFailed", [String(result.count), String(result.errors.length)]), "error");
    }
  } catch (err) {
    if (showErrors) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(message, "error");
    } else {
      await renderFromCache();
    }
  } finally {
    syncBtn.disabled = false;
  }
}

type StatusVariant = "default" | "error" | "success" | "loading" | "info";

function setStatus(text: string, variant: StatusVariant = "default"): void {
  statusEl.textContent = text;
  statusEl.hidden = false;
  statusEl.classList.remove("is-error", "is-success", "is-loading", "is-info");
  if (variant === "error") statusEl.classList.add("is-error");
  if (variant === "success") statusEl.classList.add("is-success");
  if (variant === "loading") statusEl.classList.add("is-loading");
  if (variant === "info") statusEl.classList.add("is-info");
}

let flashTimer: number | undefined;
function flashStatus(text: string): void {
  const prevText = statusEl.textContent ?? "";
  setStatus(text, "success");
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    statusEl.textContent = prevText;
  }, 1500);
}

function showEmpty(title: string, desc: string): void {
  if (emptyTitleEl) emptyTitleEl.textContent = title;
  if (emptyDescEl) emptyDescEl.textContent = desc;
  emptyEl.hidden = false;
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
