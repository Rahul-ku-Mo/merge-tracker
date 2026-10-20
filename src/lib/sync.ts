import { getConfig, getMrSnapshot, setMrSnapshot } from "./storage";
import { stateLabel, t } from "./i18n";
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
  url: string;
  options: chrome.notifications.NotificationOptions<true>;
}

export async function syncMergeRequests({
  reason = "manual"
}: { reason?: SyncReason } = {}): Promise<SyncResult> {
  const config = await getConfig();
  const enabled = config.accounts.filter((a) => a.enabled && a.token.trim());

  if (!enabled.length) {
    await updateBadge(0);
    return { ok: false, error: t("noConnectedAccounts"), reason };
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

  const muted = new Set(config.mutedRepos);
  const visible = mergeRequests.filter((mr) => !muted.has(mr.repo));

  const notifications = diffAndBuildNotifications(prevByKey, visible, config, reason);
  await dispatchNotifications(notifications);

  await setMrSnapshot({
    mergeRequests,
    lastSyncAt: new Date().toISOString(),
    lastSyncReason: reason
  });

  await updateBadge(visible.filter((mr) => mr.state === "open").length);

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

/** Show the open-MR count on the toolbar icon. */
async function updateBadge(count: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: "#0965ce" });
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
}

async function dispatchNotifications(notifications: PendingNotification[]): Promise<void> {
  if (!notifications.length) return;

  const links: Record<string, string> = {};
  for (const n of notifications) {
    const notificationId = `mr-${n.id}`;
    await chrome.notifications.create(notificationId, n.options);
    if (n.url) links[notificationId] = n.url;
  }

  // Persist id → URL so the service worker can open the right MR on click,
  // even after it has been suspended and restarted.
  const { notifLinks } = await chrome.storage.local.get("notifLinks");
  await chrome.storage.local.set({
    notifLinks: { ...(notifLinks as Record<string, string> | undefined), ...links }
  });
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
        url: mr.url,
        options: notificationFor(t("notifyNewTitle", mr.accountLabel), mr.title)
      });
      continue;
    }

    if (prev && prev.state !== mr.state && notifyOn.statusChange) {
      out.push({
        id: `status-${mr.key}-${mr.state}`,
        url: mr.url,
        options: notificationFor(t("notifyStatusTitle"), `${mr.title} → ${stateLabel(mr.state)}`)
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
