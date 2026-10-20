import type { MergeRequest } from "../types/index";

/** Title keys are uppercase (ABC-123), so ordinary words in titles don't match. */
const TITLE_KEY = /\b([A-Z][A-Z0-9]+-\d+)\b/;
/** Branch keys may be lowercase (feature/abc-123-login). Only matched at a path segment start. */
const BRANCH_KEY = /(?:^|\/)([A-Za-z][A-Za-z0-9]+-\d+)(?=[-_/]|$)/;

/** Ticket key from the source branch, else the title. Returned uppercase. */
export function extractTicketKey(mr: Pick<MergeRequest, "sourceBranch" | "title">): string | undefined {
  const fromBranch = mr.sourceBranch?.match(BRANCH_KEY)?.[1];
  if (fromBranch) return fromBranch.toUpperCase();
  return mr.title.match(TITLE_KEY)?.[1];
}

/** Accepts only http(s) bases so a stored value can never become a javascript: link. Returns "" if invalid. */
export function normalizeTicketBase(value: string): string {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/** Jira: https://<site>.atlassian.net/browse/  Linear: https://linear.app/<workspace>/issue/ */
export function buildTicketUrl(base: string, key: string): string {
  return `${base}${encodeURIComponent(key)}`;
}
