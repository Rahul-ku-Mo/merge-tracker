import type { Account, MergeRequest } from "../types/index";
import { getProvider } from "../providers/registry";

/** Parallel detail requests per sync. Keeps bursts well under provider rate limits. */
const CONCURRENCY = 4;

/**
 * Fill CI, approval, and review fields on open MRs using each provider's detail endpoint.
 * A failed detail call keeps the previous snapshot's values, so one flaky request
 * does not blank a row.
 */
export async function enrichOpenMergeRequests(
  mergeRequests: MergeRequest[],
  accountsById: Map<string, Account>,
  prevByKey: Map<string, MergeRequest>
): Promise<void> {
  const open = mergeRequests.filter((mr) => mr.state === "open");
  // One identity lookup per account per sync, shared by all of its MRs.
  const identities = new Map<string, Promise<string | undefined>>();
  const identityOf = (account: Account): Promise<string | undefined> => {
    let pending = identities.get(account.id);
    if (!pending) {
      pending = getProvider(account.provider)
        .fetchIdentity?.(account)
        .catch(() => undefined) ?? Promise.resolve(undefined);
      identities.set(account.id, pending);
    }
    return pending;
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < open.length) {
      const mr = open[next++];
      const account = accountsById.get(mr.accountId);
      const me = account ? await identityOf(account) : undefined;
      if (me !== undefined && mr.authorId !== undefined) {
        mr.authoredByMe = mr.authorId === me;
      }
      await enrichOne(mr, account, me, prevByKey.get(mr.key));
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, open.length) }, worker));
}

async function enrichOne(
  mr: MergeRequest,
  account: Account | undefined,
  me: string | undefined,
  prev: MergeRequest | undefined
): Promise<void> {
  const provider = account ? getProvider(account.provider) : undefined;
  if (account && provider?.enrichMergeRequest) {
    try {
      Object.assign(mr, await provider.enrichMergeRequest(account, mr, me));
    } catch {
      // Fall through to previous values below.
    }
  }
  mr.ci ??= prev?.ci;
  mr.approvals ??= prev?.approvals;
  mr.reviewRequestedFromMe ??= prev?.reviewRequestedFromMe;
  mr.threadsResolved ??= prev?.threadsResolved;
  mr.sourceBranch ??= prev?.sourceBranch;
  mr.targetBranch ??= prev?.targetBranch;
}
