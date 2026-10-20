import { createAccount, getConfig, setConfig } from "../lib/storage";
import { ensureHostPermissions } from "../lib/permissions";
import { providerIconSvg } from "../lib/provider-icons";
import { t } from "../lib/i18n";
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
    note: t("connectNoteGithub"),
    tokenPlaceholder: "github_pat_… or ghp_…"
  },
  gitlab: {
    scopes: ["read_api"],
    note: t("connectNoteGitlab"),
    tokenPlaceholder: "glpat-xxxxxxxxxxxxxx"
  },
  bitbucket: {
    scopes: ["pullrequest:read"],
    note: t("connectNoteBitbucket"),
    tokenPlaceholder: "App password"
  }
};

export interface ConnectPanel {
  root: HTMLElement;
  show: () => void;
  hide: () => void;
}

/** Returns the element or throws, so callers get a non-null type. */
function required<T>(el: T | null, selector: string): T {
  if (!el) throw new Error(`connect panel element missing: ${selector}`);
  return el;
}

export function initConnectPanel(onConnected: () => void): ConnectPanel {
  const root = required(document.getElementById("connect-panel"), "#connect-panel");

  const listEl = required(root.querySelector<HTMLElement>("#connect-list"), "#connect-list");
  const formWrap = required(root.querySelector<HTMLElement>("#connect-form-wrap"), "#connect-form-wrap");
  const formEl = required(root.querySelector<HTMLFormElement>("#connect-form"), "#connect-form");
  const backBtn = required(root.querySelector<HTMLButtonElement>("#connect-back"), "#connect-back");
  const errorEl = required(root.querySelector<HTMLElement>("#connect-error"), "#connect-error");

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
          <span class="connect-card-status">${t("connectNotConnected")}</span>
        </span>
        <span class="connect-card-action">${t("connectAction")}</span>
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
          <span>${t("connectNotConnected")}</span>
        </div>
      </div>
      ${extras}
      <label class="connect-field">
        <span class="connect-field-label">${esc(tokenField?.label ?? t("connectTokenLabel"))} *</span>
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
        ${t("connectDocs")}
      </a>
      <div class="connect-scopes card">
        <p class="connect-scopes-title">${t("connectScopesTitle")}</p>
        <div class="connect-scopes-tags">${scopeTags}</div>
        <p class="connect-scopes-note">${esc(hints.note)}</p>
      </div>
      <button type="submit" class="btn btn-primary connect-submit">${esc(t("connectSubmit", provider.label))}</button>
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
      showError(t("connectTokenRequired"));
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
        showError(t("connectFieldRequired", field.label));
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
      showError(t("hostAccessDenied"));
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
