/**
 * Renders the Chrome Web Store images from store-assets/scenes/*.html using
 * headless Chrome, then converts to JPEG (the store rejects alpha channels).
 * macOS: converts with `sips`. Run: pnpm store:assets
 */
import { createServer } from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "store-assets/out");
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

const JOBS = [
  ["screenshot-1-one-list", "shot1", 1280, 800],
  ["screenshot-2-notifications", "shot2", 1280, 800],
  ["screenshot-3-connect", "shot3", 1280, 800],
  ["screenshot-4-filters", "shot4", 1280, 800],
  ["screenshot-5-private", "shot5", 1280, 800],
  ["promo-small-440x280", "tile-small", 440, 280],
  ["promo-marquee-1400x560", "tile-marquee", 1400, 560]
];

mkdirSync(out, { recursive: true });
const server = createServer((req, res) => {
  const file = join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(0);
await new Promise((r) => server.once("listening", r));
const port = server.address().port;

for (const [name, scene, w, h] of JOBS) {
  const png = join(out, `${name}.png`);
  await run(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${w},${h}`, "--virtual-time-budget=6000", `--screenshot=${png}`,
    `http://localhost:${port}/store-assets/scenes/${scene}.html`
  ]);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "95", png, "--out", join(out, `${name}.jpg`)], { stdio: "ignore" });
  rmSync(png);
  console.log(`${name}.jpg  ${w}x${h}`);
}
server.close();
