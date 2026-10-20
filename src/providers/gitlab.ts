import type { Account, CiStatus, MergeRequest, MrScope, NormalizedState } from "../types/index";
import { type Provider, ProviderApiError, makeMrKey, normalizeHost } from "./types";
import { t } from "../lib/i18n";

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
  draft?: boolean;
  work_in_progress?: boolean;
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
      label: t("fieldHost"),
      placeholder: DEFAULT_HOST,
      required: false,
      hint: t("hintGitlabHost")
    },
    {
      key: "token",
      label: t("fieldToken"),
      placeholder: "glpat-…",
      required: true,
      secret: true,
      hint: t("hintGitlabToken")
    }
  ],

  async fetchMergeRequests(account: Account): Promise<MergeRequest[]> {
    const token = account.token.trim();
    if (!token) {
      throw new ProviderApiError("GitLab token is not set.");
    }

    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const states = account.states.length ? account.states : ["open" as const];

    // "Needs my review" has no scope value in GitLab; it filters by
    // reviewer_username, which requires knowing the current user.
    const reviewerUsername =
      account.scope === "needs_my_review" ? await fetchUsername(base, token) : undefined;

    const lists = await Promise.all(
      states.map((state) =>
        fetchByState(base, token, account.scope, state, reviewerUsername)
      )
    );

    const byKey = new Map<string, MergeRequest>();
    for (const [state, raw] of lists) {
      for (const mr of raw) {
        const normalized = toMergeRequest(account, base, mr, state);
        byKey.set(normalized.key, normalized);
      }
    }

    return [...byKey.values()];
  },

  async fetchIdentity(account: Account): Promise<string> {
    return fetchUsername(normalizeHost(account.host) || DEFAULT_HOST, account.token.trim());
  },

  async enrichMergeRequest(
    account: Account,
    mr: MergeRequest,
    me: string | undefined
  ): Promise<Partial<MergeRequest>> {
    const token = account.token.trim();
    const base = normalizeHost(account.host) || DEFAULT_HOST;
    // The URL-encoded "group/project" path works as the project identifier.
    const mrUrl = `${base}/api/v4/projects/${encodeURIComponent(mr.repo)}/merge_requests/${mr.number}`;

    const [detail, approvals] = await Promise.all([
      getGitLabJson<GitLabMrDetail>(mrUrl, token),
      getGitLabJson<GitLabApprovals>(`${mrUrl}/approvals`, token).catch(() => undefined)
    ]);

    const approvedBy = (approvals?.approved_by ?? []).map((a) => a.user?.username);
    const reviewRequestedFromMe = me
      ? (detail.reviewers ?? []).some((r) => r.username === me) && !approvedBy.includes(me)
      : undefined;

    return {
      ci: gitlabCi(detail.head_pipeline?.status ?? undefined),
      approvals: approvals?.approved_by?.length,
      threadsResolved: detail.blocking_discussions_resolved,
      reviewRequestedFromMe
    };
  }
};

interface GitLabMrDetail {
  head_pipeline?: { status?: string } | null;
  reviewers?: { username?: string }[];
  blocking_discussions_resolved?: boolean;
}

interface GitLabApprovals {
  approved_by?: { user?: { username?: string } }[];
}

/** GitLab pipeline status → normalized CI status. */
function gitlabCi(status: string | undefined): CiStatus {
  switch (status) {
    case "success":
      return "pass";
    case "failed":
      return "fail";
    case "running":
    case "pending":
    case "created":
    case "preparing":
    case "waiting_for_resource":
    case "scheduled":
      return "pending";
    default:
      return "none";
  }
}

async function getGitLabJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { "PRIVATE-TOKEN": token } });
  if (!res.ok) {
    throw new ProviderApiError(`GitLab API error (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

async function fetchUsername(base: string, token: string): Promise<string> {
  const res = await fetch(`${base}/api/v4/user`, {
    headers: { "PRIVATE-TOKEN": token }
  });
  if (!res.ok) {
    throw new ProviderApiError(`GitLab API error (${res.status})`, res.status);
  }
  const user = (await res.json()) as { username?: string };
  if (!user.username) {
    throw new ProviderApiError("Could not resolve GitLab username.");
  }
  return user.username;
}

async function fetchByState(
  base: string,
  token: string,
  scope: MrScope,
  state: NormalizedState,
  reviewerUsername: string | undefined
): Promise<[NormalizedState, GitLabMr[]]> {
  const params = new URLSearchParams({
    state: STATE_PARAM[state],
    per_page: "50",
    order_by: "updated_at",
    sort: "desc"
  });

  // GitLab defaults to scope=created_by_me when omitted, which would hide
  // private-project MRs authored by others. Always send an explicit scope.
  params.set("scope", scope === "assigned_to_me" || scope === "created_by_me" ? scope : "all");
  if (scope === "needs_my_review" && reviewerUsername) {
    params.set("reviewer_username", reviewerUsername);
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
    updatedAt: mr.updated_at,
    draft: Boolean(mr.draft ?? mr.work_in_progress),
    authorId: mr.author?.username
  };
}
