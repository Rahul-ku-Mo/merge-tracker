import type { Account, MergeRequest, ProviderId } from "../types/index";

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
  /** Fetch + normalize the account's merge/pull requests. */
  fetchMergeRequests(account: Account): Promise<MergeRequest[]>;
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
