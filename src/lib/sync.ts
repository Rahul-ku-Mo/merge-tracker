import { getConfig, getMrSnapshot, setMrSnapshot } from "./storage";
import { getProvider } from "../providers/registry";
import type {
  Account,
  AccountError,
  ExtensionConfig,
  MergeRequest,
  SyncReason,
  SyncResult
} from "../types/index";

interface PendingNotification {
  id: string;
  options: chrome.notifications.NotificationOptions<true>;
}

export async function syncMergeRequests({
  reason = "manual"
}: { reason?: SyncReason } = {}): Promise<SyncResult> {
  const config = await getConfig();
  const enabled = config.accounts.filter((a) => a.enabled && a.token.trim());

  if (!enabled.length) {
    return { ok: false, error: "No connected accounts. Open Settings.", reason };
  }

  const previous = await getMrSnapshot();
  const prevByKey = new Map(
    previous.mergeRequests.map((mr) => [mr.key, mr] as const)
  );

  const mergeRequests: MergeRequest[] = [];
  const errors: AccountError[] = [];

  // Each account is fetched independently; one failing account does not
  // abort the others.
  const results = await Promise.allSettled(enabled.map((a) => fetchAccount(a)));
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      mergeRequests.push(...result.value);
    } else {
      const account = enabled[i];
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push({ accountLabel: account.label, message });
    }
  });

  if (!mergeRequests.length && errors.length === enabled.length) {
    return { ok: false, error: errors.map((e) => `${e.accountLabel}: ${e.message}`).join("; "), reason };
  }

  mergeRequests.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const notifications = diffAndBuildNotifications(prevByKey, mergeRequests, config, reason);
  for (const n of notifications) {
    await chrome.notifications.create(`mr-${n.id}`, n.options);
  }

  await setMrSnapshot({
    mergeRequests,
    lastSyncAt: new Date().toISOString(),
    lastSyncReason: reason
  });

  return {
    ok: true,
    count: mergeRequests.length,
    notified: notifications.length,
    reason,
    errors
  };
}

function fetchAccount(account: Account): Promise<MergeRequest[]> {
  return getProvider(account.provider).fetchMergeRequests(account);
}

function diffAndBuildNotifications(
  prevByKey: Map<string, MergeRequest>,
  current: MergeRequest[],
  config: ExtensionConfig,
  reason: SyncReason
): PendingNotification[] {
  const out: PendingNotification[] = [];
  const { notifyOn } = config;

  for (const mr of current) {
    const prev = prevByKey.get(mr.key);

    if (!prev && notifyOn.newMr && reason !== "install") {
      out.push({
        id: `new-${mr.key}`,
        options: notificationFor(`New PR · ${mr.accountLabel}`, mr.title)
      });
      continue;
    }

    if (prev && prev.state !== mr.state && notifyOn.statusChange) {
      out.push({
        id: `status-${mr.key}-${mr.state}`,
        options: notificationFor("Status changed", `${mr.title} → ${mr.state}`)
      });
    }
  }

  return out;
}

function notificationFor(
  title: string,
  message: string
): chrome.notifications.NotificationOptions<true> {
  return {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message,
    priority: 1
  };
}
