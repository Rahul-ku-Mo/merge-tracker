import { getConfig, getMrSnapshot, setMrSnapshot } from "./storage";
import { stateLabel, t } from "./i18n";
import { getProvider } from "../providers/registry";
import { enrichOpenMergeRequests } from "./enrich";
import { isQuietNow } from "./quiet-hours";
import type {
  Account,
  AccountError,
  ExtensionConfig,
  MergeRequest,
  SyncReason,
  SyncResult
} from "../types/index";

/** A notification waiting to be shown. Plain data, so it survives service-worker restarts. */
interface PendingNotification {
  id: string;
  url: string;
  title: string;
  message: string;
}

const PENDING_KEY = "pendingNotifications";
/** Cap on held notifications during quiet hours. Oldest are dropped first. */
const MAX_PENDING = 100;
/** How many MR titles a digest lists before summarizing the rest. */
const DIGEST_PREVIEW = 3;

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

  await enrichOpenMergeRequests(
    visible,
    new Map(enabled.map((a) => [a.id, a] as const)),
    prevByKey
  );

  const notifications = diffAndBuildNotifications(prevByKey, visible, config, reason);
  await dispatchNotifications(notifications, config);

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

/**
 * Show new notifications, or hold them while quiet hours are active. Held items are
 * delivered on the first sync after the window ends. Digest mode merges a batch into one.
 */
async function dispatchNotifications(
  fresh: PendingNotification[],
  config: ExtensionConfig
): Promise<void> {
  const { [PENDING_KEY]: stored } = await chrome.storage.local.get(PENDING_KEY);
  const held = (stored as PendingNotification[] | undefined) ?? [];
  const queued = dedupeById([...held, ...fresh]).slice(-MAX_PENDING);

  if (isQuietNow(config.quietHours, new Date())) {
    if (fresh.length) await chrome.storage.local.set({ [PENDING_KEY]: queued });
    return;
  }

  if (held.length) await chrome.storage.local.remove(PENDING_KEY);
  if (!queued.length) return;

  const toShow =
    config.digestNotifications && queued.length > 1 ? [buildDigest(queued)] : queued;
  await showNotifications(toShow);
}

async function showNotifications(items: PendingNotification[]): Promise<void> {
  const links: Record<string, string> = {};
  for (const n of items) {
    const notificationId = `mr-${n.id}`;
    await chrome.notifications.create(notificationId, notificationFor(n.title, n.message));
    if (n.url) links[notificationId] = n.url;
  }

  // Persist id → URL so the service worker can open the right MR on click,
  // even after it has been suspended and restarted.
  const { notifLinks } = await chrome.storage.local.get("notifLinks");
  await chrome.storage.local.set({
    notifLinks: { ...(notifLinks as Record<string, string> | undefined), ...links }
  });
}

/** One summary notification. Clicking it opens the first MR in the batch. */
function buildDigest(items: PendingNotification[]): PendingNotification {
  const preview = items.slice(0, DIGEST_PREVIEW).map((i) => i.message);
  const more = items.length - preview.length;
  return {
    id: `digest-${Date.now()}`,
    url: items[0].url,
    title: t("digestTitle", String(items.length)),
    message: more > 0 ? `${preview.join(" · ")} · ${t("digestMore", String(more))}` : preview.join(" · ")
  };
}

function dedupeById(items: PendingNotification[]): PendingNotification[] {
  const seen = new Map<string, PendingNotification>();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
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

    if (!prev) {
      if (reason === "install") continue;
      if (notifyOn.reviewRequested && mr.reviewRequestedFromMe) {
        out.push(reviewRequestedNotice(mr));
      } else if (notifyOn.newMr) {
        out.push({
          id: `new-${mr.key}`,
          url: mr.url,
          title: t("notifyNewTitle", mr.accountLabel),
          message: mr.title
        });
      }
      continue;
    }

    if (prev.state !== mr.state && notifyOn.statusChange) {
      out.push({
        id: `status-${mr.key}-${mr.state}`,
        url: mr.url,
        title: t("notifyStatusTitle"),
        message: `${mr.title} → ${stateLabel(mr.state)}`
      });
    }

    // Only compare against a known previous value. Older snapshots lack these fields,
    // so the first sync after upgrading must not notify for every MR.
    if (notifyOn.reviewRequested && prev.reviewRequestedFromMe === false && mr.reviewRequestedFromMe) {
      out.push(reviewRequestedNotice(mr));
    }

    if (notifyOn.ciFailed && mr.authoredByMe && prev.ci && prev.ci !== "fail" && mr.ci === "fail") {
      out.push({
        id: `ci-${mr.key}-${mr.updatedAt}`,
        url: mr.url,
        title: t("notifyCiTitle"),
        message: mr.title
      });
    }
  }

  return out;
}

function reviewRequestedNotice(mr: MergeRequest): PendingNotification {
  return {
    id: `review-${mr.key}-${mr.updatedAt}`,
    url: mr.url,
    title: t("notifyReviewTitle"),
    message: mr.title
  };
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
