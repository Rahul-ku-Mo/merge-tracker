import type { MergeRequest, RecentDateFilter, RecentMr } from "../types/index";

const DAY_MS = 86_400_000;

/** Retention choices offered in Settings, in days. */
export const RECENT_RETENTION_DAYS = [1, 3, 7, 14, 30, 90] as const;
export const DEFAULT_RETENTION_DAYS = 7;

/** Coerce a stored value to one of the offered retention choices. */
export function normalizeRetention(value: unknown): number {
  return (RECENT_RETENTION_DAYS as readonly number[]).includes(value as number)
    ? (value as number)
    : DEFAULT_RETENTION_DAYS;
}

/** Earliest close time still kept, as ISO. Used both for pruning and the provider date filter. */
export function retentionCutoffIso(retentionDays: number, now = Date.now()): string {
  return new Date(now - retentionDays * DAY_MS).toISOString();
}

/**
 * Fold the latest merged/closed MRs into the archive.
 * - Existing entries keep their closedAt and removed flag; their MR data is refreshed.
 * - An MR that is open again leaves the archive.
 * - Entries closed before the retention cutoff are dropped.
 */
export function mergeRecent(
  existing: Record<string, RecentMr>,
  incoming: MergeRequest[],
  retentionDays: number,
  now = Date.now()
): Record<string, RecentMr> {
  const cutoff = now - retentionDays * DAY_MS;
  const next: Record<string, RecentMr> = {};
  for (const [key, entry] of Object.entries(existing)) {
    if (new Date(entry.closedAt).getTime() >= cutoff) next[key] = entry;
  }

  for (const mr of incoming) {
    if (mr.state === "open") {
      delete next[mr.key];
      continue;
    }
    const prev = next[mr.key];
    if (!prev && new Date(mr.updatedAt).getTime() < cutoff) continue;
    next[mr.key] = {
      mr,
      closedAt: prev?.closedAt ?? mr.updatedAt,
      removed: prev?.removed ?? false
    };
  }
  return next;
}

/** Local calendar day as YYYY-MM-DD, so "today" follows the user's clock, not UTC. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whether a closedAt time passes the Recent tab's date filter. */
export function matchesRecentDate(
  closedAt: string,
  filter: RecentDateFilter,
  day: string,
  now = Date.now()
): boolean {
  const at = new Date(closedAt);
  switch (filter) {
    case "all":
      return true;
    case "today":
      return localDayKey(at) === localDayKey(new Date(now));
    case "7d":
      return now - at.getTime() < 7 * DAY_MS;
    case "30d":
      return now - at.getTime() < 30 * DAY_MS;
    case "day":
      return !day || localDayKey(at) === day;
  }
}
