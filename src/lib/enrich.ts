import type { Account, MergeRequest } from "../types/index";
import { getProvider } from "../providers/registry";

/** Parallel detail requests per sync. Keeps bursts well under provider rate limits. */
const CONCURRENCY = 4;

/**
 * Fill CI and approval fields on open MRs using each provider's detail endpoint.
 * A failed detail call keeps the previous snapshot's values, so one flaky request
 * does not blank a row.
 */
export async function enrichOpenMergeRequests(
  mergeRequests: MergeRequest[],
  accountsById: Map<string, Account>,
  prevByKey: Map<string, MergeRequest>
): Promise<void> {
  const open = mergeRequests.filter((mr) => mr.state === "open");
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < open.length) {
      const mr = open[next++];
      await enrichOne(mr, accountsById.get(mr.accountId), prevByKey.get(mr.key));
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, open.length) }, worker));
}

async function enrichOne(
  mr: MergeRequest,
  account: Account | undefined,
  prev: MergeRequest | undefined
): Promise<void> {
  const provider = account ? getProvider(account.provider) : undefined;
  if (account && provider?.enrichMergeRequest) {
    try {
      Object.assign(mr, await provider.enrichMergeRequest(account, mr));
    } catch {
      // Fall through to previous values below.
    }
  }
  mr.ci ??= prev?.ci;
  mr.approvals ??= prev?.approvals;
}
