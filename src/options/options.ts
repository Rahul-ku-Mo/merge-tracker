import { createAccount, getConfig, setConfig } from "../lib/storage";
import { requireElement, requireForm, requireInput, requireSelect } from "../lib/dom";
import { getProvider } from "../providers/registry";
import { initThemeControls } from "../lib/theme";
import { ensureHostPermissions } from "../lib/permissions";
import type { Account, MrScope, NormalizedState, ProviderId } from "../types/index";

const form = requireForm("config-form");
const accountsEl = requireElement<HTMLDivElement>("accounts");
const accountsEmptyEl = requireElement<HTMLParagraphElement>("accounts-empty");
const addBtn = requireElement<HTMLButtonElement>("add-account");
const newProviderSelect = requireSelect("new-provider");
const saveStatus = requireElement<HTMLSpanElement>("save-status");

const SCOPES: { value: MrScope; label: string }[] = [
  { value: "assigned_to_me", label: "Assigned to me" },
  { value: "created_by_me", label: "Created by me" },
  { value: "needs_my_review", label: "Needs my review" },
  { value: "all", label: "All I'm involved in" }
];

const STATES: NormalizedState[] = ["open", "merged", "closed"];

let accounts: Account[] = [];

async function load(): Promise<void> {
  const config = await getConfig();
  initThemeControls({
    selectId: "theme-select",
    toggleId: "mode-toggle",
    theme: config.theme,
    mode: config.mode,
    onChange: (theme, mode) => void setConfig({ theme, mode })
  });
  accounts = config.accounts;
  requireInput("syncIntervalMinutes").value = String(config.syncIntervalMinutes);
  requireInput("notifyNewMr").checked = config.notifyOn.newMr;
  requireInput("notifyStatusChange").checked = config.notifyOn.statusChange;
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
}

function accountCard(account: Account): string {
  const provider = getProvider(account.provider);

  const fields = provider.fields
    .map((field) => {
      const value = (account[field.key] ?? "") as string;
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
        ${state}
      </label>`
  ).join("");

  return `
    <div class="account-card card" data-id="${esc(account.id)}">
      <div class="account-head">
        <div class="account-title">
          <input class="account-color" type="color" data-field="color" value="${esc(account.color)}" title="Account color" aria-label="Account color" />
          <span class="badge provider-${account.provider}">${esc(provider.label)}</span>
          <input class="input account-label" data-field="label" value="${esc(account.label)}" placeholder="Label" />
        </div>
        <div class="account-head-actions">
          <label class="check-row">
            <input type="checkbox" data-field="enabled"${account.enabled ? " checked" : ""} /> Enabled
          </label>
          <button type="button" class="btn btn-sm" data-remove="${esc(account.id)}">Remove</button>
        </div>
      </div>
      ${fields}
      <p class="hint">
        <a href="${esc(provider.tokenDocsUrl)}" target="_blank" rel="noopener">How to create a read-only token</a>
      </p>
      <div class="account-filters">
        <label class="field-label">
          Scope
          <select class="select" data-field="scope">${scopeOptions}</select>
        </label>
        <div>
          <p class="hint">States:</p>
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
      color: field("color") || existing?.color || "#e8590c"
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
  saveStatus.textContent = "Saving…";
  saveStatus.classList.remove("error");

  const collected = collectAccounts();

  const broken = collected.find((a) => a.enabled && !a.token);
  if (broken) {
    saveStatus.textContent = `"${broken.label}" needs a token.`;
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
      newComment: false
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
    saveStatus.textContent = "Saved, but self-hosted host access was denied.";
    saveStatus.classList.add("error");
    return;
  }

  saveStatus.textContent = "Saved. Background sync updated.";
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
