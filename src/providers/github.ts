import type { Account, CiStatus, MergeRequest, MrScope, NormalizedState } from "../types/index";
import { type FetchOptions, type Provider, ProviderApiError, makeMrKey, normalizeHost } from "./types";
import { t } from "../lib/i18n";

const DEFAULT_HOST = "https://api.github.com";

/** Scope → GitHub search qualifier (current user is @me). */
const SCOPE_QUALIFIER: Record<MrScope, string> = {
  assigned_to_me: "assignee:@me",
  created_by_me: "author:@me",
  needs_my_review: "review-requested:@me",
  all: "involves:@me"
};

/** Normalized state → GitHub search qualifier. */
const STATE_QUALIFIER: Record<NormalizedState, string> = {
  open: "is:open",
  merged: "is:merged",
  closed: "is:closed is:unmerged"
};

interface GitHubIssueItem {
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  html_url: string;
  updated_at: string;
  repository_url: string;
  user?: { login?: string };
  assignees?: { login?: string }[];
  pull_request?: { merged_at: string | null };
}

interface GitHubSearchResponse {
  items: GitHubIssueItem[];
}

export const githubProvider: Provider = {
  id: "github",
  label: "GitHub",
  defaultHost: DEFAULT_HOST,
  tokenDocsUrl:
    "https://github.com/settings/tokens?type=beta",
  fields: [
    {
      key: "host",
      label: t("fieldApiHost"),
      placeholder: DEFAULT_HOST,
      required: false,
      hint: t("hintGithubHost")
    },
    {
      key: "workspace",
      label: t("fieldOrgFilter"),
      placeholder: "my-org",
      required: false,
      kind: "select",
      hint: t("hintGithubOrg")
    },
    {
      key: "token",
      label: t("fieldToken"),
      placeholder: "github_pat_… / ghp_…",
      required: true,
      secret: true,
      hint: t("hintGithubToken")
    }
  ],

  async listWorkspaces(token: string, host: string): Promise<string[]> {
    const base = normalizeHost(host) || DEFAULT_HOST;
    const res = await fetch(`${base}/user/orgs?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!res.ok) {
      throw new ProviderApiError(`GitHub API error (${res.status})`, res.status);
    }
    const orgs = (await res.json()) as { login?: string }[];
    return orgs
      .map((org) => org.login ?? "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  },

  async fetchMergeRequests(account: Account, options: FetchOptions = {}): Promise<MergeRequest[]> {
    const token = account.token.trim();
    if (!token) {
      throw new ProviderApiError("GitHub token is not set.");
    }

    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const states = options.states?.length
      ? options.states
      : account.states.length
        ? account.states
        : ["open" as const];
    const org = account.workspace?.trim();

    const lists = await Promise.all(
      states.map((state) =>
        search(base, token, account.scope, state, org, options.updatedAfter)
      )
    );

    const byKey = new Map<string, MergeRequest>();
    for (const items of lists) {
      for (const item of items) {
        const normalized = toMergeRequest(account, item);
        byKey.set(normalized.key, normalized);
      }
    }

    return [...byKey.values()];
  },

  async fetchIdentity(account: Account): Promise<string> {
    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const user = await getGitHubJson<{ login?: string }>(`${base}/user`, account.token.trim());
    if (!user.login) throw new ProviderApiError("Could not resolve GitHub login.");
    return user.login;
  },

  async enrichMergeRequest(
    account: Account,
    mr: MergeRequest,
    me: string | undefined
  ): Promise<Partial<MergeRequest>> {
    const token = account.token.trim();
    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const pullUrl = `${base}/repos/${mr.repo}/pulls/${mr.number}`;

    const pull = await getGitHubJson<GitHubPullDetail>(pullUrl, token);
    const sha = pull.head?.sha;
    // Requested reviewers drop off once they submit a review, so presence means "still owed".
    const reviewRequestedFromMe = me
      ? (pull.requested_reviewers ?? []).some((r) => r.login === me)
      : undefined;
    // The search API has no branch names, so they come from the pull detail.
    const branches = { sourceBranch: pull.head?.ref, targetBranch: pull.base?.ref };
    if (!sha) return { ...branches, reviewRequestedFromMe };

    const [checks, status, reviews] = await Promise.all([
      getGitHubJson<GitHubCheckRuns>(`${base}/repos/${mr.repo}/commits/${sha}/check-runs?per_page=100`, token),
      getGitHubJson<GitHubCombinedStatus>(`${base}/repos/${mr.repo}/commits/${sha}/status`, token),
      getGitHubJson<GitHubReview[]>(`${pullUrl}/reviews?per_page=100`, token)
    ]);

    return {
      ...branches,
      ci: githubCi(checks.check_runs ?? [], status),
      approvals: countApprovals(reviews),
      reviewRequestedFromMe
    };
  }
};

interface GitHubPullDetail {
  head?: { sha?: string; ref?: string };
  base?: { ref?: string };
  requested_reviewers?: { login?: string }[];
}

interface GitHubCheckRuns {
  check_runs?: { status: string; conclusion: string | null }[];
}

interface GitHubCombinedStatus {
  state: string;
  total_count: number;
}

interface GitHubReview {
  user?: { login?: string };
  state: string;
}

const FAILED_CONCLUSIONS = ["failure", "timed_out", "cancelled", "action_required", "startup_failure"];

/** Check runs (Actions, apps) and legacy commit statuses combined into one CI state. */
function githubCi(runs: NonNullable<GitHubCheckRuns["check_runs"]>, status: GitHubCombinedStatus): CiStatus {
  const hasAny = runs.length > 0 || status.total_count > 0;
  if (!hasAny) return "none";

  const failed =
    runs.some((r) => r.status === "completed" && FAILED_CONCLUSIONS.includes(r.conclusion ?? "")) ||
    status.state === "failure" ||
    status.state === "error";
  if (failed) return "fail";

  const pending = runs.some((r) => r.status !== "completed") || status.state === "pending";
  return pending ? "pending" : "pass";
}

/** Count reviewers whose most recent approve/request-changes/dismiss is "APPROVED". */
function countApprovals(reviews: GitHubReview[]): number {
  const latest = new Map<string, string>();
  for (const review of reviews) {
    if (!review.user?.login) continue;
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state)) {
      latest.set(review.user.login, review.state);
    }
  }
  return [...latest.values()].filter((state) => state === "APPROVED").length;
}

async function getGitHubJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) {
    throw new ProviderApiError(`GitHub API error (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

async function search(
  base: string,
  token: string,
  scope: MrScope,
  state: NormalizedState,
  org: string | undefined,
  updatedAfter: string | undefined
): Promise<GitHubIssueItem[]> {
  const qualifiers = ["is:pr", SCOPE_QUALIFIER[scope], STATE_QUALIFIER[state]];
  if (org) {
    qualifiers.push(`org:${org}`);
  }
  if (updatedAfter) {
    // Search qualifiers take a date; the time of day is dropped, so this is a coarse pre-filter.
    qualifiers.push(`updated:>=${updatedAfter.slice(0, 10)}`);
  }

  const params = new URLSearchParams({
    q: qualifiers.join(" "),
    per_page: "50",
    sort: "updated",
    order: "desc"
  });

  const res = await fetch(`${base}/search/issues?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderApiError(
      `GitHub API error (${res.status}): ${body || res.statusText}`,
      res.status
    );
  }

  const data = (await res.json()) as GitHubSearchResponse;
  return data.items ?? [];
}

function toMergeRequest(account: Account, item: GitHubIssueItem): MergeRequest {
  const repo = item.repository_url.split("/repos/")[1] ?? "unknown";
  const state: NormalizedState = item.pull_request?.merged_at
    ? "merged"
    : item.state === "closed"
      ? "closed"
      : "open";

  return {
    key: makeMrKey(account.id, "github", repo, item.number),
    accountId: account.id,
    accountLabel: account.label,
    provider: "github",
    number: item.number,
    title: item.title,
    state,
    url: item.html_url,
    author: item.user?.login ?? "unknown",
    repo,
    updatedAt: item.updated_at,
    draft: Boolean(item.draft) || /^\s*(\[?(wip|draft)\]?)[:\s-]/i.test(item.title),
    authorId: item.user?.login,
    assignees: (item.assignees ?? []).map((a) => a.login ?? "").filter(Boolean)
  };
}
