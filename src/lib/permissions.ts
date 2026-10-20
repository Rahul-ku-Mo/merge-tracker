import type { Account } from "../types/index";

/** Turn a host URL into a Chrome match pattern, e.g. https://gitlab.acme.com/*. */
function originPattern(host: string): string | null {
  try {
    const url = new URL(host);
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

/**
 * Request host permission for any account using a custom (self-hosted) host.
 * Default cloud hosts are already covered by the manifest. Must be called
 * within a user gesture.
 */
export async function ensureHostPermissions(list: Account[]): Promise<boolean> {
  const origins = new Set<string>();
  for (const account of list) {
    if (!account.enabled) continue;
    const host = account.host.trim();
    if (!host) continue;
    const pattern = originPattern(host);
    if (pattern) origins.add(pattern);
  }

  if (!origins.size) return true;

  const requested = [...origins];
  if (await chrome.permissions.contains({ origins: requested })) {
    return true;
  }
  return chrome.permissions.request({ origins: requested });
}
