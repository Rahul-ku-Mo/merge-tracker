import { syncMergeRequests } from "../lib/sync";
import { getConfig } from "../lib/storage";
import type { ExtensionMessage, ExtensionResponse } from "../types/index";

const ALARM_NAME = "gitlab-mr-sync";

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleAlarm();
  await syncMergeRequests({ reason: "install" });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await syncMergeRequests({ reason: "alarm" });
  }
});

// Open the corresponding merge request when its notification is clicked.
chrome.notifications.onClicked.addListener(async (notificationId) => {
  const { notifLinks } = await chrome.storage.local.get("notifLinks");
  const links = (notifLinks as Record<string, string> | undefined) ?? {};
  const url = links[notificationId];
  if (url) {
    await chrome.tabs.create({ url });
    chrome.notifications.clear(notificationId);
    delete links[notificationId];
    await chrome.storage.local.set({ notifLinks: links });
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    if (!isTrustedSender(sender)) {
      sendResponse({ ok: false, error: "Untrusted message sender." });
      return false;
    }

    if (message.type === "SYNC_NOW") {
      syncMergeRequests({ reason: "manual" })
        .then(sendResponse)
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : String(err);
          sendResponse({ ok: false, error, reason: "manual" });
        });
      return true;
    }

    if (message.type === "RESCHEDULE_ALARM") {
      scheduleAlarm()
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : String(err);
          sendResponse({ ok: false, error });
        });
      return true;
    }

    return false;
  }
);

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

async function scheduleAlarm(): Promise<void> {
  const config = await getConfig();
  const minutes = Math.max(1, config.syncIntervalMinutes || 5);

  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
}
