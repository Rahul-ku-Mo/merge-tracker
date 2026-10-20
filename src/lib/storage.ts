import type {
  Account,
  ExtensionConfig,
  MrSnapshot,
  NormalizedState,
  PopupPrefs,
  UiState
} from "../types/index";

const DEFAULT_CONFIG: ExtensionConfig = {
  accounts: [],
  syncIntervalMinutes: 5,
  notifyOn: {
    newMr: true,
    statusChange: true,
    newComment: false,
    reviewRequested: true,
    ciFailed: true
  },
  quietHours: { enabled: false, start: 22, end: 8 },
  digestNotifications: false,
  ticketBaseUrl: "",
  mutedRepos: [],
  mode: "system",
  display: {
    themeControls: true,
    filters: true,
    sort: true,
    openAll: true,
    credit: true
  }
};

/** Accent colors cycled through as accounts are added. */
const ACCOUNT_COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#9c36b5", "#e03131", "#0c8599"];

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
      enabled: true,
      color: ACCOUNT_COLORS[0]
    }
  ];
}

/** Backfill fields that older stored accounts may be missing. */
function normalizeAccount(account: Account, index: number): Account {
  return {
    ...account,
    color: account.color || ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
  };
}

export async function getConfig(): Promise<ExtensionConfig> {
  const { config } = await chrome.storage.local.get("config");
  const stored = config as (Partial<ExtensionConfig> & LegacyConfig) | undefined;

  if (!stored) {
    return { ...DEFAULT_CONFIG };
  }

  const rawAccounts = Array.isArray(stored.accounts)
    ? stored.accounts
    : migrateLegacy(stored);

  return {
    accounts: rawAccounts.map(normalizeAccount),
    syncIntervalMinutes: stored.syncIntervalMinutes ?? DEFAULT_CONFIG.syncIntervalMinutes,
    notifyOn: { ...DEFAULT_CONFIG.notifyOn, ...stored.notifyOn },
    quietHours: { ...DEFAULT_CONFIG.quietHours, ...stored.quietHours },
    digestNotifications: stored.digestNotifications ?? DEFAULT_CONFIG.digestNotifications,
    ticketBaseUrl: typeof stored.ticketBaseUrl === "string" ? stored.ticketBaseUrl : "",
    mutedRepos: Array.isArray(stored.mutedRepos) ? stored.mutedRepos : [],
    mode: stored.mode ?? DEFAULT_CONFIG.mode,
    display: { ...DEFAULT_CONFIG.display, ...stored.display }
  };
}

export async function setConfig(partial: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
  const current = await getConfig();
  const next: ExtensionConfig = { ...current, ...partial };
  await chrome.storage.local.set({ config: next });
  return next;
}

export function createAccount(
  provider: Account["provider"],
  label: string,
  index = 0
): Account {
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
    enabled: true,
    color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
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

const DEFAULT_POPUP_PREFS: PopupPrefs = {
  project: "all",
  state: "all",
  sort: "updated_desc"
};

export async function getPopupPrefs(): Promise<PopupPrefs> {
  const { popupPrefs } = await chrome.storage.local.get("popupPrefs");
  return { ...DEFAULT_POPUP_PREFS, ...(popupPrefs as Partial<PopupPrefs> | undefined) };
}

export async function setPopupPrefs(prefs: PopupPrefs): Promise<void> {
  await chrome.storage.local.set({ popupPrefs: prefs });
}

export async function getUiState(): Promise<UiState> {
  const { uiState } = await chrome.storage.local.get("uiState");
  const state = uiState as Partial<UiState> | undefined;
  return { seen: state?.seen ?? {}, opened: state?.opened ?? [] };
}

export async function setUiState(state: UiState): Promise<void> {
  await chrome.storage.local.set({ uiState: state });
}

export type { Account, ExtensionConfig, MrSnapshot, PopupPrefs, UiState };
