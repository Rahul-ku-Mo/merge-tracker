import type { MergeRequest } from "../types/index";

/** Why an open MR needs the signed-in user's next action. */
export type BlockReason = "review" | "ci" | "threads";

/**
 * Reasons this MR is blocked on the signed-in user. Empty = not blocked on them.
 * Only open MRs count. Missing detail fields (undefined) never produce a reason.
 */
export function blockReasons(mr: MergeRequest): BlockReason[] {
  if (mr.state !== "open") return [];
  const reasons: BlockReason[] = [];
  if (mr.reviewRequestedFromMe) reasons.push("review");
  if (mr.authoredByMe && mr.ci === "fail") reasons.push("ci");
  if (mr.authoredByMe && mr.threadsResolved === false) reasons.push("threads");
  return reasons;
}
