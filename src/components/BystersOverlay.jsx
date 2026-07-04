import { useEffect, useRef } from "react";
import { mount, reachableVertexIds, nearestVertex, LAUNCH_AGILE } from "@banjobyster/bysters";
import { Graphics } from "pixi.js";
import { CAST } from "../society/cast";
import "../society/actuators.css";
import "../society/world.css";

// Mounts the society on the real page. Purely additive and degradable: under
// prefers-reduced-motion or without WebGL, mount() returns a no-op handle and
// the DOM site is untouched. This is the only site file that imports the
// framework runtime.
//
// Consumer-drawn extras live in onFrame (the framework only reports state, the
// look is ours): a tinted cable from a plugged byster to the device it is
// operating, and, under ?debug, the nav graph each byster reasons over (green
// reachable / red stranded / faint jump arcs) plus window.__society for headless
// verification.

const CABLE_COLOR = {
  pip: 0x2fc064,
  sarge: 0xe6ac45,
  byte: 0xea8058,
  winnow: 0x8fded0,
};

function drawCables(gCable, { cast, store }) {
  if (!store) return;
  gCable.clear();
  for (const m of cast) {
    const act = m.byster && m.byster.actuator;
    if (!act || !act.plugged || act.fixtureId == null) continue;
    const fx = store.fixture(act.fixtureId);
    if (!fx) continue;
    const cx = m.mover.x;
    const cy = m.mover.bodyY;
    const mx = (cx + fx.x) / 2;
    const my = Math.max(cy, fx.y) + 14;
    const color = CABLE_COLOR[m.name] || 0xffffff;
    gCable.moveTo(cx, cy);
    gCable.quadraticCurveTo(mx, my, fx.x, fx.y);
    gCable.stroke({ width: 2, color, alpha: 0.8 });
    gCable.circle(fx.x, fx.y, 3).fill({ color, alpha: 0.9 });
  }
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
        if (!gCable) {
          gCable = new Graphics();
          f.app.stage.addChildAt(gCable, 0);
        }
        drawCables(gCable, f);
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
        // Verification affordances: the nav helpers so a headless harness can
        // BFS per-byster reachability (prove each byster reaches its devices and
        // stays inside its region).
        window.__nav = { reachableVertexIds, nearestVertex };
      }
    });

    return () => {
      alive = false;
      if (handle) handle.unmount();
      handleRef.current = null;
      if (typeof window !== "undefined" && window.__society === handle) {
        delete window.__society;
      }
    };
  }, []);

  // The live project data swaps FALLBACK cards for the fetched set once it
  // resolves, which changes the terrain; rebuild so the cast re-seats on the
  // real layout. (mount()'s ResizeObserver also catches this; belt and braces.)
  useEffect(() => {
    const h = handleRef.current;
    if (h && !h.degraded) h.rebuild();
  }, [dataReady]);

  return null;
}
