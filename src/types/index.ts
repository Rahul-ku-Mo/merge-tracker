/**
 * Provider-agnostic types.
 *
 * The extension supports multiple Git providers (GitLab, GitHub, Bitbucket).
 * Each provider has its own API shape, but everything downstream of the
 * provider adapters (sync, storage, popup) speaks a single normalized model.
 */

export type ProviderId = "gitlab" | "github" | "bitbucket";

export type ThemeMode = "light" | "dark" | "system";

/** What the user wants to track. Each provider maps this to its own filters. */
export type MrScope = "assigned_to_me" | "created_by_me" | "needs_my_review" | "all";

/** Normalized MR lifecycle state across all providers. */
export type NormalizedState = "open" | "merged" | "closed";

export interface NotifyOnConfig {
  newMr: boolean;
  statusChange: boolean;
  newComment: boolean;
  /** A review was newly requested from the signed-in user. */
  reviewRequested: boolean;
  /** CI on an MR you authored went from passing/running to failing. */
  ciFailed: boolean;
}

/** Notifications are held and sent after the window ends. Hours are local time, 0-23. */
export interface QuietHours {
  enabled: boolean;
  start: number;
  end: number;
}

/**
 * One connected account. A user can have many (e.g. a GitLab + a GitHub).
 *
 * Auth is per-account: the user pastes a read-only token / app password.
 * No secrets are ever embedded in the extension.
 */
export interface Account {
  id: string;
  provider: ProviderId;
  label: string;
  /** API/base host. Empty falls back to the provider default (cloud). */
  host: string;
  /** PAT (GitLab/GitHub) or app password (Bitbucket). Stored locally only. */
  token: string;
  /** Bitbucket app-password username (Basic auth). Unused by others. */
  username?: string;
  /** Bitbucket workspace (required) / GitHub org filter (optional). */
  workspace?: string;
  scope: MrScope;
  states: NormalizedState[];
  enabled: boolean;
  /** Accent color for visually distinguishing this account in the list. */
  color: string;
}

/**
 * Latest pipeline / check result for an MR's head commit.
 * "none" = the provider reports no CI for it; undefined on the MR = not fetched.
 */
export type CiStatus = "pass" | "fail" | "pending" | "none";

/** A single merge/pull request, normalized from any provider. */
export interface MergeRequest {
  /** Stable unique key across providers/accounts. */
  key: string;
  accountId: string;
  accountLabel: string;
  provider: ProviderId;
  number: number;
  title: string;
  state: NormalizedState;
  url: string;
  author: string;
  repo: string;
  updatedAt: string;
  /** Draft / work-in-progress flag, when the provider exposes it cheaply. */
  draft: boolean;
  /**
   * Detail fields, filled by Provider.enrichMergeRequest for open MRs only.
   * undefined = unknown (not fetched, or the detail call failed).
   */
  ci?: CiStatus;
  /**
   * Approval count. Meaning differs by provider: GitLab = approvals given;
   * GitHub = reviewers whose latest review is "Approved"; Bitbucket = participants who approved.
   */
  approvals?: number;
  /** Branch the MR comes from and the branch it merges into. Used for stacked-MR detection. */
  sourceBranch?: string;
  targetBranch?: string;
  /** Display names of the assignees, when the provider reports them. */
  assignees?: string[];
  /** Provider user id of the author (GitLab username, GitHub login, Bitbucket uuid). */
  authorId?: string;
  /** True when the signed-in user (per account) is the author. */
  authoredByMe?: boolean;
  /** True while a review is requested from the signed-in user and not yet given. */
  reviewRequestedFromMe?: boolean;
  /**
   * GitLab only: false when the MR has unresolved threads that block merge.
   * GitHub's REST API does not expose review-thread resolution, so this stays undefined there.
   */
  threadsResolved?: boolean;
}

/**
 * Popup chrome the user can hide to declutter / reclaim space.
 * All default to true (everything shown).
 */
export interface DisplayPrefs {
  /** Light/dark toggle in the popup header. */
  themeControls: boolean;
  /** Project + state filter dropdowns. */
  filters: boolean;
  /** Sort (newest/oldest) toggle button. */
  sort: boolean;
  /** "Open all in tabs" button. */
  openAll: boolean;
  /** "Crafted by Rahul K M" maker's mark. */
  credit: boolean;
}

export interface ExtensionConfig {
  accounts: Account[];
  syncIntervalMinutes: number;
  notifyOn: NotifyOnConfig;
  quietHours: QuietHours;
  /** Base URL for ticket links (Jira or Linear). Empty = ticket chips are off. */
  ticketBaseUrl: string;
  /** Send one summary notification per batch instead of one per event. */
  digestNotifications: boolean;
  /** Repos (full names) the user muted: hidden from list, badge, notifications. */
  mutedRepos: string[];
  mode: ThemeMode;
  /** Which popup controls to show. */
  display: DisplayPrefs;
  /** How long merged/closed MRs stay in the Recent tab, in days. */
  recentRetentionDays: number;
}

/** Newest-first or oldest-first by update time. */
export type MrSortKey = "updated_desc" | "updated_asc";

/** Popup filter/sort selections, persisted so they survive reopening. */
export interface PopupPrefs {
  project: string;
  /** "blocked" = open MRs that need the signed-in user's action (see lib/blocked.ts). */
  state: NormalizedState | "all" | "blocked";
  sort: MrSortKey;
  /** Popup view tab. */
  tab: PopupTab;
  /** Popup grouping: by what needs doing, or by repository. */
  group: PopupGroup;
  /** Recent tab: which closed dates to show. */
  recentDate: RecentDateFilter;
  /** Recent tab: local calendar day (YYYY-MM-DD) used when recentDate is "day". */
  recentDay: string;
}

export type PopupTab = "needs" | "mine" | "reviewing" | "all" | "recent";
/** Closed-date filter for the Recent tab. "day" uses PopupPrefs.recentDay. */
export type RecentDateFilter = "all" | "today" | "7d" | "30d" | "day";
export type PopupGroup = "priority" | "project";

/**
 * Local view state for unread/seen tracking.
 * - seen: key → the updatedAt we last showed, so newer updates can be flagged.
 * - opened: keys the user has clicked through to.
 */
export interface UiState {
  seen: Record<string, string>;
  opened: string[];
  /** key → updatedAt at the time the user hid it; shown again once the MR changes. */
  hidden: Record<string, string>;
}

/**
 * A merged or closed MR kept for the Recent tab.
 * - closedAt: when we first saw it closed (ISO). Drives retention and the date filter.
 * - removed: the user marked it done. Kept as a tombstone so sync doesn't bring it back.
 */
export interface RecentMr {
  mr: MergeRequest;
  closedAt: string;
  removed: boolean;
}

export type SyncReason = "manual" | "alarm" | "install";

export interface MrSnapshot {
  mergeRequests: MergeRequest[];
  lastSyncAt: string | null;
  lastSyncReason?: SyncReason;
}

/** Per-account failure surfaced to the UI without failing the whole sync. */
export interface AccountError {
  accountLabel: string;
  message: string;
}

export interface SyncResultSuccess {
  ok: true;
  count: number;
  notified: number;
  reason: SyncReason;
  errors: AccountError[];
}

export interface SyncResultFailure {
  ok: false;
  error: string;
  reason: SyncReason;
}

export type SyncResult = SyncResultSuccess | SyncResultFailure;

export type ExtensionMessage =
  | { type: "SYNC_NOW" }
  | { type: "RESCHEDULE_ALARM" };

export type ExtensionResponse = SyncResult | { ok: true } | { ok: false; error: string };
