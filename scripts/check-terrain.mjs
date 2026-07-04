// M1 level-design proof (SPEC 4.2c): feeds real DOM rects of every
// [data-terrain] element, captured from the rendered site at a given
// viewport size, into the robot's own terrain compiler and checks that the
// page ground (viewport bottom edge) plus the visible platforms form a
// connected graph at every scroll position.
//
// Usage: node scripts/check-terrain.mjs capture1.json [capture2.json ...]
// Capture shape: { label, viewport: {w, h}, docHeight, rects: [{tag, x, y, w, h}] }
// (x/y in document coordinates, y = top edge)
//
// Capture snippet, run in the browser console at the viewport under test:
//   copy(JSON.stringify({ label: 'desktop', viewport: { w: innerWidth, h: innerHeight },
//     docHeight: document.documentElement.scrollHeight,
//     rects: [...document.querySelectorAll('[data-terrain]')].map((el) => {
//       const r = el.getBoundingClientRect();
//       return { tag: el.dataset.terrain, x: r.x, y: r.top + scrollY, w: r.width, h: r.height };
//     }) }))
//
// Exits 1 if any visible platform is ever unreachable from the ground.

import { readFileSync } from "node:fs";
import { compileTerrain } from "../bysters/core/path/terrain.js";

const SCROLL_STEP = 60;

function bfs(graph, startSeg) {
  const startNodes = graph.nodes.filter((n) => n.seg === startSeg);
  const seen = new Set(startNodes.map((n) => n.id));
  const queue = [...startNodes.map((n) => n.id)];
  while (queue.length) {
    const id = queue.shift();
    for (const e of graph.adj.get(id) || []) {
      if (!seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    }
  }
  const segs = new Set();
  for (const n of graph.nodes) if (seen.has(n.id)) segs.add(n.seg);
  return segs;
}

function checkCapture(cap) {
  const { label, viewport, docHeight, rects } = cap;
  const vh = viewport.h;
  const maxScroll = Math.max(0, docHeight - vh);
  const failures = new Map(); // element key -> [scroll positions]
  let checks = 0;

  for (let s = 0; s <= maxScroll; s += SCROLL_STEP) {
    // A platform is usable when its walkable top edge is on screen.
    const visible = rects.filter((r) => r.y >= s && r.y <= s + vh - 6);
    if (!visible.length) continue;
    const ground = {
      tag: "ground",
      x: -200,
      y: s + vh,
      w: viewport.w + 400,
      h: 40,
    };
    const all = [...visible, ground];
    const graph = compileTerrain(all);
    const reachable = bfs(graph, all.length - 1);
    checks += visible.length;
    visible.forEach((r, i) => {
      if (!reachable.has(i)) {
        const key = `${r.tag} @ (${Math.round(r.x)},${Math.round(r.y)}) ${Math.round(r.w)}x${Math.round(r.h)}`;
        if (!failures.has(key)) failures.set(key, []);
        failures.get(key).push(s);
      }
    });
  }

  console.log(`\n=== ${label} (${viewport.w}x${viewport.h}, doc ${docHeight}px, ${rects.length} platforms) ===`);
  console.log(`${checks} visibility checks across ${Math.floor(maxScroll / SCROLL_STEP) + 1} scroll positions`);
  if (!failures.size) {
    console.log("PASS: every visible platform reachable from the ground at every scroll position");
    return true;
  }
  console.log(`FAIL: ${failures.size} platform(s) unreachable at some positions:`);
  for (const [key, positions] of failures) {
    const head = positions.slice(0, 6).join(", ");
    console.log(`  - ${key}: unreachable at scrollY ${head}${positions.length > 6 ? ` (+${positions.length - 6} more)` : ""}`);
  }
  return false;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node scripts/check-terrain.mjs <capture.json> [...]");
  process.exit(2);
}

let ok = true;
for (const f of files) {
  const cap = JSON.parse(readFileSync(f, "utf8"));
  if (!checkCapture(cap)) ok = false;
}
process.exit(ok ? 0 : 1);
