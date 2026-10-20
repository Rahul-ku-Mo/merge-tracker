import type { QuietHours } from "../types/index";

/** True when `now` falls inside the quiet window. The window wraps past midnight when start > end. */
export function isQuietNow(quiet: QuietHours, now: Date): boolean {
  if (!quiet.enabled || quiet.start === quiet.end) return false;
  const hour = now.getHours();
  return quiet.start < quiet.end
    ? hour >= quiet.start && hour < quiet.end
    : hour >= quiet.start || hour < quiet.end;
}
