// bysters cast sandbox (Phase 2 / M-cast). Two bysters share one world and one
// nav graph but carry their own look, launch power, and mind:
//   hero - the heavy CRT toddler. Slow, base launch power. It chases the imp,
//          wanders when it loses it, watches the cursor, and obeys a click.
//   imp  - the nimble glitch imp. Fast, agile launch power. It flees the hero,
//          taking wide leaps and tall climbs the hero simply cannot follow.
//
// Nothing here coordinates them: the chase, the flee, and the fixture rivalry
// live entirely in each byster's own behavior list, reacting to the other and to
// the world through world.bysters / world.fixtures (TDD Section 8.4). Adding a
// byster is one more entry in CAST and edits no one else.
//
// Fixtures (Phase 3): the "device" boxes are value-neutral data-fixture elements
// with opaque states (fixed / broken). The hero runs operateFixtures to drive
// them to `fixed`, the imp runs the SAME behavior mirrored to drive them to
// `broken`. There is no good/bad in the framework: the whole story is those two
// configs plus the CSS that paints `broken` red. Swap the two `drive` values and
// the roles swap with no other change.

import { Graphics } from 'pixi.js';
import { createOverlay } from 'bysters/render/pixi/overlay.js';
import { RobotRenderer } from 'bysters/render/pixi/robot-renderer.js';
import { DocumentSpace } from 'bysters/dom/space.js';
import { collectWorld, collectFixtures } from 'bysters/dom/collect.js';
import { compileSurfaceGraph } from 'bysters/core/path/compile.js';
import { reachableVertexIds, nearestVertex, LAUNCH, LAUNCH_AGILE } from 'bysters/core/path/graph.js';
import { arcSamples } from 'bysters/core/path/ballistic.js';
import { qbez } from 'bysters/core/math.js';
import { SurfaceMover } from 'bysters/core/surface-mover.js';
import { Byster } from 'bysters/core/behavior/byster.js';
import { Stage } from 'bysters/core/behavior/stage.js';
import { commanded, wander, watchCursor, watchNearest, approach, flee, operateFixtures } from 'bysters/core/behavior/library.js';
import { makeFixture } from 'bysters/core/fixtures/fixture.js';
import { createFixtureStore } from 'bysters/core/fixtures/store.js';
import { CRT_TODDLER } from '../robot/characters/crt-toddler.js';
import { GLITCH_IMP } from '../robot/characters/glitch-imp.js';
import './main.css';

const SIDE_COLOR = { top: 0x3ddc97, bottom: 0xe0a83c, left: 0x4c9be8, right: 0xb069e8 };

// The cast. Each entry is a self-contained byster spec: a look (character), a
// launch power (caps), a spot to spawn on the ground (a fraction along it), and
// a mind (a composed list of behaviors). Every rivalry is emergent and mirrored:
// the imp's flee names the hero while the hero's approach names the imp; the imp
// drives fixtures to `broken` while the hero drives the same ones to `fixed`.
// Priority orders each mind: commanded > flee/approach > operateFixtures > gaze > wander.
const CAST = [
  {
    name: 'hero',
    character: CRT_TODDLER,
    caps: LAUNCH, // heavy: the base launch contract
    spawnAt: 0.32,
    behaviors: () => [
      commanded(),
      // small notice: the chase is a proximity flare when they cross paths, not a
      // constant pursuit, so it does not starve the fixture work below it.
      approach((v) => v.name === 'imp', { notice: 150 }),
      operateFixtures({ match: (fx) => fx.state === 'broken', drive: 'fixed' }), // repairs
      wander(),
      watchCursor(),
    ],
  },
  {
    name: 'imp',
    character: GLITCH_IMP,
    caps: LAUNCH_AGILE, // nimble: leaps wide gaps and scales walls the hero cannot
    spawnAt: 0.62,
    behaviors: () => [
      flee((v) => v.name === 'hero', { radius: 130 }), // bolts only when the hero is right on top of it
      operateFixtures({ match: (fx) => fx.state !== 'broken', drive: 'broken' }), // sabotages
      wander(),
      watchNearest(),
    ],
  },
];

async function main() {
  const app = await createOverlay();
  const gGraph = new Graphics();
  const gRoute = new Graphics();
  const gFx = new Graphics(); // adhesion glow, under the bysters
  const gPlug = new Graphics(); // actuate cable, under the bysters
  app.stage.addChild(gGraph, gRoute, gFx, gPlug);

  const space = new DocumentSpace();
  let graph = null;
  // The launch power the reachability overlay is drawn for. This is a VIEW
  // control only: it recolors which surfaces a byster of this power could reach.
  // The bysters themselves ignore it and use the caps in their CAST spec.
  let vizCaps = LAUNCH_AGILE;
  let staticDirty = true;
  let cursor = null; // world-space cursor for gaze

  // One mover + one renderer per cast member, built once: they hold the heavy
  // Pixi body and the stateful motor. The mind (Byster) and the Stage are cheap
  // and get rebuilt whenever the terrain changes.
  const members = CAST.map((def) => ({
    def,
    mover: new SurfaceMover(def.character),
    renderer: new RobotRenderer(app.stage, def.character),
    byster: null,
  }));
  let stage = null;

  const el = (id) => document.querySelector('#' + id);
  const groundSeeds = () =>
    graph.vertices.filter((v) => graph.surfaces[v.surface].meta && graph.surfaces[v.surface].meta.ground).map((v) => v.id);
  const groundSurfaceIx = () => graph.surfaces.findIndex((s) => s.meta && s.meta.ground);

  // A spot to spawn a byster: the connected (edge-bearing) ground vertex nearest
  // to `frac` across the ground's walkable x-range, returned as an along-coord.
  // Spawning on a real graph vertex (never an occluded span under a box) keeps
  // placement robust to viewport width, where the box positions are fixed px but
  // the ground scales.
  const spawnAlong = (gi, frac) => {
    const s = graph.surfaces[gi];
    const gv = graph.vertices
      .filter((v) => v.surface === gi && (graph.adj.get(v.id) || []).length > 0)
      .sort((a, b) => a.x - b.x);
    if (!gv.length) return s.length * frac;
    const targetX = gv[0].x + (gv[gv.length - 1].x - gv[0].x) * frac;
    let best = gv[0];
    for (const v of gv) if (Math.abs(v.x - targetX) < Math.abs(best.x - targetX)) best = v;
    return s.length * best.t;
  };

  const rebuild = () => {
    const { surfaces, solids } = collectWorld(space, { source: '[data-walk]' });
    graph = compileSurfaceGraph(surfaces, solids, LAUNCH_AGILE);

    // Value-neutral fixtures from the DOM. The store is the truth; we mirror each
    // state onto the element's data-state so the CONSUMER css (green = fixed, red
    // = broken) paints it. All meaning lives in that css, never in the framework.
    const store = createFixtureStore(collectFixtures(space, { source: '[data-fixture]' }).map(makeFixture));
    const paint = (fx) => {
      if (fx.el) fx.el.dataset.state = fx.state;
    };
    for (const fx of store.all()) paint(fx);
    store.subscribe((fx) => paint(fx));

    stage = new Stage(graph, { store });
    const gi = groundSurfaceIx();
    for (const m of members) {
      m.mover.spawn(graph, gi, spawnAlong(gi, m.def.spawnAt), m.def.caps);
      m.byster = new Byster(m.def.name, m.mover, m.def.behaviors());
      stage.add(m.byster);
    }
    staticDirty = true;
    window.__bysters = {
      graph: () => graph,
      space,
      stage,
      store,
      rebuild,
      surfaces,
      solids,
      cast: members,
      byName: (name) => members.find((m) => m.def.name === name) || null,
      step: (dt = 1 / 60) => {
        stage.setCursor(cursor);
        stage.step(dt);
      },
    };
  };
  rebuild();

  let rebuildTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 150);
  });

  window.addEventListener('pointermove', (e) => {
    const snap = space.read();
    cursor = { x: e.clientX + snap.scrollX, y: e.clientY + snap.scrollY };
  });

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.panel')) return;
    const snap = space.read();
    const v = nearestVertex(graph, e.clientX + snap.scrollX, e.clientY + snap.scrollY);
    if (!v) return;
    // Command the hero (the first cast member). A command is just a
    // high-priority behavior, so the click flows through the same arbiter as
    // the chase and the wander; it wins locomotion until the hero arrives.
    members[0].byster.command(v.id);
    el('state').textContent = `hero commanded to surface ${v.surface} (${graph.surfaces[v.surface].side})`;
    staticDirty = true;
  });

  const setVizCaps = (c, onId, offId) => {
    vizCaps = c;
    el(onId).classList.add('on');
    el(offId).classList.remove('on');
    staticDirty = true;
  };
  el('capsBase').addEventListener('click', () => setVizCaps(LAUNCH, 'capsBase', 'capsAgile'));
  el('capsAgile').addEventListener('click', () => setVizCaps(LAUNCH_AGILE, 'capsAgile', 'capsBase'));
  el('rebuildBtn').addEventListener('click', rebuild);
  el('graph').addEventListener('change', () => {
    staticDirty = true;
  });
  el('jumps').addEventListener('change', () => {
    staticDirty = true;
  });

  const redrawGraph = () => {
    gGraph.clear();
    if (!graph || !el('graph').checked) return;
    const reach = reachableVertexIds(graph, groundSeeds(), vizCaps);
    const reachable = (v) => reach.has(v.id);
    if (el('jumps').checked) {
      for (const [aId, edges] of graph.adj) {
        const a = graph.vertices[aId];
        for (const e of edges) {
          if (e.type !== 'jump') continue;
          const pts = arcSamples(a, e.launch, e.launch.g, e.launch.t, 12);
          gGraph.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) gGraph.lineTo(pts[i].x, pts[i].y);
          gGraph.stroke({ width: 1, color: 0xe0a83c, alpha: 0.16 });
        }
      }
    }
    for (let si = 0; si < graph.surfaces.length; si++) {
      const s = graph.surfaces[si];
      const verts = graph.vertices.filter((v) => v.surface === si);
      const ok = verts.some(reachable);
      const base = SIDE_COLOR[s.side] || 0x3ddc97;
      gGraph.moveTo(s.a.x, s.a.y).lineTo(s.b.x, s.b.y).stroke({ width: 3, color: ok ? base : 0xff5d5d, alpha: 0.85 });
      const mx = (s.a.x + s.b.x) / 2;
      const my = (s.a.y + s.b.y) / 2;
      gGraph.moveTo(mx, my).lineTo(mx + s.normal.x * 9, my + s.normal.y * 9).stroke({ width: 1.5, color: ok ? base : 0xff5d5d, alpha: 0.55 });
    }
    for (const v of graph.vertices) {
      gGraph.circle(v.x, v.y, 2).fill({ color: reachable(v) ? 0x3ddc97 : 0xff5d5d, alpha: 0.6 });
    }
  };

  // Each byster's remaining route, drawn every frame (cheap: a few segments) so
  // both chases stay in sync as they consume steps.
  const redrawRoute = () => {
    gRoute.clear();
    for (const m of members) {
      const route = m.mover.route;
      if (!route) continue;
      for (let i = m.mover.stepIx; i < route.length; i++) {
        const step = route[i];
        if (step.type === 'walk') {
          gRoute.moveTo(step.from.x, step.from.y).lineTo(step.to.x, step.to.y).stroke({ width: 2.5, color: 0xffffff, alpha: 0.55 });
        } else {
          const pts = arcSamples(step.from, step.launch, step.launch.g, step.launch.t, 16);
          gRoute.moveTo(pts[0].x, pts[0].y);
          for (let j = 1; j < pts.length; j++) gRoute.lineTo(pts[j].x, pts[j].y);
          gRoute.stroke({ width: 2, color: 0xffe08a, alpha: 0.6 });
        }
      }
    }
  };

  // Adhesion flourish, per byster: on a wall or underside, a soft glow from the
  // contact point toward the body, "attracted to the surface". Pure
  // presentation, driven by each mover's contact + normal, so the locomotion
  // logic stays angle-agnostic. Zero on the floor.
  const drawAdhesion = () => {
    gFx.clear();
    for (const m of members) {
      const mover = m.mover;
      const strength = 1 - Math.max(-mover.normal.y, 0); // 0 floor, 1 wall/underside
      if (strength < 0.05) continue;
      const c = mover.contact;
      gFx.circle(c.x, c.y, 7).fill({ color: 0x8be9fd, alpha: 0.14 * strength });
      gFx.moveTo(c.x, c.y).lineTo(mover.x, mover.bodyY).stroke({ width: 3, color: 0x8be9fd, alpha: 0.28 * strength });
    }
  };

  // The actuate cable: while a byster is wired into a fixture (its actuator is
  // plugged), draw a sagging cable from its chest to the fixture, tinted by which
  // byster (green hero, red imp). Pure presentation off the byster's actuator +
  // the store position, so the handshake logic stays render-agnostic.
  const drawPlugs = () => {
    gPlug.clear();
    if (!stage.store) return;
    for (const m of members) {
      const act = m.byster && m.byster.actuator;
      if (!act || !act.plugged || act.fixtureId == null) continue;
      const fx = stage.store.fixture(act.fixtureId);
      if (!fx) continue;
      const cx = m.mover.x;
      const cy = m.mover.bodyY;
      const mx = (cx + fx.x) / 2;
      const my = Math.max(cy, fx.y) + 14; // sag
      const color = m.def.name === 'hero' ? 0x3ddc97 : 0xff5d5d;
      gPlug.moveTo(cx, cy);
      for (let i = 1; i <= 16; i++) {
        const tt = i / 16;
        gPlug.lineTo(qbez(cx, mx, fx.x, tt), qbez(cy, my, fx.y, tt));
      }
      gPlug.stroke({ width: 2, color, alpha: 0.9 });
      gPlug.circle(fx.x, fx.y, 3).fill({ color, alpha: 0.9 });
    }
  };

  app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS / 1000, 0.05);
    stage.setCursor(cursor);
    stage.step(dt); // one world snapshot; every byster senses + arbitrates + drives its mover
    drawAdhesion();
    drawPlugs();
    for (const m of members) m.renderer.draw(m.mover, dt);
    if (staticDirty) {
      redrawGraph();
      staticDirty = false;
    }
    redrawRoute();
    const broken = stage.store ? stage.store.all().filter((fx) => fx.state === 'broken').length : 0;
    const total = stage.store ? stage.store.all().length : 0;
    el('state').textContent = members
      .map((m) => {
        const cmd = m.byster && m.byster._command != null ? ' *' : '';
        const plug = m.byster && m.byster.actuator.plugged ? ' → wired' : '';
        return `${m.def.name}: ${m.mover.state}${cmd}${plug}`;
      })
      .concat(total ? [`fixtures: ${total - broken} fixed, ${broken} broken`] : [])
      .join('   |   ');
  });
}

main();
