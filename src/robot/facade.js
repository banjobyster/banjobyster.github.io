// The single integration surface between the site and the robot (SPEC 5).
// Site code imports mountRobot() and nothing else from src/robot/.
//
// Coordinate model: robot logic runs in DOCUMENT space; the Pixi world
// container is offset by -scroll each frame. Terrain rects, routes, and
// in-flight maneuvers stay valid while the user scrolls. The synthesized
// ground (full-width rect at the viewport bottom, like the sandbox #ground)
// is the one moving surface: its y is updated every frame, and a robot
// standing on it rides along.
//
// Viewport companionship without teleports: the compiled graph includes a
// corridor of platforms ~600px beyond the viewport, so a robot left behind
// always has a real route back (the cable ladder). The director issues the
// catch-up route; when the robot is left VERY far behind, it is repositioned
// only while fully offscreen, onto a corridor platform just beyond the near
// edge, and still climbs or drops into view on its own legs.

import { Container, Graphics } from 'pixi.js';
import { createOverlay } from './engine/overlay.js';
import { compileTerrain, nearestPointOnTerrain } from './engine/terrain.js';
import { Robot } from './engine/robot.js';
import { RobotRenderer } from './engine/renderer.js';
import { Effects } from './effects.js';
import { Director } from './director.js';
import { clamp } from './engine/math.js';

const REBUILD_MS = 150;
const CORRIDOR = 600; // graph extends this far beyond the viewport
const SWAP_SNAP = 130; // silent snap only when a platform ELEMENT is replaced in place
// Offscreen distances beyond which the robot is quietly moved (while unseen)
// to just outside the near edge before walking in. Coming down is a fast
// drop chain, coming up is a slow climb chain, hence the asymmetry.
const SHORTCUT_ABOVE = 900;
const SHORTCUT_BELOW = 340;

// window.__robot bookkeeping (?robot=debug): StrictMode mounts twice and the
// async mounts resolve in either order, so a dead instance could clobber the
// global after the live one set it. The registry keeps the global pointing
// at a mounted instance no matter the resolve/unmount interleaving.
let debugRegistry = [];
const exposeDebug = () => {
  if (debugRegistry.length) window.__robot = debugRegistry[debugRegistry.length - 1];
  else delete window.__robot;
};

export async function mountRobot(opts = {}) {
  const getPageState = opts.getPageState || (() => ({ fetch: 'loading' }));
  const debug = new URLSearchParams(location.search).get('robot') === 'debug';

  const app = await createOverlay();
  const world = new Container();
  app.stage.addChild(world);

  const robot = new Robot();
  robot.autoWander = false; // the director owns ambient movement on the site
  const effects = new Effects(robot);
  world.addChild(effects.under);
  const renderer = new RobotRenderer(world, robot.P);
  world.addChild(effects.over);
  const debugG = debug ? new Graphics() : null;
  if (debugG) world.addChild(debugG);

  let graph = null;
  let groundIx = -1;
  let disposed = false;
  let spawned = false;
  let rebuildTimer = 0;
  let deferredRebuilds = 0;
  let lastFetch = 'loading';

  const listeners = { arrive: [], sleep: [], wake: [], synced: [], offline: [] };
  const emit = (ev) => {
    for (const cb of listeners[ev] || []) cb();
  };

  const api = {
    segFor: (el) => (graph ? graph.segments.findIndex((s) => s.rect.el === el) : -1),
    // Job targets must be on screen; the graph also holds corridor platforms.
    segsByTag: (tag) => {
      if (!graph) return [];
      const sy = window.scrollY;
      const vh = window.innerHeight;
      return graph.segments.filter(
        (s) => s.rect.tag === tag && s.y >= sy - 4 && s.y <= sy + vh - 6,
      );
    },
    graph: () => graph,
    getPageState,
    emit,
  };
  const director = new Director(robot, effects, renderer, api);

  // ---------------- terrain ----------------

  const collectRects = () => {
    const sy = window.scrollY;
    const sx = window.scrollX;
    const vh = window.innerHeight;
    // Corridor band: the viewport plus CORRIDOR on both sides, stretched to
    // include wherever the robot currently is, so it always has a real route
    // back instead of being teleported.
    let lo = sy - CORRIDOR;
    let hi = sy + vh + CORRIDOR;
    if (spawned) {
      lo = Math.min(lo, robot.bodyY - 100);
      hi = Math.max(hi, robot.bodyY + 100);
    }
    const rects = [];
    for (const el of document.querySelectorAll('[data-terrain]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 8) continue;
      const top = r.top + sy;
      if (top < lo || top > hi) continue;
      rects.push({ x: r.left + sx, y: top, w: r.width, h: r.height, el, tag: el.dataset.terrain });
    }
    rects.push({
      x: -200,
      y: sy + vh,
      w: window.innerWidth + 400,
      h: 60,
      el: null,
      tag: 'ground',
    });
    return rects;
  };

  const drawDebug = () => {
    if (!debugG || !graph) return;
    debugG.clear();
    for (const s of graph.segments) {
      debugG.moveTo(s.x1, s.y).lineTo(s.x2, s.y).stroke({ width: 2, color: 0x3ddc97, alpha: 0.4 });
    }
    for (const [aId, edges] of graph.adj) {
      const a = graph.nodes[aId];
      for (const e of edges) {
        if (e.type === 'walk') continue;
        const b = graph.nodes[e.to];
        debugG.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: 0xe0a83c, alpha: 0.45 });
      }
    }
  };

  // How far the robot is beyond the viewport edges (0 while visible).
  const offscreenBy = () => {
    const sy = window.scrollY;
    const vh = window.innerHeight;
    if (robot.bodyY < sy) return robot.bodyY - sy; // negative: above
    if (robot.bodyY > sy + vh) return robot.bodyY - (sy + vh); // positive: below
    return 0;
  };

  // Quietly reposition the robot WHILE FULLY OFFSCREEN onto a corridor
  // platform just beyond the near viewport edge, facing inward. The user
  // never sees this; the entrance is always a real climb or drop chain.
  const shortcutPlace = () => {
    const sy = window.scrollY;
    const vh = window.innerHeight;
    const above = robot.bodyY < sy + vh / 2;
    const zones = above
      ? [
          [sy - 520, sy - 140],
          [sy - CORRIDOR, sy - 60],
        ]
      : [
          [sy + vh + 120, sy + vh + 320],
          [sy + vh + 60, sy + vh + CORRIDOR],
        ];
    let best = -1;
    for (const [zLo, zHi] of zones) {
      for (let i = 0; i < graph.segments.length; i++) {
        const s = graph.segments[i];
        if (s.rect.tag === 'ground') continue;
        if (s.x2 - s.x1 < 36) continue;
        if (s.y < zLo || s.y > zHi) continue;
        if (
          best < 0 ||
          Math.abs((s.x1 + s.x2) / 2 - robot.x) <
            Math.abs((graph.segments[best].x1 + graph.segments[best].x2) / 2 - robot.x)
        ) {
          best = i;
        }
      }
      if (best >= 0) break;
    }
    if (best < 0) {
      // no corridor platform on that side (should not happen with the rail);
      // fall back to the nearest surface, still offscreen
      const near = nearestPointOnTerrain(graph, robot.x, robot.bodyY);
      if (!near) return;
      best = near.seg;
    }
    const s = graph.segments[best];
    const tx = clamp((s.x1 + s.x2) / 2, s.x1 + 4, s.x2 - 4);
    robot.executor.cancel();
    robot.pendingGoal = null;
    robot.graph = graph;
    robot.seg = best;
    robot.x = tx;
    robot.bodyY = s.y - robot.P.standH;
    robot.mode = 'ground';
    robot.gait.reset(tx, s.y, robot.facing);
    if (robot.state === 'wander' || robot.state === 'goto' || robot.state === 'startled') {
      robot.setState('idle');
    }
    director.note(`terrain: offscreen shortcut to ${s.rect.tag} (${above ? 'above' : 'below'})`);
  };

  const rebuild = () => {
    if (disposed) return;
    // Mid-maneuver coordinates live in closures; landing on a stale graph is
    // worse than rebuilding 120ms late, so wait for touchdown (bounded).
    if (robot.mode === 'maneuver' && spawned && deferredRebuilds < 6) {
      deferredRebuilds += 1;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(rebuild, 120);
      return;
    }
    deferredRebuilds = 0;

    const prev = spawned && graph ? graph.segments[robot.seg] : null;
    graph = compileTerrain(collectRects());
    groundIx = graph.segments.length - 1;

    if (prev) {
      const sameIx = graph.segments.findIndex((s) =>
        prev.rect.el ? s.rect.el === prev.rect.el : s.rect.tag === 'ground',
      );
      if (sameIx >= 0) {
        robot.rebindTerrain(graph, sameIx);
      } else {
        // The element itself is gone (e.g. skeleton cards swapped for live
        // ones in place): a tiny snap is invisible; anything else means the
        // robot is offscreen and gets the corridor shortcut.
        const near = nearestPointOnTerrain(graph, robot.x, robot.bodyY);
        if (near && offscreenBy() === 0 && near.d < SWAP_SNAP) robot.setTerrain(graph);
        else shortcutPlace();
      }
      // Left far behind: reposition offscreen so the walk-in stays short.
      const off = offscreenBy();
      if ((off < -SHORTCUT_ABOVE || off > SHORTCUT_BELOW) && robot.mode === 'ground') {
        shortcutPlace();
      }
      director.onTerrainRebuilt();
    }
    drawDebug();
  };

  const queueRebuild = () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, REBUILD_MS);
  };

  const spawn = () => {
    rebuild();
    // The robot is already on the hero when the page loads (SPEC 4.4); if the
    // page opens scrolled elsewhere, wake on the platform nearest mid-view.
    const heroVis = api.segsByTag('hero');
    let ix = heroVis.length ? heroVis[0].id : -1;
    if (ix < 0) {
      const near = nearestPointOnTerrain(
        graph,
        window.innerWidth * 0.45,
        window.scrollY + window.innerHeight * 0.5,
      );
      ix = near ? near.seg : groundIx;
    }
    const s = graph.segments[ix];
    robot.spawn(graph, ix, s.x1 + (s.x2 - s.x1) * 0.6);
    spawned = true;
  };

  // ---------------- sensors ----------------

  const cursor = { cx: -1000, cy: -1000, vx: 0, vy: 0, speed: 0, has: false };
  let lastMove = performance.now();
  const onPointerMove = (e) => {
    const now = performance.now();
    const dt = Math.max((now - lastMove) / 1000, 0.001);
    lastMove = now;
    if (cursor.has) {
      // velocity from client-space motion only, so scrolling does not read
      // as a rushing cursor
      cursor.vx = cursor.vx * 0.7 + ((e.clientX - cursor.cx) / dt) * 0.3;
      cursor.vy = cursor.vy * 0.7 + ((e.clientY - cursor.cy) / dt) * 0.3;
    }
    cursor.cx = e.clientX;
    cursor.cy = e.clientY;
    cursor.has = true;
  };

  let hoverCard = null;
  const onPointerOver = (e) => {
    hoverCard = e.target.closest ? e.target.closest('[data-terrain="card"]') : null;
  };

  const onPointerDown = (e) => {
    if (!spawned) return;
    const x = e.clientX + window.scrollX;
    const y = e.clientY + window.scrollY;
    const dBody = Math.hypot(x - robot.x, y - robot.bodyY);
    const dHead = Math.hypot(x - robot.headX, y - robot.headY);
    if (dBody < 24 || dHead < 36) {
      robot.poke();
      director.onPoke();
    } else {
      director.onPageClick(x, y, e.target);
    }
  };

  let lastScrollY = window.scrollY;
  let scrollSpeed = 0;

  const onVisibility = () => {
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerover', onPointerOver, { passive: true });
  document.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', queueRebuild);
  window.addEventListener('scroll', queueRebuild, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(queueRebuild);
  ro.observe(document.body);

  // ---------------- main loop ----------------

  let sleepAccum = 0;
  let prevState = null;

  const step = (dt) => {
    if (disposed || !spawned) return;
    const sy = window.scrollY;
    const vh = window.innerHeight;
    world.position.set(-window.scrollX, -sy);

    // scroll speed sensor (smoothed)
    scrollSpeed = scrollSpeed * 0.8 + (Math.abs(sy - lastScrollY) / Math.max(dt, 0.001)) * 0.2;
    lastScrollY = sy;

    // the ground rides the viewport bottom edge
    const gs = graph.segments[groundIx];
    const gy = sy + vh;
    if (gs && Math.abs(gs.y - gy) > 0.01) {
      const dy = gy - gs.y;
      gs.y = gy;
      gs.rect.y = gy;
      for (const n of graph.nodes) if (n.seg === gs.id) n.y = gy;
      if (robot.mode === 'ground' && robot.seg === gs.id) {
        robot.bodyY += dy;
        for (const f of robot.gait.feet) f.y += dy;
      }
    }

    if (performance.now() - lastMove > 80) {
      cursor.vx *= 0.8;
      cursor.vy *= 0.8;
    }
    cursor.speed = Math.hypot(cursor.vx, cursor.vy);
    const cursorDoc = cursor.has
      ? {
          x: cursor.cx + window.scrollX,
          y: cursor.cy + sy,
          vx: cursor.vx,
          vy: cursor.vy,
          speed: cursor.speed,
        }
      : null;
    const sensors = { cursor: cursorDoc, hoverCard, scrollY: sy, vh, scrollSpeed };

    // near-zero work while sleeping: robot sim at ~11Hz, effects stay live
    if (robot.state === 'sleep' && !robot.executor.active) {
      sleepAccum += dt;
      effects.update(dt);
      if (sleepAccum < 0.09) return;
      robot.update(sleepAccum, { cursor: cursorDoc });
      director.update(sleepAccum, sensors);
      renderer.draw(robot, sleepAccum);
      sleepAccum = 0;
    } else {
      sleepAccum = 0;
      robot.update(dt, { cursor: cursorDoc });
      director.update(dt, sensors);
      effects.update(dt);
      renderer.draw(robot, dt);
    }

    if (robot.state !== prevState) {
      if (robot.state === 'sleep') emit('sleep');
      else if (prevState === 'sleep') emit('wake');
      prevState = robot.state;
    }

    // live data landed: the repo grid staggers in over ~0.4s + 45ms per card;
    // rebuild again after the translate animation settles
    const fetch = getPageState().fetch;
    if (fetch !== lastFetch) {
      lastFetch = fetch;
      setTimeout(queueRebuild, 700);
      setTimeout(queueRebuild, 1500);
    }
  };

  spawn();
  app.ticker.add((ticker) => step(Math.min(ticker.deltaMS / 1000, 0.05)));

  let onUnmountDebug = null;

  const unmount = () => {
    if (disposed) return;
    disposed = true;
    if (onUnmountDebug) onUnmountDebug();
    clearTimeout(rebuildTimer);
    ro.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerover', onPointerOver);
    document.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('resize', queueRebuild);
    window.removeEventListener('scroll', queueRebuild);
    document.removeEventListener('visibilitychange', onVisibility);
    app.destroy(true, { children: true, texture: true });
  };

  const handle = {
    unmount,
    goto(el) {
      const ix = api.segFor(el);
      if (ix < 0) return false;
      const s = graph.segments[ix];
      return robot.commandGotoSeg(ix, (s.x1 + s.x2) / 2, {});
    },
    setExpression(name, hold = 0) {
      robot.face.set(name, hold);
    },
    on(ev, cb) {
      (listeners[ev] = listeners[ev] || []).push(cb);
      return () => {
        listeners[ev] = listeners[ev].filter((f) => f !== cb);
      };
    },
  };

  if (debug) {
    const dbg = {
      handle,
      robot,
      director,
      effects,
      app,
      graph: () => graph,
      rebuild,
      // Deterministic sim stepping for occluded tabs where rAF never fires.
      step: (seconds = 1) => {
        const n = Math.max(1, Math.round(seconds * 60));
        for (let i = 0; i < n; i++) step(1 / 60);
      },
    };
    debugRegistry.push(dbg);
    exposeDebug();
    onUnmountDebug = () => {
      debugRegistry = debugRegistry.filter((d) => d !== dbg);
      exposeDebug();
    };
  }

  return handle;
}
