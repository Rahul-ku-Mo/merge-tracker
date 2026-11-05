import { PROFILES, PROFILE_DESC_KEY, PROFILE_TITLE_KEY } from "../lib/profile";
import { t } from "../lib/i18n";
import type { Profile } from "../types/index";

/** One-time "How do you work?" question. Resolves with the chosen profile and hides itself. */
export function askProfile(): Promise<Profile> {
  const root = document.getElementById("profile-panel");
  const list = document.getElementById("profile-list");
  if (!root || !list) throw new Error("profile panel element missing");

  return new Promise((resolve) => {
    list.replaceChildren();
    for (const profile of PROFILES) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "connect-card";
      card.dataset.profile = profile;

      const body = document.createElement("span");
      body.className = "connect-card-body";
      const name = document.createElement("span");
      name.className = "connect-card-name";
      name.textContent = t(PROFILE_TITLE_KEY[profile]);
      const desc = document.createElement("span");
      desc.className = "connect-card-status";
      desc.textContent = t(PROFILE_DESC_KEY[profile]);
      body.append(name, desc);
      card.append(body);

      card.addEventListener("click", () => {
        root.hidden = true;
        resolve(profile);
      });
      list.append(card);
    }
    root.hidden = false;
    list.querySelector<HTMLButtonElement>(".connect-card")?.focus();
  });
}
