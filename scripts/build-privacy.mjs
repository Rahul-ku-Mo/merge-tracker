/** Renders docs/privacy-policy.md to site/privacy.html (minimal markdown subset). Run: pnpm site:privacy */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(root, "docs/privacy-policy.md"), "utf8").split("\n");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

const out = [];
let list = false;
let para = [];
let table = [];
const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
const flushList = () => { if (list) out.push("</ul>"); list = false; };
const flushTable = () => {
  if (!table.length) return;
  const rows = table.filter((r) => !/^\|[-| ]+\|$/.test(r)).map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));
  const [head, ...body] = rows;
  out.push('<div class="scroll"><table><thead><tr>' + head.map((c) => `<th scope="col">${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
    body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
  table = [];
};

for (const line of md) {
  if (line.startsWith("|")) { flushPara(); flushList(); table.push(line); continue; }
  flushTable();
  const h = line.match(/^(#{1,3}) (.*)/);
  if (h) { flushPara(); flushList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
  if (/^- /.test(line)) { flushPara(); if (!list) out.push("<ul>"); list = true; out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
  if (/^\s+\S/.test(line) && list) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`); continue; }
  if (!line.trim()) { flushPara(); flushList(); continue; }
  para.push(line.trim());
}
flushPara(); flushList(); flushTable();

const title = md[0].replace(/^# /, "");
writeFileSync(join(root, "site/privacy.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="icon" href="assets/favicon.png">
  <link rel="stylesheet" href="styles.css">
  <style>
    .doc { max-width: 760px; margin: 0 auto; padding: 56px clamp(16px, 4vw, 32px) 96px; }
    .doc h1 { font-size: clamp(32px, 5vw, 44px); margin-bottom: 8px; }
    .doc h2 { margin: 48px 0 12px; font-size: 24px; letter-spacing: -0.02em; }
    .doc p, .doc li { font-size: 17px; }
    .doc ul { padding-left: 22px; }
    .doc code { padding: 1px 6px; border-radius: 4px; background: hsl(var(--fg) / .08); font-size: .9em; }
    .doc .scroll { overflow-x: auto; }
    .doc table { width: 100%; border-collapse: collapse; font-size: 15px; }
    .doc th, .doc td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid hsl(var(--line)); }
  </style>
</head>
<body>
  <header class="bar">
    <a class="brand" href="index.html"><img src="assets/icon.png" alt="" width="32" height="32"><span>Merge Requests Tracker (MR)</span></a>
    <a class="link" href="index.html">Back to home</a>
  </header>
  <main class="doc">
${out.join("\n")}
  </main>
</body>
</html>
`);
console.log("site/privacy.html");
