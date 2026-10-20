import type { MergeRequest } from "../types/index";
import { blockReasons } from "./blocked";
import { t } from "./i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Markdown standup built only from already-synced MRs. Nothing is fetched.
 * "Merged" uses the last-updated time, since the list does not carry merge time.
 */
export function buildStandup(mergeRequests: MergeRequest[], now: Date): string {
  const since = now.getTime() - DAY_MS;

  const merged = mergeRequests.filter(
    (mr) => mr.state === "merged" && new Date(mr.updatedAt).getTime() >= since
  );
  const waiting = mergeRequests.filter(
    (mr) => mr.state === "open" && mr.authoredByMe === true && mr.approvals === 0
  );
  const failingCi = mergeRequests.filter((mr) => blockReasons(mr).includes("ci"));
  const reviewsOwed = mergeRequests.filter((mr) => blockReasons(mr).includes("review"));

  const sections: [string, MergeRequest[]][] = [
    [t("standupMerged"), merged],
    [t("standupWaiting"), waiting],
    [t("standupCi"), failingCi],
    [t("standupReviews"), reviewsOwed]
  ];

  const lines = [`## ${t("standupTitle", localDate(now))}`];
  for (const [heading, items] of sections) {
    lines.push("", `**${heading}**`);
    if (!items.length) lines.push(`- ${t("standupNone")}`);
    for (const mr of items) lines.push(`- ${mrLine(mr)}`);
  }
  return lines.join("\n");
}

function mrLine(mr: MergeRequest): string {
  const title = mr.title.replace(/[[\]]/g, "\\$&");
  const ref = `${mr.repo}#${mr.number}`;
  return mr.url ? `[${title}](${mr.url}) (${ref})` : `${title} (${ref})`;
}

/** Local calendar date as YYYY-MM-DD. */
function localDate(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
