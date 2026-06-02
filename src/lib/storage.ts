import type { Account, ExtensionConfig, MrSnapshot, NormalizedState } from "../types/index";

const DEFAULT_CONFIG: ExtensionConfig = {
  accounts: [],
  syncIntervalMinutes: 5,
  notifyOn: {
    newMr: true,
    statusChange: true,
    newComment: false
  }
};

/** Old single-account (GitLab-only) config shape, kept for migration. */
interface LegacyConfig {
  gitlabHost?: string;
  accessToken?: string;
  scope?: Account["scope"];
  states?: string[];
}

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `acct-${Date.now()}-${Math.random()}`;
}

/** opened/closed/merged/locked → normalized states. */
function normalizeLegacyStates(states: string[] | undefined): NormalizedState[] {
  const mapped = (states ?? ["opened"]).map((s): NormalizedState => {
    if (s === "merged") return "merged";
    if (s === "closed" || s === "locked") return "closed";
    return "open";
  });
  return [...new Set(mapped)];
}

/** Migrate a pre-multi-provider config into a single GitLab account. */
function migrateLegacy(raw: LegacyConfig): Account[] {
  if (!raw.accessToken?.trim()) {
    return [];
  }
  return [
    {
      id: generateId(),
      provider: "gitlab",
      label: "GitLab",
      host: raw.gitlabHost ?? "https://gitlab.com",
      token: raw.accessToken,
      scope: raw.scope ?? "assigned_to_me",
      states: normalizeLegacyStates(raw.states),
      enabled: true
    }
  ];
}

export async function getConfig(): Promise<ExtensionConfig> {
  const { config } = await chrome.storage.local.get("config");
  const stored = config as (Partial<ExtensionConfig> & LegacyConfig) | undefined;

  if (!stored) {
    return { ...DEFAULT_CONFIG };
  }

  const accounts = Array.isArray(stored.accounts)
    ? stored.accounts
    : migrateLegacy(stored);

  return {
    accounts,
    syncIntervalMinutes: stored.syncIntervalMinutes ?? DEFAULT_CONFIG.syncIntervalMinutes,
    notifyOn: { ...DEFAULT_CONFIG.notifyOn, ...stored.notifyOn }
  };
}

export async function setConfig(partial: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
  const current = await getConfig();
  const next: ExtensionConfig = { ...current, ...partial };
  await chrome.storage.local.set({ config: next });
  return next;
}

export function createAccount(provider: Account["provider"], label: string): Account {
  return {
    id: generateId(),
    provider,
    label,
    host: "",
    token: "",
    username: "",
    workspace: "",
    scope: "assigned_to_me",
    states: ["open"],
    enabled: true
  };
}

export async function getMrSnapshot(): Promise<MrSnapshot> {
  const { mrSnapshot } = await chrome.storage.local.get("mrSnapshot");
  const snapshot = mrSnapshot as MrSnapshot | undefined;
  return snapshot ?? { mergeRequests: [], lastSyncAt: null };
}

export async function setMrSnapshot(snapshot: MrSnapshot): Promise<void> {
  await chrome.storage.local.set({ mrSnapshot: snapshot });
}

export type { Account, ExtensionConfig, MrSnapshot };
