// Install link: set this once the Chrome Web Store listing is live.
const INSTALL_URL = "";
document.querySelectorAll("[data-install]").forEach((a) => {
  if (INSTALL_URL) {
    a.href = INSTALL_URL;
    return;
  }
  // Not published yet: say so instead of linking to nowhere.
  a.removeAttribute("href");
  a.classList.add("pending");
  a.setAttribute("aria-disabled", "true");
  a.textContent = "Coming soon to Chrome";
});

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
  const mid = (n) => y(n) + n.offsetHeight / 2;

  const hero = document.querySelector(".hero");
  const connect = document.querySelector("#connect");
  const cta = document.querySelector("#finale-cta");
  const startY = y(hero) + 38;
  // The three branches converge in the lower part of the hero, just before the first step.
  const mergeY = y(connect) - 56;
  const bendY = Math.max(startY + 160, mergeY - 300);
  const endY = mid(cta);
  const tx = w * X[1];
  const endX = w - 2;

  const clipId = "reveal";
  const clip = el("clipPath", { id: clipId });
  clipRect = el("rect", { x: -20, y: 0, width: w + 40, height: reduce ? height : 0 }, clip);

  const paths = KINDS.map((k, i) => {
    const x = w * X[i];
    const m = (bendY + mergeY) / 2;
    return { k, d: `M${x} ${startY} V${bendY} C${x} ${m} ${tx} ${m} ${tx} ${mergeY}` };
  });
  // The trunk runs down to the install button and turns into it.
  paths.push({ k: "trunk", d: `M${tx} ${mergeY} V${endY - 28} Q${tx} ${endY} ${tx + 28} ${endY} H${endX}` });

  for (const p of paths) el("path", { d: p.d, class: "base" });
  const live = el("g", { "clip-path": `url(#${clipId})` });
  for (const p of paths) el("path", { d: p.d, class: `live ${p.k}` }, live);

  const marks = [{ cy: mergeY, text: "merged" }];
  for (const s of document.querySelectorAll("[data-node]")) {
    const h = s.querySelector("h2");
    marks.push({ cy: mid(h), text: s.dataset.node });
  }
  nodes = marks.map(({ cy, text }) => {
    el("circle", { cx: tx, cy, r: 12, class: "ring" });
    const c = el("circle", { cx: tx, cy, r: 9, class: "node" });
    const t = el("text", { x: tx + 18, y: cy + 4, class: "label" });
    t.textContent = text;
    return { c, t, cy };
  });
  // Landing point on the install button.
  const end = { cy: endY };
  end.c = el("circle", { cx: endX, cy: endY, r: 6, class: "node" });
  nodes.push(end);
  update();
}

function update() {
  if (!clipRect) return;
  const top = flow.getBoundingClientRect().top + scrollY;
  const line = scrollY + innerHeight * 0.62 - top;
  if (!reduce) clipRect.setAttribute("height", Math.max(0, Math.min(height, line)));
  for (const n of nodes) {
    const on = reduce || n.cy < line;
    n.c.classList.toggle("on", on);
    n.t?.classList.toggle("on", on);
  }
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
