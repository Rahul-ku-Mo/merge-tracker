import { createAccount, getConfig, setConfig } from "../lib/storage";
import { requireElement, requireForm, requireInput, requireSelect } from "../lib/dom";
import { getProvider } from "../providers/registry";
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
  { value: "all", label: "All I'm involved in" }
];

const STATES: NormalizedState[] = ["open", "merged", "closed"];

let accounts: Account[] = [];

async function load(): Promise<void> {
  const config = await getConfig();
  accounts = config.accounts;
  requireInput("syncIntervalMinutes").value = String(config.syncIntervalMinutes);
  requireInput("notifyNewMr").checked = config.notifyOn.newMr;
  requireInput("notifyStatusChange").checked = config.notifyOn.statusChange;
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
      enabled: card.querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked ?? true
    };
  });
}

addBtn.addEventListener("click", () => {
  const provider = newProviderSelect.value as ProviderId;
  accounts = collectAccounts();
  accounts.push(createAccount(provider, getProvider(provider).label));
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

/** Turn a host URL into a Chrome match pattern, e.g. https://gitlab.acme.com/*. */
function originPattern(host: string): string | null {
  try {
    const url = new URL(host);
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

/**
 * Request host permission for any account using a custom (self-hosted) host.
 * Default cloud hosts are already covered by the manifest, so accounts that
 * leave host blank need nothing here. Must be called within a user gesture.
 */
async function ensureHostPermissions(list: Account[]): Promise<boolean> {
  const origins = new Set<string>();
  for (const account of list) {
    if (!account.enabled) continue;
    const host = account.host.trim();
    if (!host) continue;
    const pattern = originPattern(host);
    if (pattern) origins.add(pattern);
  }

  if (!origins.size) return true;

  const requested = [...origins];
  if (await chrome.permissions.contains({ origins: requested })) {
    return true;
  }
  return chrome.permissions.request({ origins: requested });
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

void load();
