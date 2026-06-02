import { getConfig, getMrSnapshot } from "../lib/storage";
import { requireElement } from "../lib/dom";
import type { MergeRequest, SyncResult } from "../types/index";

const statusEl = requireElement<HTMLDivElement>("status");
const listEl = requireElement<HTMLUListElement>("mr-list");
const emptyEl = requireElement<HTMLDivElement>("empty-state");
const syncBtn = requireElement<HTMLButtonElement>("sync-btn");
const lastSyncEl = requireElement<HTMLSpanElement>("last-sync");
const optionsLink = requireElement<HTMLAnchorElement>("options-link");

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  void chrome.runtime.openOptionsPage();
});

syncBtn.addEventListener("click", () => void runSync(true));

async function init(): Promise<void> {
  const config = await getConfig();
  const hasAccount = config.accounts.some((a) => a.enabled && a.token.trim());
  if (!hasAccount) {
    setStatus("Add an account in Settings to get started.", "error");
    listEl.hidden = true;
    emptyEl.hidden = true;
    return;
  }

  await renderFromCache();
  await runSync(false);
}

async function renderFromCache(): Promise<void> {
  const { mergeRequests, lastSyncAt } = await getMrSnapshot();

  if (!mergeRequests.length) {
    setStatus("No merge requests yet. Click Sync.", "default");
    listEl.hidden = true;
    emptyEl.hidden = false;
  } else {
    setStatus(
      `${mergeRequests.length} request${mergeRequests.length === 1 ? "" : "s"}`,
      "success"
    );
    renderList(mergeRequests);
    listEl.hidden = false;
    emptyEl.hidden = true;
  }

  lastSyncEl.textContent = lastSyncAt ? `Synced ${formatRelative(lastSyncAt)}` : "";
}

function renderList(mergeRequests: MergeRequest[]): void {
  listEl.replaceChildren();

  for (const mr of mergeRequests) {
    const li = document.createElement("li");
    li.className = "mr-item";
    li.innerHTML = `
      <a class="mr-title" href="${esc(mr.url)}" target="_blank" rel="noopener">${esc(mr.title)}</a>
      <span class="mr-meta">
        <span class="badge provider-${mr.provider}">${mr.provider}</span>
        <span class="mr-meta-sep">·</span>
        <span class="badge ${mr.state}">${mr.state}</span>
        <span class="mr-meta-sep">·</span>
        <span>${esc(mr.repo)}#${mr.number}</span>
        <span class="mr-meta-sep">·</span>
        <span>${esc(mr.author)}</span>
      </span>
    `;
    listEl.appendChild(li);
  }
}

async function runSync(showErrors: boolean): Promise<void> {
  syncBtn.disabled = true;
  setStatus("Syncing…", "loading");

  try {
    const result = (await chrome.runtime.sendMessage({
      type: "SYNC_NOW"
    })) as SyncResult | undefined;

    if (!result?.ok) {
      throw new Error(result?.error ?? "Sync failed");
    }

    await renderFromCache();

    if (result.errors.length) {
      setStatus(
        `${result.count} request(s) · ${result.errors.length} account(s) failed`,
        "error"
      );
    } else if (result.notified > 0) {
      setStatus(`${result.count} request(s) · ${result.notified} notification(s)`, "success");
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

type StatusVariant = "default" | "error" | "success" | "loading";

function setStatus(text: string, variant: StatusVariant = "default"): void {
  statusEl.textContent = text;
  statusEl.hidden = false;
  statusEl.classList.remove("is-error", "is-success", "is-loading");
  if (variant === "error") statusEl.classList.add("is-error");
  if (variant === "success") statusEl.classList.add("is-success");
  if (variant === "loading") statusEl.classList.add("is-loading");
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
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
