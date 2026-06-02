/**
 * Provider-agnostic types.
 *
 * The extension supports multiple Git providers (GitLab, GitHub, Bitbucket).
 * Each provider has its own API shape, but everything downstream of the
 * provider adapters (sync, storage, popup) speaks a single normalized model.
 */

export type ProviderId = "gitlab" | "github" | "bitbucket";

/** What the user wants to track. Each provider maps this to its own filters. */
export type MrScope = "assigned_to_me" | "created_by_me" | "all";

/** Normalized MR lifecycle state across all providers. */
export type NormalizedState = "open" | "merged" | "closed";

export interface NotifyOnConfig {
  newMr: boolean;
  statusChange: boolean;
  newComment: boolean;
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
}

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
}

export interface ExtensionConfig {
  accounts: Account[];
  syncIntervalMinutes: number;
  notifyOn: NotifyOnConfig;
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
