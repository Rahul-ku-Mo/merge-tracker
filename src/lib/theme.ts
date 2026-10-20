import type { ThemeMode } from "../types/index";

/** Mode cycle order for the toggle button. */
const MODE_CYCLE: ThemeMode[] = ["system", "light", "dark"];

const darkQuery = (): MediaQueryList | undefined =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)");

/** Resolve "system" to the actual light/dark based on the OS setting. */
function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return darkQuery()?.matches ? "dark" : "light";
  return mode;
}

/**
 * Apply light/dark by setting data attributes on <html>.
 * - data-mode: the *resolved* light/dark (drives the CSS dark tokens).
 * - data-mode-pref: the user's choice incl. "system" (drives the toggle icon).
 */
export function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.mode = resolveMode(mode);
  root.dataset.modePref = mode;
  document
    .querySelectorAll<HTMLElement>("#mode-toggle")
    .forEach((el) => el.setAttribute("aria-label", `Theme mode: ${mode}`));
}

interface ModeControlOptions {
  toggleId: string;
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/** Wire the light/dark/system toggle and apply the stored mode immediately. */
export function initModeControl(opts: ModeControlOptions): void {
  let mode = opts.mode;
  applyMode(mode);

  document.getElementById(opts.toggleId)?.addEventListener("click", () => {
    mode = MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length];
    applyMode(mode);
    opts.onChange(mode);
  });

  // Live-update when the OS theme changes while "system" is selected.
  darkQuery()?.addEventListener("change", () => {
    if (mode === "system") applyMode(mode);
  });
}
