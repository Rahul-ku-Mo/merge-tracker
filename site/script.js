// Install link: set this once the Chrome Web Store listing is live.
const INSTALL_URL = "";
if (INSTALL_URL) document.querySelectorAll("[data-install]").forEach((a) => (a.href = INSTALL_URL));

/* Branch graph: three provider branches run down the left and merge into one
   trunk at the "connect" step; the trunk carries a commit node per section and
   ends at the install button. Lines fill in as you scroll. */
const NS = "http://www.w3.org/2000/svg";
const flow = document.querySelector(".flow");
const svg = document.querySelector(".graph");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const X = [0.18, 0.5, 0.82];
const KINDS = ["gh", "gl", "bb"];

let clipRect;
let nodes = [];
let height = 0;

const el = (name, attrs, parent = svg) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.appendChild(n);
  return n;
};

function build() {
  svg.replaceChildren();
  const w = svg.getBoundingClientRect().width;
  const top = flow.getBoundingClientRect().top + scrollY;
  height = flow.offsetHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${height}`);
  const y = (n) => n.getBoundingClientRect().top + scrollY - top;

  const hero = document.querySelector(".hero");
  const merge = document.querySelector('[data-node="merge"]');
  const end = document.querySelector('[data-node="end"]');
  const startY = y(hero) + 38;
  const heading = (s) => {
    const h = s.querySelector("h1, h2");
    return y(h) + h.offsetHeight / 2;
  };
  const mergeY = heading(merge);
  const bendY = Math.max(startY + 200, mergeY - 190);
  const endY = heading(end);
  const tx = w * X[1];

  const clipId = "reveal";
  const clip = el("clipPath", { id: clipId });
  clipRect = el("rect", { x: -20, y: 0, width: w + 40, height: reduce ? height : 0 }, clip);

  const paths = KINDS.map((k, i) => {
    const x = w * X[i];
    const mid = (bendY + mergeY) / 2;
    return { k, d: `M${x} ${startY} V${bendY} C${x} ${mid} ${tx} ${mid} ${tx} ${mergeY}` };
  });
  paths.push({ k: "trunk", d: `M${tx} ${mergeY} V${endY}` });

  for (const p of paths) el("path", { d: p.d, class: "base" });
  const live = el("g", { "clip-path": `url(#${clipId})` });
  for (const p of paths) el("path", { d: p.d, class: `live ${p.k}` }, live);

  nodes = [...document.querySelectorAll("[data-node]")].map((s) => {
    const cy = heading(s);
    el("circle", { cx: tx, cy, r: 11, class: "ring" });
    return { c: el("circle", { cx: tx, cy, r: 8, class: "node" }), cy };
  });
  update();
}

function update() {
  if (!clipRect) return;
  const top = flow.getBoundingClientRect().top + scrollY;
  const line = scrollY + innerHeight * 0.62 - top;
  if (!reduce) clipRect.setAttribute("height", Math.max(0, Math.min(height, line)));
  for (const n of nodes) n.c.classList.toggle("on", reduce || n.cy < line);
}

let raf = 0;
addEventListener("scroll", () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
}, { passive: true });
addEventListener("resize", build);
addEventListener("load", build);
build();
new ResizeObserver(build).observe(flow);
