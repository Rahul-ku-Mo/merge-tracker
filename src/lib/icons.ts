import { ICON_BODIES, type IconName } from "./icons.generated";

export type { IconName };

/** Inline SVG markup for a Lucide icon (stroke follows currentColor). */
export function iconSvg(name: IconName, size = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_BODIES[name]}</svg>`;
}

/**
 * Fill every `<span data-icon="name" data-size="16">` placeholder in `root`
 * with its SVG. Keeps the HTML free of path data.
 */
export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
    const name = el.dataset.icon as IconName;
    if (name in ICON_BODIES) el.innerHTML = iconSvg(name, Number(el.dataset.size) || 16);
  });
}
