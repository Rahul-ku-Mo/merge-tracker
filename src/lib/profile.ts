import type { PopupTab, Profile } from "../types/index";

/** Popup layout for one way of working. Users can still toggle individual options in Settings. */
export interface ProfilePreset {
  /** Tabs shown, in order. */
  tabs: PopupTab[];
  /** Tab opened when the saved one isn't in `tabs`. */
  defaultTab: PopupTab;
  /** Locale keys that replace the default label of a tab. */
  tabLabels: Partial<Record<PopupTab, string>>;
  /** Row signals beyond CI status. */
  signals: { approvals: boolean; threads: boolean };
}

export const PROFILES: Profile[] = ["solo", "team", "org"];

export const PROFILE_PRESETS: Record<Profile, ProfilePreset> = {
  // Nobody to review for: just what's open and what shipped.
  solo: {
    tabs: ["all", "recent"],
    defaultTab: "all",
    tabLabels: { all: "tabOpenSolo", recent: "tabMergedSolo" },
    signals: { approvals: false, threads: false }
  },
  // Reviews go both ways, so show who owes what.
  team: {
    tabs: ["needs", "mine", "reviewing", "all", "recent"],
    defaultTab: "needs",
    tabLabels: {},
    signals: { approvals: true, threads: true }
  },
  // Many repos: lead with what's asked of me, drop the "mine" list.
  org: {
    tabs: ["needs", "reviewing", "all", "recent"],
    defaultTab: "needs",
    tabLabels: {},
    signals: { approvals: true, threads: true }
  }
};

/** Used before the user answers the question: matches the layout existing users already have. */
export const FALLBACK_PROFILE: Profile = "team";

export function isProfile(value: unknown): value is Profile {
  return value === "solo" || value === "team" || value === "org";
}

/** Locale keys for each profile's name and one-line description. */
export const PROFILE_TITLE_KEY: Record<Profile, string> = {
  solo: "profileSoloTitle",
  team: "profileTeamTitle",
  org: "profileOrgTitle"
};
export const PROFILE_DESC_KEY: Record<Profile, string> = {
  solo: "profileSoloDesc",
  team: "profileTeamDesc",
  org: "profileOrgDesc"
};
