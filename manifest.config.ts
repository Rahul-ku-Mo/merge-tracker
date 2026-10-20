import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";

const { version } = packageJson;

/**
 * Extension manifest (source of truth for Chrome).
 *
 * CRXJS reads this at build time, bundles every referenced file (HTML, TS,
 * CSS, icons), and writes a final manifest + assets into dist/.
 *
 * name/description/title use __MSG_*__ keys from public/_locales/.
 */
export default defineManifest({
  manifest_version: 3,
  default_locale: "en",
  name: "__MSG_extName__",
  version,
  description: "__MSG_extDescription__",
  author: {
    email: "rajamohanty12345@gmail.com",
  },
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/popup.html",
    default_title: "__MSG_extName__",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  options_page: "src/options/options.html",
  permissions: ["storage", "alarms", "notifications"],
  // Required: only the official cloud APIs. Keeping this narrow speeds up
  // store review and shrinks the attack surface.
  host_permissions: [
    "https://gitlab.com/*",
    "https://api.github.com/*",
    "https://api.bitbucket.org/*",
  ],
  // Optional: self-hosted GitLab / GitHub Enterprise. Requested at runtime
  // (with a user gesture) only when someone adds a custom host, so most users
  // never grant it.
  optional_host_permissions: ["https://*/*"],
});
