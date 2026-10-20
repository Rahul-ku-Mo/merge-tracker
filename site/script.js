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
  a.textContent = "Coming soon";
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

/* Tracing beam: a bright head with a fading tail rides the lit line. The gradient's
   y1/y2 follow the scroll position through a critically damped spring, so the beam
   trails the scroll slightly and settles without overshoot. Off under reduced motion. */
const TAIL = 240;
let beam = null;
let beamPos = 0;
let beamVel = 0;
let beamTarget = 0;
let beamRaf = 0;
let beamLast = 0;

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

  beam = null;
  if (!reduce) {
    const defs = el("defs", {});
    beam = el("linearGradient", { id: "beam", gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: 0, y2: 0 }, defs);
    // The last stop fades to 0: gradients pad past their ends, so this keeps everything below the head clear.
    for (const [offset, opacity] of [[0, 0], [0.65, 0.5], [0.96, 1], [1, 0]]) {
      el("stop", { offset, "stop-opacity": opacity, class: "beam-stop" }, beam);
    }
    const beams = el("g", {});
    for (const p of paths) el("path", { d: p.d, class: "beam" }, beams);
  }

  const marks = [{ cy: mergeY, text: "merged" }];
  for (const s of document.querySelectorAll("[data-node]")) {
    const h = s.querySelector("h2");
    marks.push({ cy: mid(h), text: s.dataset.node });
  }
  nodes = marks.map(({ cy, text }) => {
    el("circle", { cx: tx, cy, r: 12, class: "ring" });
    const c = el("circle", { cx: tx, cy, r: 9, class: "node" });
    // Labels sit left of the trunk, right-aligned to the node, so they never touch the headings.
    const t = el("text", { x: tx - 20, y: cy, class: "label", "text-anchor": "end", "dominant-baseline": "central" });
    t.textContent = text;
    return { c, t, cy };
  });
  // Landing point on the install button.
  const end = { cy: endY };
  end.c = el("circle", { cx: endX, cy: endY, r: 6, class: "node" });
  nodes.push(end);
  update();
  // Start the beam at the scroll position instead of springing in from the top.
  beamPos = beamTarget;
  beamVel = 0;
  paintBeam();
}

function paintBeam() {
  if (!beam) return;
  beam.setAttribute("y1", beamPos - TAIL);
  beam.setAttribute("y2", beamPos);
}

function tickBeam(now) {
  const dt = Math.min(0.05, (now - (beamLast || now)) / 1000);
  beamLast = now;
  // Spring: stiffness 120, damping 22 (about critical, no overshoot).
  beamVel += ((beamTarget - beamPos) * 120 - beamVel * 22) * dt;
  beamPos += beamVel * dt;
  paintBeam();
  if (Math.abs(beamTarget - beamPos) > 0.5 || Math.abs(beamVel) > 0.5) {
    beamRaf = requestAnimationFrame(tickBeam);
  } else {
    beamRaf = 0;
    beamLast = 0;
    beamPos = beamTarget;
    paintBeam();
  }
}

function update() {
  if (!clipRect) return;
  const top = flow.getBoundingClientRect().top + scrollY;
  const line = scrollY + innerHeight * 0.62 - top;
  if (!reduce) clipRect.setAttribute("height", Math.max(0, Math.min(height, line)));
  beamTarget = line;
  if (beam && !beamRaf) beamRaf = requestAnimationFrame(tickBeam);
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
