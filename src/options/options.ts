import { createAccount, getConfig, setConfig } from "../lib/storage";
import { normalizeTicketBase } from "../lib/tickets";
import { requireElement, requireForm, requireInput, requireSelect } from "../lib/dom";
import { applyI18n, stateLabel, t } from "../lib/i18n";
import { getProvider } from "../providers/registry";
import { initModeControl } from "../lib/theme";
import { hydrateIcons } from "../lib/icons";
import { providerIconSvg } from "../lib/provider-icons";
import { ensureHostPermissions } from "../lib/permissions";
import type { Account, MrScope, NormalizedState, ProviderId } from "../types/index";

const form = requireForm("config-form");
const accountsEl = requireElement<HTMLDivElement>("accounts");
const accountsEmptyEl = requireElement<HTMLParagraphElement>("accounts-empty");
const addBtn = requireElement<HTMLButtonElement>("add-account");
const newProviderSelect = requireSelect("new-provider");
const saveStatus = requireElement<HTMLSpanElement>("save-status");

const SCOPES: { value: MrScope; label: string }[] = [
  { value: "assigned_to_me", label: t("scopeAssigned") },
  { value: "created_by_me", label: t("scopeCreated") },
  { value: "needs_my_review", label: t("scopeReview") },
  { value: "all", label: t("scopeAll") }
];

const STATES: NormalizedState[] = ["open", "merged", "closed"];

let accounts: Account[] = [];

async function load(): Promise<void> {
  applyI18n();
  hydrateIcons();
  const config = await getConfig();
  initModeControl({
    toggleId: "mode-toggle",
    mode: config.mode,
    onChange: (mode) => void setConfig({ mode })
  });
  accounts = config.accounts;
  requireInput("syncIntervalMinutes").value = String(config.syncIntervalMinutes);
  requireInput("notifyNewMr").checked = config.notifyOn.newMr;
  requireInput("notifyStatusChange").checked = config.notifyOn.statusChange;
  requireInput("notifyReviewRequested").checked = config.notifyOn.reviewRequested;
  requireInput("notifyCiFailed").checked = config.notifyOn.ciFailed;
  requireInput("notifyDigest").checked = config.digestNotifications;
  requireInput("quietEnabled").checked = config.quietHours.enabled;
  requireInput("ticketBaseUrl").value = config.ticketBaseUrl;
  requireInput("quietStart").value = String(config.quietHours.start);
  requireInput("quietEnd").value = String(config.quietHours.end);
  requireInput("dispThemeControls").checked = config.display.themeControls;
  requireInput("dispFilters").checked = config.display.filters;
  requireInput("dispSort").checked = config.display.sort;
  requireInput("dispOpenAll").checked = config.display.openAll;
  requireInput("dispCredit").checked = config.display.credit;
  render();
}

function render(): void {
  accountsEmptyEl.hidden = accounts.length > 0;
  accountsEl.replaceChildren();
  for (const account of accounts) {
    accountsEl.insertAdjacentHTML("beforeend", accountCard(account));
  }
  accountsEl.querySelectorAll<HTMLDivElement>(".account-card").forEach((card) => {
    void refreshWorkspaces(card);
  });
}

/** Dropdown options: "N/A" (no filter) first, then the orgs, keeping any saved value. */
function workspaceOptions(names: string[], selected: string): string {
  const all = selected && !names.includes(selected) ? [selected, ...names] : names;
  const options = all.map(
    (name) => `<option value="${esc(name)}"${name === selected ? " selected" : ""}>${esc(name)}</option>`
  );
  return [`<option value="">N/A</option>`, ...options].join("");
}

/** Fill a card's org dropdown from the token currently typed in that card. */
async function refreshWorkspaces(card: HTMLDivElement): Promise<void> {
  const provider = getProvider(card.dataset.provider as ProviderId);
  const select = card.querySelector<HTMLSelectElement>('select[data-field="workspace"]');
  const status = card.querySelector<HTMLElement>(".org-status");
  const token = card.querySelector<HTMLInputElement>('[data-field="token"]')?.value.trim() ?? "";
  const host = card.querySelector<HTMLInputElement>('[data-field="host"]')?.value.trim() ?? "";
  if (!select || !provider.listWorkspaces || !token) return;

  const selected = select.value;
  select.disabled = true;
  try {
    const names = await provider.listWorkspaces(token, host);
    select.innerHTML = workspaceOptions(names, selected);
    if (status) status.textContent = "";
  } catch {
    select.innerHTML = workspaceOptions([], selected);
    if (status) status.textContent = t("orgLoadFailed");
  } finally {
    select.disabled = false;
  }
}

accountsEl.addEventListener("change", (e) => {
  const target = e.target as HTMLElement;
  if (target.dataset.field === "token" || target.dataset.field === "host") {
    const card = target.closest<HTMLDivElement>(".account-card");
    if (card) void refreshWorkspaces(card);
  }
});

function accountCard(account: Account): string {
  const provider = getProvider(account.provider);

  const fields = provider.fields
    .map((field) => {
      const value = (account[field.key] ?? "") as string;
      if (field.kind === "select") {
        return `
        <label class="field-label">
          ${field.label}
          <select class="select" data-field="${field.key}">${workspaceOptions([], value)}</select>
          <span class="hint org-status"></span>
          ${field.hint ? `<span class="hint">${esc(field.hint)}</span>` : ""}
        </label>`;
      }
      return `
        <label class="field-label">
          ${field.label}${field.required ? " *" : ""}
          <input
            class="input"
            type="${field.secret ? "password" : "text"}"
            data-field="${field.key}"
            autocomplete="off"
            placeholder="${esc(field.placeholder)}"
            value="${esc(value)}"
          />
          ${field.hint ? `<span class="hint">${esc(field.hint)}</span>` : ""}
        </label>`;
    })
    .join("");

  const scopeOptions = SCOPES.map(
    (s) =>
      `<option value="${s.value}"${account.scope === s.value ? " selected" : ""}>${s.label}</option>`
  ).join("");

  const stateChecks = STATES.map(
    (state) => `
      <label class="check-row">
        <input type="checkbox" data-state="${state}"${account.states.includes(state) ? " checked" : ""} />
        ${stateLabel(state)}
      </label>`
  ).join("");

  return `
    <div class="account-card card" data-id="${esc(account.id)}" data-provider="${account.provider}">
      <div class="account-head">
        <div class="account-title">
          <span class="badge provider-${account.provider}" title="${esc(provider.label)}">${providerIconSvg(account.provider)}</span>
          <input class="input account-label" data-field="label" value="${esc(account.label)}" placeholder="${t("labelPlaceholder")}" />
        </div>
        <div class="account-head-actions">
          <label class="check-row">
            <input type="checkbox" data-field="enabled"${account.enabled ? " checked" : ""} /> ${t("enabled")}
          </label>
          <button type="button" class="btn btn-sm" data-remove="${esc(account.id)}">${t("remove")}</button>
        </div>
      </div>
      ${fields}
      <p class="hint">
        <a href="${esc(provider.tokenDocsUrl)}" target="_blank" rel="noopener">${t("tokenHowTo")}</a>
      </p>
      <div class="account-filters">
        <label class="field-label">
          ${t("scope")}
          <select class="select" data-field="scope">${scopeOptions}</select>
        </label>
        <div>
          <p class="hint">${t("statesLabel")}</p>
          <div class="checks">${stateChecks}</div>
        </div>
      </div>
    </div>`;
}

/** Read the current DOM back into the in-memory accounts array. */
function collectAccounts(): Account[] {
  const cards = Array.from(accountsEl.querySelectorAll<HTMLDivElement>(".account-card"));
  return cards.map((card) => {
    const id = card.dataset.id ?? "";
    const existing = accounts.find((a) => a.id === id);
    const provider = (existing?.provider ?? "gitlab") as ProviderId;

    const field = (key: string): string =>
      card.querySelector<HTMLInputElement>(`[data-field="${key}"]`)?.value.trim() ?? "";

    const states = Array.from(
      card.querySelectorAll<HTMLInputElement>("input[data-state]:checked")
    ).map((el) => el.dataset.state as NormalizedState);

    return {
      id,
      provider,
      label: field("label") || provider,
      host: field("host"),
      token: field("token"),
      username: field("username"),
      workspace: field("workspace"),
      scope: (card.querySelector<HTMLSelectElement>('[data-field="scope"]')?.value ??
        "assigned_to_me") as MrScope,
      states: states.length ? states : ["open"],
      enabled: card.querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked ?? true,
      color: existing?.color || "#e8590c"
    };
  });
}

addBtn.addEventListener("click", () => {
  const provider = newProviderSelect.value as ProviderId;
  accounts = collectAccounts();
  accounts.push(createAccount(provider, getProvider(provider).label, accounts.length));
  render();
});

accountsEl.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const removeId = target.dataset.remove;
  if (removeId) {
    accounts = collectAccounts().filter((a) => a.id !== removeId);
    render();
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  void save();
});

async function save(): Promise<void> {
  saveStatus.textContent = t("saving");
  saveStatus.classList.remove("error");

  const collected = collectAccounts();

  const broken = collected.find((a) => a.enabled && !a.token);
  if (broken) {
    saveStatus.textContent = t("needsToken", broken.label);
    saveStatus.classList.add("error");
    return;
  }

  // Self-hosted hosts aren't covered by the manifest's required permissions,
  // so request them now (we're still inside the submit user gesture).
  const granted = await ensureHostPermissions(collected);

  await setConfig({
    accounts: collected,
    syncIntervalMinutes: Number(requireInput("syncIntervalMinutes").value),
    notifyOn: {
      newMr: requireInput("notifyNewMr").checked,
      statusChange: requireInput("notifyStatusChange").checked,
      newComment: false,
      reviewRequested: requireInput("notifyReviewRequested").checked,
      ciFailed: requireInput("notifyCiFailed").checked
    },
    digestNotifications: requireInput("notifyDigest").checked,
    ticketBaseUrl: normalizeTicketBase(requireInput("ticketBaseUrl").value),
    quietHours: {
      enabled: requireInput("quietEnabled").checked,
      start: clampHour(Number(requireInput("quietStart").value)),
      end: clampHour(Number(requireInput("quietEnd").value))
    },
    display: {
      themeControls: requireInput("dispThemeControls").checked,
      filters: requireInput("dispFilters").checked,
      sort: requireInput("dispSort").checked,
      openAll: requireInput("dispOpenAll").checked,
      credit: requireInput("dispCredit").checked
    }
  });

  accounts = collected;
  await chrome.runtime.sendMessage({ type: "RESCHEDULE_ALARM" });
  await chrome.runtime.sendMessage({ type: "SYNC_NOW" });

  if (!granted) {
    saveStatus.textContent = t("hostAccessDenied");
    saveStatus.classList.add("error");
    return;
  }

  saveStatus.textContent = t("saved");
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 3000);
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

void load();

/** Hours are local 0-23. Anything else falls back to midnight. */
function clampHour(value: number): number {
  return Number.isInteger(value) && value >= 0 && value <= 23 ? value : 0;
}
