import { createAccount, getConfig, setConfig } from "../lib/storage";
import { ensureHostPermissions } from "../lib/permissions";
import { providerIconSvg } from "../lib/provider-icons";
import { getProvider } from "../providers/registry";
import type { ProviderId } from "../types/index";

const PROVIDER_ORDER: ProviderId[] = ["github", "gitlab", "bitbucket"];

/** Short copy shown in the connect form scope box. */
const CONNECT_HINTS: Record<
  ProviderId,
  { scopes: string[]; note: string; tokenPlaceholder: string }
> = {
  github: {
    scopes: ["repo", "read:user"],
    note: "Fine-grained token with Pull requests: Read is enough for listing.",
    tokenPlaceholder: "github_pat_… or ghp_…"
  },
  gitlab: {
    scopes: ["read_api"],
    note: "Read-only access to list merge requests. Stored only on this device.",
    tokenPlaceholder: "glpat-xxxxxxxxxxxxxx"
  },
  bitbucket: {
    scopes: ["pullrequest:read"],
    note: "App password with Pull requests: Read. Username + workspace required.",
    tokenPlaceholder: "App password"
  }
};

export interface ConnectPanel {
  root: HTMLElement;
  show: () => void;
  hide: () => void;
}

export function initConnectPanel(onConnected: () => void): ConnectPanel {
  const root = document.getElementById("connect-panel");
  if (!root) throw new Error("connect-panel element missing");

  const listEl = root.querySelector<HTMLElement>("#connect-list");
  const formWrap = root.querySelector<HTMLElement>("#connect-form-wrap");
  const formEl = root.querySelector<HTMLFormElement>("#connect-form");
  const backBtn = root.querySelector<HTMLButtonElement>("#connect-back");
  const errorEl = root.querySelector<HTMLElement>("#connect-error");

  if (!listEl || !formWrap || !formEl || !backBtn || !errorEl) {
    throw new Error("connect panel elements missing");
  }

  let selected: ProviderId | null = null;

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function renderList(): void {
    selected = null;
    formWrap.hidden = true;
    listEl.hidden = false;
    showError("");

    listEl.replaceChildren();
    for (const id of PROVIDER_ORDER) {
      const provider = getProvider(id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "connect-card";
      card.dataset.provider = id;
      card.innerHTML = `
        <span class="connect-card-icon badge provider-${id}">${providerIconSvg(id)}</span>
        <span class="connect-card-body">
          <span class="connect-card-name">${esc(provider.label)}</span>
          <span class="connect-card-status">Not connected</span>
        </span>
        <span class="connect-card-action">Connect</span>
      `;
      card.addEventListener("click", () => showForm(id));
      listEl.appendChild(card);
    }
  }

  function showForm(providerId: ProviderId): void {
    selected = providerId;
    showError("");
    listEl.hidden = true;
    formWrap.hidden = false;

    const provider = getProvider(providerId);
    const hints = CONNECT_HINTS[providerId];
    const tokenField = provider.fields.find((f) => f.key === "token");
    const extraFields = provider.fields.filter((f) => f.key !== "token");

    const scopeTags = hints.scopes.map((s) => `<span class="connect-scope">${esc(s)}</span>`).join("");

    const extras = extraFields
      .map(
        (field) => `
        <label class="connect-field">
          <span class="connect-field-label">${esc(field.label)}${field.required ? " *" : ""}</span>
          <input
            class="input"
            type="text"
            name="${field.key}"
            autocomplete="off"
            placeholder="${esc(field.placeholder)}"
            ${field.required ? "required" : ""}
          />
          ${field.hint ? `<span class="connect-field-hint">${esc(field.hint)}</span>` : ""}
        </label>`
      )
      .join("");

    formEl.innerHTML = `
      <div class="connect-form-head">
        <span class="connect-form-icon badge provider-${providerId}">${providerIconSvg(providerId)}</span>
        <div class="connect-form-title">
          <strong>${esc(provider.label)}</strong>
          <span>Not connected</span>
        </div>
      </div>
      ${extras}
      <label class="connect-field">
        <span class="connect-field-label">${esc(tokenField?.label ?? "Token")} *</span>
        <input
          class="input"
          type="password"
          name="token"
          autocomplete="off"
          placeholder="${esc(hints.tokenPlaceholder)}"
          required
        />
      </label>
      <a class="connect-docs" href="${esc(provider.tokenDocsUrl)}" target="_blank" rel="noopener">
        Create a read-only token →
      </a>
      <div class="connect-scopes card">
        <p class="connect-scopes-title">Required scopes</p>
        <div class="connect-scopes-tags">${scopeTags}</div>
        <p class="connect-scopes-note">${esc(hints.note)}</p>
      </div>
      <button type="submit" class="btn btn-primary connect-submit">Connect ${esc(provider.label)}</button>
    `;

    formEl.querySelector<HTMLInputElement>('input[name="token"]')?.focus();
  }

  backBtn.addEventListener("click", () => renderList());

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selected) return;
    void submitConnect(selected, formEl, showError, onConnected);
  });

  renderList();

  return {
    root,
    show: () => {
      root.hidden = false;
      renderList();
    },
    hide: () => {
      root.hidden = true;
      showError("");
    }
  };
}

async function submitConnect(
  providerId: ProviderId,
  form: HTMLFormElement,
  showError: (msg: string) => void,
  onConnected: () => void
): Promise<void> {
  showError("");
  const submitBtn = form.querySelector<HTMLButtonElement>(".connect-submit");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const data = new FormData(form);
    const token = String(data.get("token") ?? "").trim();
    if (!token) {
      showError("Token is required.");
      return;
    }

    const provider = getProvider(providerId);
    const config = await getConfig();
    const account = createAccount(providerId, provider.label, config.accounts.length);

    for (const field of provider.fields) {
      if (field.key === "token") {
        account.token = token;
        continue;
      }
      const value = String(data.get(field.key) ?? "").trim();
      if (field.required && !value) {
        showError(`${field.label} is required.`);
        return;
      }
      account[field.key] = value;
    }

    const accounts = [...config.accounts, account];
    const granted = await ensureHostPermissions(accounts);

    await setConfig({ accounts });
    await chrome.runtime.sendMessage({ type: "RESCHEDULE_ALARM" });
    await chrome.runtime.sendMessage({ type: "SYNC_NOW" });

    if (!granted) {
      showError("Saved, but self-hosted host access was denied.");
      return;
    }

    onConnected();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showError(message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
