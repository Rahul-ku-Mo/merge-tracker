import type { ThemeId, ThemeMode } from "../types/index";

export interface ThemeOption {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeOption[] = [
  { id: "shadcn", label: "Default" },
  { id: "retro", label: "Retro" },
  { id: "ocean", label: "Ocean" },
  { id: "nord", label: "Nord" },
  { id: "dracula", label: "Dracula" },
  { id: "solarized", label: "Solarized" },
  { id: "github", label: "GitHub" }
];

/** Mode cycle order for the toggle button. */
const MODE_CYCLE: ThemeMode[] = ["system", "light", "dark"];

const prefersDark = (): boolean =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

/** Resolve "system" to the actual light/dark based on the OS setting. */
function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return prefersDark() ? "dark" : "light";
  return mode;
}

/**
 * Apply theme + mode by setting data attributes on <html>.
 * - data-theme: the palette.
 * - data-mode: the *resolved* light/dark (drives the CSS dark variants).
 * - data-mode-pref: the user's choice incl. "system" (drives the toggle icon).
 */
export function applyTheme(theme: ThemeId, mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = resolveMode(mode);
  root.dataset.modePref = mode;
  document
    .querySelectorAll<HTMLElement>("#mode-toggle")
    .forEach((el) => el.setAttribute("aria-label", `Theme mode: ${mode}`));
}

interface ThemeControlOptions {
  selectId: string;
  toggleId: string;
  theme: ThemeId;
  mode: ThemeMode;
  onChange: (theme: ThemeId, mode: ThemeMode) => void;
}

/** Populate the theme <select>, wire the mode toggle, and apply immediately. */
export function initThemeControls(opts: ThemeControlOptions): void {
  let theme = opts.theme;
  let mode = opts.mode;
  applyTheme(theme, mode);

  const select = document.getElementById(opts.selectId) as HTMLSelectElement | null;
  if (select) {
    select.replaceChildren();
    for (const t of THEMES) {
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = t.label;
      select.appendChild(option);
    }
    select.value = theme;
    select.addEventListener("change", () => {
      theme = select.value as ThemeId;
      applyTheme(theme, mode);
      opts.onChange(theme, mode);
    });
  }

  const toggle = document.getElementById(opts.toggleId);
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = (MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length;
      mode = MODE_CYCLE[next];
      applyTheme(theme, mode);
      opts.onChange(theme, mode);
    });
  }

  // Live-update when the OS theme changes while "system" is selected.
  globalThis
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (mode === "system") applyTheme(theme, mode);
    });
}
