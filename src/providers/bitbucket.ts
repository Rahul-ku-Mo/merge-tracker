import type { Account, MergeRequest, NormalizedState } from "../types/index";
import { type Provider, ProviderApiError, makeMrKey, normalizeHost } from "./types";

const DEFAULT_HOST = "https://api.bitbucket.org/2.0";

/**
 * Normalized state → Bitbucket pull request states.
 * (The global "my PRs" endpoint was removed in Feb 2025; we must scope to a
 * workspace and the current user's UUID.)
 */
const STATE_VALUES: Record<NormalizedState, string[]> = {
  open: ["OPEN"],
  merged: ["MERGED"],
  closed: ["DECLINED", "SUPERSEDED"]
};

interface BitbucketUser {
  uuid: string;
}

interface BitbucketPr {
  id: number;
  title: string;
  state: string;
  updated_on: string;
  links?: { html?: { href?: string } };
  author?: { display_name?: string; nickname?: string };
  destination?: { repository?: { full_name?: string } };
}

interface BitbucketPrPage {
  values?: BitbucketPr[];
}

export const bitbucketProvider: Provider = {
  id: "bitbucket",
  label: "Bitbucket",
  defaultHost: DEFAULT_HOST,
  tokenDocsUrl:
    "https://support.atlassian.com/bitbucket-cloud/docs/create-an-app-password/",
  fields: [
    {
      key: "username",
      label: "Username",
      placeholder: "your-bitbucket-username",
      required: true,
      hint: "Used with the app password for Basic auth."
    },
    {
      key: "workspace",
      label: "Workspace",
      placeholder: "my-workspace",
      required: true,
      hint: "Bitbucket requires a workspace to list your PRs."
    },
    {
      key: "token",
      label: "App password",
      placeholder: "app password",
      required: true,
      secret: true,
      hint: "Create one with the Pull requests: Read scope."
    }
  ],

  async fetchMergeRequests(account: Account): Promise<MergeRequest[]> {
    const token = account.token.trim();
    const workspace = account.workspace?.trim();
    if (!token) {
      throw new ProviderApiError("Bitbucket app password is not set.");
    }
    if (!workspace) {
      throw new ProviderApiError("Bitbucket workspace is required.");
    }

    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const authHeader = buildAuthHeader(account);

    const me = await fetchJson<BitbucketUser>(`${base}/user`, authHeader);
    const selectedUser = encodeURIComponent(me.uuid);

    const states = account.states.length ? account.states : ["open" as const];
    const lists = await Promise.all(
      states.map((state) =>
        fetchPrs(base, workspace, selectedUser, authHeader, state)
      )
    );

    const byKey = new Map<string, MergeRequest>();
    for (const [state, prs] of lists) {
      for (const pr of prs) {
        const normalized = toMergeRequest(account, pr, state);
        byKey.set(normalized.key, normalized);
      }
    }

    return [...byKey.values()];
  }
};

function buildAuthHeader(account: Account): string {
  const username = account.username?.trim();
  if (username) {
    return `Basic ${btoa(`${username}:${account.token.trim()}`)}`;
  }
  return `Bearer ${account.token.trim()}`;
}

async function fetchJson<T>(url: string, authHeader: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderApiError(
      `Bitbucket API error (${res.status}): ${body || res.statusText}`,
      res.status
    );
  }
  return (await res.json()) as T;
}

async function fetchPrs(
  base: string,
  workspace: string,
  selectedUser: string,
  authHeader: string,
  state: NormalizedState
): Promise<[NormalizedState, BitbucketPr[]]> {
  const params = new URLSearchParams({ pagelen: "50", sort: "-updated_on" });
  for (const value of STATE_VALUES[state]) {
    params.append("state", value);
  }

  const url = `${base}/pullrequests/${workspace}/${selectedUser}?${params}`;
  const page = await fetchJson<BitbucketPrPage>(url, authHeader);
  return [state, page.values ?? []];
}

function toMergeRequest(
  account: Account,
  pr: BitbucketPr,
  state: NormalizedState
): MergeRequest {
  const repo = pr.destination?.repository?.full_name ?? "unknown";
  return {
    key: makeMrKey(account.id, "bitbucket", repo, pr.id),
    accountId: account.id,
    accountLabel: account.label,
    provider: "bitbucket",
    number: pr.id,
    title: pr.title,
    state,
    url: pr.links?.html?.href ?? "",
    author: pr.author?.display_name ?? pr.author?.nickname ?? "unknown",
    repo,
    updatedAt: pr.updated_on
  };
}
