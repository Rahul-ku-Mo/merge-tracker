/**
 * Renders the extension's toolbar/store icons (icons/icon{16,48,128}.png)
 * from the Lucide git-merge glyph on a rounded brand-blue tile.
 *
 * Run: pnpm icons
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "icons");
mkdirSync(outDir, { recursive: true });

const lucide = JSON.parse(
  readFileSync(join(root, "node_modules/@iconify-json/lucide/icons.json"), "utf8")
);
const glyph = lucide.icons["git-merge"].body;

// Brand blue (hsl 212 92% 42%) with a white glyph; glyph scaled to 60% of the tile.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0965ce"/>
  <g transform="translate(25.6 25.6) scale(3.2)" color="#fff">${glyph}</g>
</svg>`;

for (const size of [16, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(join(outDir, `icon${size}.png`), png);
  console.log(`icons/icon${size}.png`);
}
