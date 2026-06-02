import type { Account, MergeRequest, MrScope, NormalizedState } from "../types/index";
import { type Provider, ProviderApiError, makeMrKey, normalizeHost } from "./types";

const DEFAULT_HOST = "https://gitlab.com";

/** GitLab state param per normalized state. */
const STATE_PARAM: Record<NormalizedState, string> = {
  open: "opened",
  merged: "merged",
  closed: "closed"
};

interface GitLabMr {
  iid: number;
  project_id: number;
  title: string;
  state: string;
  web_url?: string;
  updated_at: string;
  author?: { name?: string; username?: string };
  references?: { full?: string };
}

export const gitlabProvider: Provider = {
  id: "gitlab",
  label: "GitLab",
  defaultHost: DEFAULT_HOST,
  tokenDocsUrl:
    "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html",
  fields: [
    {
      key: "host",
      label: "Host",
      placeholder: DEFAULT_HOST,
      required: false,
      hint: "Leave blank for gitlab.com, or set your self-hosted URL."
    },
    {
      key: "token",
      label: "Personal access token",
      placeholder: "glpat-…",
      required: true,
      secret: true,
      hint: "Create with the read_api scope."
    }
  ],

  async fetchMergeRequests(account: Account): Promise<MergeRequest[]> {
    const token = account.token.trim();
    if (!token) {
      throw new ProviderApiError("GitLab token is not set.");
    }

    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const states = account.states.length ? account.states : ["open" as const];

    const lists = await Promise.all(
      states.map((state) => fetchByState(base, token, account.scope, state))
    );

    const byKey = new Map<string, MergeRequest>();
    for (const [state, raw] of lists) {
      for (const mr of raw) {
        const normalized = toMergeRequest(account, base, mr, state);
        byKey.set(normalized.key, normalized);
      }
    }

    return [...byKey.values()];
  }
};

async function fetchByState(
  base: string,
  token: string,
  scope: MrScope,
  state: NormalizedState
): Promise<[NormalizedState, GitLabMr[]]> {
  const params = new URLSearchParams({
    state: STATE_PARAM[state],
    per_page: "50",
    order_by: "updated_at",
    sort: "desc"
  });
  if (scope !== "all") {
    params.set("scope", scope);
  }

  const res = await fetch(`${base}/api/v4/merge_requests?${params}`, {
    headers: { "PRIVATE-TOKEN": token }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderApiError(
      `GitLab API error (${res.status}): ${body || res.statusText}`,
      res.status
    );
  }

  return [state, (await res.json()) as GitLabMr[]];
}

function toMergeRequest(
  account: Account,
  base: string,
  mr: GitLabMr,
  state: NormalizedState
): MergeRequest {
  const repo = mr.references?.full?.split("!")[0]?.trim() || `project-${mr.project_id}`;
  return {
    key: makeMrKey(account.id, "gitlab", repo, mr.iid),
    accountId: account.id,
    accountLabel: account.label,
    provider: "gitlab",
    number: mr.iid,
    title: mr.title,
    state,
    url: mr.web_url ?? `${base}/${mr.references?.full ?? ""}`,
    author: mr.author?.name ?? mr.author?.username ?? "unknown",
    repo,
    updatedAt: mr.updated_at
  };
}
