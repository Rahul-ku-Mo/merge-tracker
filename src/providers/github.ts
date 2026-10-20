import type { Account, MergeRequest, MrScope, NormalizedState } from "../types/index";
import { type Provider, ProviderApiError, makeMrKey, normalizeHost } from "./types";
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

  async fetchMergeRequests(account: Account): Promise<MergeRequest[]> {
    const token = account.token.trim();
    if (!token) {
      throw new ProviderApiError("GitHub token is not set.");
    }

    const base = normalizeHost(account.host) || DEFAULT_HOST;
    const states = account.states.length ? account.states : ["open" as const];
    const org = account.workspace?.trim();

    const lists = await Promise.all(
      states.map((state) => search(base, token, account.scope, state, org))
    );

    const byKey = new Map<string, MergeRequest>();
    for (const items of lists) {
      for (const item of items) {
        const normalized = toMergeRequest(account, item);
        byKey.set(normalized.key, normalized);
      }
    }

    return [...byKey.values()];
  }
};

async function search(
  base: string,
  token: string,
  scope: MrScope,
  state: NormalizedState,
  org: string | undefined
): Promise<GitHubIssueItem[]> {
  const qualifiers = ["is:pr", SCOPE_QUALIFIER[scope], STATE_QUALIFIER[state]];
  if (org) {
    qualifiers.push(`org:${org}`);
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
    draft: Boolean(item.draft) || /^\s*(\[?(wip|draft)\]?)[:\s-]/i.test(item.title)
  };
}
