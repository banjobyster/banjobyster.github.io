// The single integration surface between the site and the robot (SPEC 5).
// Site code imports mountRobot() and nothing else from src/robot/.
//
// Coordinate model: robot logic runs in DOCUMENT space; the Pixi world
// container is offset by -scroll each frame. Terrain rects, routes, and
// in-flight maneuvers stay valid while the user scrolls. The synthesized
// ground (full-width rect at the viewport bottom, like the sandbox #ground)
// is the one moving surface: its y is updated every frame, and a robot
// standing on it rides along. Viewport companionship comes from rebuilds
// only including on-screen platforms, plus an offscreen re-entry drop when
// the robot's platform scrolls away.

import { Container, Graphics } from 'pixi.js';
import { createOverlay } from './overlay.js';
import { compileTerrain, nearestPointOnTerrain } from './terrain.js';
import { Robot } from './robot.js';
import { RobotRenderer } from './renderer.js';
import { Effects } from './effects.js';
import { Director } from './director.js';
import { makeDrop } from './maneuvers.js';
import { clamp } from './math.js';

const REBUILD_MS = 150;
const STRAND_SNAP = 130; // snap silently when the nearest platform is this close

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
    segsByTag: (tag) => (graph ? graph.segments.filter((s) => s.rect.tag === tag) : []),
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
    const rects = [];
    for (const el of document.querySelectorAll('[data-terrain]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 8) continue;
      const top = r.top + sy;
      // usable platform = walkable top edge on screen (same rule as check-terrain)
      if (top < sy - 4 || top > sy + vh - 6) continue;
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

  const reenter = () => {
    // Drop in from above the viewport onto the highest visible real platform.
    const sy = window.scrollY;
    let best = -1;
    for (let i = 0; i < graph.segments.length; i++) {
      const s = graph.segments[i];
      if (s.rect.tag === 'ground') continue;
      if (s.x2 - s.x1 < 36) continue;
      if (best < 0 || s.y < graph.segments[best].y) best = i;
    }
    if (best < 0) best = groundIx;
    const s = graph.segments[best];
    const tx = clamp((s.x1 + s.x2) / 2, s.x1 + 4, s.x2 - 4);
    robot.executor.cancel();
    robot.pendingGoal = null;
    robot.graph = graph;
    robot.seg = best;
    robot.x = tx;
    robot.bodyY = sy - 70;
    robot.executor.maneuver = makeDrop(
      robot,
      { x: tx - robot.facing * 8, y: sy - 50, seg: best },
      { x: tx, y: s.y, seg: best },
    );
    robot.mode = 'maneuver';
    robot.setState('startled'); // settles back to idle after landing
    director.note(`terrain: re-entry drop onto ${s.rect.tag}`);
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
        const near = nearestPointOnTerrain(graph, robot.x, robot.bodyY);
        const sy = window.scrollY;
        const onScreen =
          robot.bodyY > sy - 20 && robot.bodyY < sy + window.innerHeight + 20;
        if (near && onScreen && near.d < STRAND_SNAP) robot.setTerrain(graph);
        else reenter();
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
    let ix = graph.segments.findIndex((s) => s.rect.tag === 'hero');
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
    if (dBody < 24 || dHead < 36) robot.poke();
    else director.onPageClick(x, y, e.target);
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

  const tick = (ticker) => {
    if (disposed || !spawned) return;
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
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
  app.ticker.add(tick);

  const unmount = () => {
    if (disposed) return;
    disposed = true;
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
    window.__robot = {
      handle,
      robot,
      director,
      effects,
      app,
      graph: () => graph,
      rebuild,
    };
  }

  return handle;
}
