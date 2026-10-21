import { blockReasons, type BlockReason } from "./blocked";
import type { MergeRequest, PopupTab } from "../types/index";

/** Priority bucket for an open MR. */
export type Bucket = "needs" | "ready" | "waiting";

/** Open MR that the signed-in user can merge: theirs, green, approved, no open threads. */
export function isReadyToMerge(mr: MergeRequest): boolean {
  return (
    mr.state === "open" &&
    !!mr.authoredByMe &&
    !mr.draft &&
    mr.ci === "pass" &&
    (mr.approvals ?? 0) > 0 &&
    mr.threadsResolved !== false
  );
}

export function bucketOf(mr: MergeRequest): Bucket {
  if (blockReasons(mr).length) return "needs";
  if (isReadyToMerge(mr)) return "ready";
  return "waiting";
}

/** Which tabs an MR belongs to. Only open MRs appear in the first three; "all" is filtered by the caller. */
export function inTab(mr: MergeRequest, tab: PopupTab): boolean {
  switch (tab) {
    case "needs":
      return bucketOf(mr) === "needs" && mr.state === "open";
    case "mine":
      return mr.state === "open" && !!mr.authoredByMe;
    case "reviewing":
      return mr.state === "open" && !!mr.reviewRequestedFromMe;
    case "all":
      return true;
  }
}

export type ReasonTone = "red" | "amber" | "blue" | "green" | "gray";

export interface Reason {
  tone: ReasonTone;
  key: string;
}

/** The single headline chip for a row. */
export function headlineReason(mr: MergeRequest): Reason {
  if (mr.state !== "open") return { tone: "gray", key: mr.state === "merged" ? "stateMerged" : "stateClosed" };
  const first: BlockReason | undefined = blockReasons(mr)[0];
  if (first === "review") return { tone: "blue", key: "reasonReview" };
  if (first === "ci") return { tone: "red", key: "reasonCi" };
  if (first === "threads") return { tone: "amber", key: "reasonThreads" };
  if (mr.draft) return { tone: "gray", key: "draft" };
  if (isReadyToMerge(mr)) return { tone: "green", key: "reasonReady" };
  if (mr.authoredByMe) return { tone: "gray", key: "reasonWaiting" };
  return { tone: "gray", key: "reasonOpen" };
}

/** Compact age: 12m, 5h, 3d. */
export function shortAge(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
