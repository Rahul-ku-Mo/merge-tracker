import type { ProviderId } from "../types/index";

interface ProviderIcon {
  viewBox: string;
  /** SVG child markup. Paths carry their own fills, except GitHub which uses currentColor. */
  body: string;
}

/**
 * Provider logos, kept as their source artwork.
 * - GitHub: CoreUI Brands by creativeLabs Łukasz Holeczek, CC0 1.0
 * - GitLab: selfh.st/icons, see https://github.com/selfhst/icons/blob/main/LICENSE
 * - Bitbucket: Devicon by konpa, see https://github.com/devicons/devicon/blob/master/LICENSE
 */
export const PROVIDER_ICONS: Record<ProviderId, ProviderIcon> = {
  github: {
    viewBox: "0 0 32 32",
    body: '<path fill="currentColor" d="M16 .396c-8.839 0-16 7.167-16 16c0 7.073 4.584 13.068 10.937 15.183c.803.151 1.093-.344 1.093-.772c0-.38-.009-1.385-.015-2.719c-4.453.964-5.391-2.151-5.391-2.151c-.729-1.844-1.781-2.339-1.781-2.339c-1.448-.989.115-.968.115-.968c1.604.109 2.448 1.645 2.448 1.645c1.427 2.448 3.744 1.74 4.661 1.328c.14-1.031.557-1.74 1.011-2.135c-3.552-.401-7.287-1.776-7.287-7.907c0-1.751.62-3.177 1.645-4.297c-.177-.401-.719-2.031.141-4.235c0 0 1.339-.427 4.4 1.641a15.4 15.4 0 0 1 4-.541c1.36.009 2.719.187 4 .541c3.043-2.068 4.381-1.641 4.381-1.641c.859 2.204.317 3.833.161 4.235c1.015 1.12 1.635 2.547 1.635 4.297c0 6.145-3.74 7.5-7.296 7.891c.556.479 1.077 1.464 1.077 2.959c0 2.14-.02 3.864-.02 4.385c0 .416.28.916 1.104.755c6.4-2.093 10.979-8.093 10.979-15.156c0-8.833-7.161-16-16-16z"/>'
  },
  gitlab: {
    viewBox: "0 0 512 512",
    body:
      '<path fill="#e24329" d="m460.6 354.1l-.3.2l-106.8 79.9l-97.4-73.6l153-115.7c27.8-20.7 59.8-35.1 93.7-42.1L433.1 21c-1.4-3.6-3.9-6.6-7.2-8.6c-8.6-5.5-19.9-3-25.4 5.6c-1 1.5-1.7 3.2-2.2 4.9l-47 144H160.8l-47-144c-2.8-9.8-13-15.5-22.8-12.7c-1.7.5-3.4 1.2-4.9 2.2c-3.2 2-5.8 5.1-7.2 8.6L9.3 202.8c33.9 7 65.9 21.3 93.6 42.1l153 115.8l.1-.1l97.3 73.7l-52.6 39.7l-31.9 24.2c-3.8 2.9-8.4 4.3-12.9 4.3c4.6 0 9.2-1.4 13-4.3l31.9-24.2l52.6-39.7l106.8-79.9l.3-.2c2.5-1.9 4.8-3.8 7.1-5.8c-2.3 2-4.6 3.9-7 5.7"/>' +
      '<path fill="#fca326" d="m158.3 434.3l52.6 39.7l31.9 24.2a21.6 21.6 0 0 0 26 0l31.9-24.2l52.6-39.7l-97.3-73.7z"/>' +
      '<path fill="#fc6d26" d="m460.6 354.1l-.3.2l-106.8 79.9l-97.4-73.6l153-115.7c27.8-20.7 59.8-35.1 93.7-42.1l.7 1.8c20.5 53.9 3.1 114.8-42.9 149.5M9.3 202.8l-.7 1.8C-12 258.5 5.5 319.4 51.5 354.2l.3.2l.6.5l106 79.4l97.5-73.6l-153-115.8c-27.7-20.8-59.7-35.1-93.6-42.1"/>'
  },
  bitbucket: {
    viewBox: "0 0 128 128",
    body:
      '<defs><linearGradient id="SVGlTkM2b2Q" x1="28.593" x2="16.672" y1="14.226" y2="23.532" gradientTransform="scale(4)" gradientUnits="userSpaceOnUse"><stop offset=".176" stop-color="#0052cc"/><stop offset="1" stop-color="#2684ff"/></linearGradient></defs>' +
      '<path fill="#2684ff" d="M19.082 20c-1.918 0-3.355 1.758-3.039 3.516l12.95 79.289c.32 2.078 2.077 3.515 4.155 3.515h62.66c1.442 0 2.72-1.12 3.04-2.558l13.109-80.086c.316-1.918-1.121-3.516-3.039-3.516zM74.07 77.227H54.09l-5.278-28.293h30.215zm0 0"/>' +
      '<path fill="url(#SVGlTkM2b2Q)" d="M107.64 48.934H78.868L74.07 77.227H54.09l-23.5 27.972s1.12.961 2.719.961h62.66c1.441 0 2.719-1.12 3.039-2.558zm0 0"/>'
  }
};

export function providerIconSvg(provider: ProviderId, className = ""): string {
  const cls = className ? ` class="${className}"` : "";
  const icon = PROVIDER_ICONS[provider];
  return `<svg viewBox="${icon.viewBox}" fill="currentColor" aria-hidden="true"${cls}>${icon.body}</svg>`;
}
