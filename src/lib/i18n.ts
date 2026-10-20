import type { NormalizedState } from "../types/index";

/**
 * Thin wrapper over chrome.i18n. Strings live in public/_locales/<lang>/messages.json;
 * Chrome picks the locale from the browser UI language and falls back to "en".
 */
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

const STATE_LABEL_KEY: Record<NormalizedState, string> = {
  open: "stateOpen",
  merged: "stateMerged",
  closed: "stateClosed"
};

/** Localized label for a merge request state (open / merged / closed). */
export function stateLabel(state: NormalizedState): string {
  return t(STATE_LABEL_KEY[state]);
}

/**
 * Fill static markup from data attributes:
 * - data-i18n: textContent
 * - data-i18n-html: innerHTML (only for trusted, static messages)
 * - data-i18n-title / data-i18n-aria / data-i18n-placeholder: attributes
 */
export function applyI18n(root: ParentNode = document): void {
  document.documentElement.lang = chrome.i18n.getUILanguage();

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n ?? "");
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml ?? "");
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle ?? "");
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria ?? ""));
  });
  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder ?? "");
  });
}
