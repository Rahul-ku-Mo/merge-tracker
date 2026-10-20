import type { MergeRequest } from "../types/index";

export interface StackRow {
  mr: MergeRequest;
  /** 0 for a root MR; each level of stacking adds one. */
  depth: number;
}

/**
 * Order MRs so each one sits directly under the MR whose source branch it targets.
 * An MR counts as stacked only when exactly one other MR in the same repo and account
 * has that source branch, which avoids guessing between ambiguous matches.
 * Roots keep their input order. Cycles are emitted as roots, so nothing is dropped.
 */
export function orderStacks(items: MergeRequest[]): StackRow[] {
  const parentOf = new Map<string, MergeRequest>();
  for (const mr of items) {
    if (!mr.targetBranch) continue;
    const candidates = items.filter(
      (other) =>
        other !== mr &&
        other.accountId === mr.accountId &&
        other.repo === mr.repo &&
        other.sourceBranch === mr.targetBranch
    );
    if (candidates.length === 1) parentOf.set(mr.key, candidates[0]);
  }

  const childrenOf = new Map<string, MergeRequest[]>();
  for (const mr of items) {
    const parent = parentOf.get(mr.key);
    if (!parent) continue;
    childrenOf.set(parent.key, [...(childrenOf.get(parent.key) ?? []), mr]);
  }

  const rows: StackRow[] = [];
  const visited = new Set<string>();
  const visit = (mr: MergeRequest, depth: number): void => {
    if (visited.has(mr.key)) return;
    visited.add(mr.key);
    rows.push({ mr, depth });
    for (const child of childrenOf.get(mr.key) ?? []) visit(child, depth + 1);
  };

  for (const mr of items) if (!parentOf.has(mr.key)) visit(mr, 0);
  for (const mr of items) visit(mr, 0);
  return rows;
}
