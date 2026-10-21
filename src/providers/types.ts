import type { Account, MergeRequest, NormalizedState, ProviderId } from "../types/index";

/** Overrides for one list fetch. Omitted fields fall back to the account's own settings. */
export interface FetchOptions {
  /** States to fetch instead of account.states. */
  states?: NormalizedState[];
  /** Only MRs updated at or after this ISO time. Providers that cannot filter by date ignore it. */
  updatedAfter?: string;
}

/** Raised by any provider adapter; carries the HTTP status when available. */
export class ProviderApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ProviderApiError";
    this.status = status;
  }
}

/** A field the options UI should render for accounts of this provider. */
export interface ProviderField {
  key: "host" | "username" | "workspace" | "token";
  label: string;
  placeholder: string;
  required: boolean;
  /** password input (token) vs text. */
  secret?: boolean;
  /** "select" renders a dropdown filled by Provider.listWorkspaces. */
  kind?: "select";
  hint?: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** Default cloud host used when the account leaves host blank. */
  defaultHost: string;
  /** Link to where the user creates a read-only token. */
  tokenDocsUrl: string;
  /** Drives the dynamic options form. */
  fields: ProviderField[];
  /** Organizations/workspaces the token can see, for the workspace dropdown. */
  listWorkspaces?(token: string, host: string): Promise<string[]>;
  /** Fetch + normalize the account's merge/pull requests. */
  fetchMergeRequests(account: Account, options?: FetchOptions): Promise<MergeRequest[]>;
  /** Provider id of the signed-in user for this account (matches MergeRequest.authorId). */
  fetchIdentity?(account: Account): Promise<string>;
  /**
   * Optional per-MR detail call (CI, approvals, review requests). Costs extra requests,
   * so sync only runs it for open MRs. `me` is the signed-in user's id, if known.
   * Throwing leaves the fields unknown.
   */
  enrichMergeRequest?(
    account: Account,
    mr: MergeRequest,
    me: string | undefined
  ): Promise<Partial<MergeRequest>>;
}

export function normalizeHost(host: string): string {
  return host.trim().replace(/\/+$/, "");
}

/** Build the stable, globally-unique key for a normalized MR. */
export function makeMrKey(
  accountId: string,
  provider: ProviderId,
  repo: string,
  number: number
): string {
  return `${accountId}:${provider}:${repo}:${number}`;
}
