import { useEffect, useRef } from "react";
import { mount, reachableVertexIds, nearestVertex, LAUNCH_AGILE } from "@banjobyster/bysters";
import { Graphics } from "pixi.js";
import { CAST } from "../bysters/cast";

// Mounts the society on the real page. Purely additive and degradable: under
// prefers-reduced-motion or without WebGL, mount() returns a no-op handle and
// the DOM site is untouched. This is the only site file that imports the
// framework runtime.
//
// Humans are actors too: any click (or Enter/Space) on a [data-fixture]
// element funnels through the SAME store.transition the bysters use, so a
// visitor cutting a wire creates real work for the engineer.
//
// Consumer-drawn extras live in onFrame: a tinted work-cable from a byster to
// the fixture it is operating, and, under ?debug, the nav graph (green
// reachable / red stranded / faint jump arcs) plus window.__society for
// headless verification.

const CABLE_COLOR = {
  kip: 0xf08c3c,
  pip: 0x4fb39a,
  chunk: 0xe0a83c,
  otto: 0x56d989,
  nib: 0xe8b64a,
};

// The work cable creeps OUT of the byster toward the fixture (rather than
// popping in fully formed), so plugging in reads as an act. Progress is
// per-byster and eases back to zero on unplug.
const plugT = new Map();

function drawCables(gCable, { cast, store }) {
  if (!store) return;
  gCable.clear();
  for (const m of cast) {
    const act = m.byster && m.byster.actuator;
    const plugged = act && act.plugged && act.fixtureId != null;
    const t0 = plugT.get(m.name) || 0;
    const t = Math.max(0, Math.min(1, t0 + (plugged ? 0.022 : -0.08)));
    plugT.set(m.name, t);
    if (t <= 0 || !act || act.fixtureId == null) continue;
    const fx = store.fixture(act.fixtureId);
    if (!fx) continue;
    const cx = m.mover.x;
    const cy = m.mover.bodyY;
    const mx = (cx + fx.x) / 2;
    const my = Math.max(cy, fx.y) + 14;
    const color = CABLE_COLOR[m.name] || 0xffffff;
    // draw the quadratic arc only up to parameter t
    gCable.moveTo(cx, cy);
    const STEPS = 16;
    let ex = cx;
    let ey = cy;
    for (let i = 1; i <= STEPS; i++) {
      const u = (t * i) / STEPS;
      const a = 1 - u;
      ex = a * a * cx + 2 * a * u * mx + u * u * fx.x;
      ey = a * a * cy + 2 * a * u * my + u * u * fx.y;
      gCable.lineTo(ex, ey);
    }
    gCable.stroke({ width: 2, color, alpha: 0.8 });
    // the free end: a small connector nub while traveling, seated when t=1
    gCable.circle(ex, ey, t >= 1 ? 3 : 2).fill({ color, alpha: 0.9 });
  }
}

// The system log: translate the fixture store's audit log into the page's
// own voice. All meaning (verbs, names) lives here, not in the framework.
const FX_LABEL = (fx) =>
  fx.type === "port" ? "PRJ " + (fx.id.split("-")[1] || "??") + " PORT"
  : fx.type === "intake" ? "INTAKE"
  : fx.type === "pipeline" ? "PIPELINE"
  : fx.type === "archive" ? "ARCHIVE"
  : fx.type === "neon" ? "NEON SIGN"
  : fx.type.toUpperCase();
const VERB = {
  cut: "POPPED", linked: "RESEATED",
  jammed: "JAMMED", flowing: "RESTORED",
  closed: "SHUT", open: "REOPENED",
  off: "DOUSED", on: "RELIT",
  offline: "KNOCKED OUT", syncing: "RESYNCED",
};
let sysLogSeen = -1;

function drawSysLog(store) {
  if (!store || store.log.length === sysLogSeen) return;
  sysLogSeen = store.log.length;
  const slots = document.querySelectorAll("#sys-log .sysLine");
  if (!slots.length) return;
  const tail = store.log.slice(-slots.length);
  slots.forEach((el, i) => {
    const l = tail[i];
    if (!l) return;
    const fx = store.fixture(l.id);
    const who = l.by ? l.by.toUpperCase() : "YOU";
    el.textContent = `${who} ${VERB[l.to] || l.to.toUpperCase()} ${fx ? FX_LABEL(fx) : l.id}`;
    el.dataset.tone = l.by == null ? "you" : l.by;
  });
}

function drawDebug(gDebug, { graph, cast }) {
  if (!graph) return;
  gDebug.clear();
  const seeds = [];
  for (const m of cast) {
    const v = nearestVertex(graph, m.mover.x, m.mover.bodyY);
    if (v) seeds.push(v.id);
  }
  const reach = reachableVertexIds(graph, seeds, LAUNCH_AGILE);
  for (const [aId, edges] of graph.adj) {
    const a = graph.vertices[aId];
    for (const e of edges) {
      if (e.type !== "jump") continue;
      const L = e.launch;
      gDebug.moveTo(a.x, a.y);
      for (let i = 1; i <= 12; i++) {
        const t = (L.t * i) / 12;
        gDebug.lineTo(a.x + L.vx * t, a.y + L.vy * t + 0.5 * L.g * t * t);
      }
      gDebug.stroke({ width: 1, color: 0xe0a83c, alpha: 0.22 });
    }
  }
  for (let si = 0; si < graph.surfaces.length; si++) {
    const s = graph.surfaces[si];
    const ok = graph.vertices.some((v) => v.surface === si && reach.has(v.id));
    gDebug.moveTo(s.a.x, s.a.y).lineTo(s.b.x, s.b.y).stroke({ width: 3, color: ok ? 0x3ddc97 : 0xff5d5d, alpha: 0.9 });
  }
  for (const v of graph.vertices) {
    gDebug.circle(v.x, v.y, 2).fill({ color: reach.has(v.id) ? 0x3ddc97 : 0xff5d5d, alpha: 0.7 });
  }
}

// A human toggling a device: cycle to the next declared state the fixture's
// own machine allows. No interpretation here; the CSS decides what it means.
function humanToggle(handle, el) {
  const store = handle.store;
  const id = el.dataset.fixtureId;
  if (!store || !id) return;
  const fx = store.fixture(id);
  const states = (el.dataset.states || "").split(/\s+/).filter(Boolean);
  if (!fx || states.length < 2) return;
  const at = states.indexOf(fx.state);
  for (let k = 1; k <= states.length; k++) {
    const next = states[(at + k) % states.length];
    if (next !== fx.state && store.transition(id, next, null)) return;
  }
}

export default function BystersOverlay({ dataReady }) {
  const handleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let handle = null;
    const debugOn =
      typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");
    let gCable = null;
    let gDebug = null;

    mount({
      bysters: CAST,
      terrain: "[data-walk]",
      fixtures: "[data-fixture]",
      ground: false,
      shadow: false,
      debug: debugOn,
      onFrame: (f) => {
        // The feed cascade: while the intake is closed the whole machine
        // browns out. One root cause, mirrored to html[data-feed] so CSS can
        // starve everything downstream. Store-driven, so byster and human
        // closures behave identically; checked per frame because rebuilds
        // replace the store.
        const intake = f.store && f.store.all().find((x) => x.type === "intake");
        const down = !!intake && intake.state === "closed";
        const root = document.documentElement;
        if (down !== (root.dataset.feed === "down")) {
          if (down) root.dataset.feed = "down";
          else delete root.dataset.feed;
        }
        if (!gCable) {
          gCable = new Graphics();
          f.app.stage.addChildAt(gCable, 0);
        }
        drawCables(gCable, f);
        drawSysLog(f.store);
        if (debugOn) {
          if (!gDebug) {
            gDebug = new Graphics();
            f.app.stage.addChild(gDebug);
          }
          drawDebug(gDebug, f);
        }
      },
    }).then((h) => {
      if (!alive) {
        h.unmount && h.unmount();
        return;
      }
      handle = h;
      handleRef.current = h;
      if (typeof window !== "undefined") {
        window.__society = h;
        window.__nav = { reachableVertexIds, nearestVertex };
      }
    });

    const onClick = (e) => {
      const el = e.target.closest && e.target.closest("[data-fixture]");
      if (el && handleRef.current && !handleRef.current.degraded) humanToggle(handleRef.current, el);
    };
    const onKey = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = e.target.closest && e.target.closest("[data-fixture]");
      if (el && handleRef.current && !handleRef.current.degraded) {
        e.preventDefault();
        humanToggle(handleRef.current, el);
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      alive = false;
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      if (handle) handle.unmount();
      handleRef.current = null;
      if (typeof window !== "undefined" && window.__society === handle) {
        delete window.__society;
      }
    };
  }, []);

  // Live project data swaps the FALLBACK cards for the fetched set, which
  // changes the terrain; rebuild so the cast re-seats on the real layout.
  useEffect(() => {
    const h = handleRef.current;
    if (h && !h.degraded) h.rebuild();
  }, [dataReady]);

  return null;
}
