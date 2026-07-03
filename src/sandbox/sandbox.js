// M0 sandbox harness: dummy boxes as terrain, click-to-route, debug overlay,
// and a small control panel for the motion-quality review.

import { Container, Graphics } from 'pixi.js';
import { createOverlay } from '../robot/engine/overlay.js';
import { compileTerrain } from '../robot/engine/terrain.js';
import { Robot } from '../robot/engine/robot.js';
import { RobotRenderer } from '../robot/engine/renderer.js';
import { CRT_TODDLER } from '../robot/characters/crt-toddler.js';
import './sandbox.css';

const EDGE_COLORS = { hop: 0xe0a83c, climb: 0x4c9be8, drop: 0xb069e8 };

// Mobile preset: a 390px phone-width frame with stacked cards, the worst case
// for traversal. Card tops are 88px apart (climbMax is 95) and alternate
// left/right offsets so every upper corner has standable approach space on
// the card below: the layout rules M1 has to follow, proven here first.
function applyLayout() {
  if (new URLSearchParams(location.search).get('layout') !== 'mobile') return;
  document.body.classList.add('mobile');
  document.querySelector('#world').innerHTML = `
    <div class="box" data-terrain style="left: 16px; bottom: 88px; width: 260px; height: 64px"><span>1</span></div>
    <div class="box" data-terrain style="left: 114px; bottom: 176px; width: 260px; height: 64px"><span>2</span></div>
    <div class="box" data-terrain style="left: 16px; bottom: 264px; width: 260px; height: 64px"><span>3</span></div>
    <div id="ground" data-terrain></div>`;
}

async function main() {
  applyLayout();
  const app = await createOverlay();
  const stage = new Container();
  const debugG = new Graphics();
  app.stage.addChild(stage, debugG);

  const collectRects = () =>
    [...document.querySelectorAll('[data-terrain]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

  let graph = compileTerrain(collectRects());
  const robot = new Robot(CRT_TODDLER);
  const groundIx = graph.segments.reduce((a, s, i) => (s.y > graph.segments[a].y ? i : a), 0);
  const gs = graph.segments[groundIx];
  robot.spawn(graph, groundIx, gs.x1 + (gs.x2 - gs.x1) * 0.4);
  const renderer = new RobotRenderer(stage, robot.character);

  // Cursor tracking with smoothed velocity.
  const cursor = { x: -1000, y: -1000, vx: 0, vy: 0, speed: 0, has: false };
  let lastMove = performance.now();
  window.addEventListener('pointermove', (e) => {
    const now = performance.now();
    const dt = Math.max((now - lastMove) / 1000, 0.001);
    lastMove = now;
    if (cursor.has) {
      cursor.vx = cursor.vx * 0.7 + ((e.clientX - cursor.x) / dt) * 0.3;
      cursor.vy = cursor.vy * 0.7 + ((e.clientY - cursor.y) / dt) * 0.3;
    }
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    cursor.has = true;
  });

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.panel')) return;
    const dBody = Math.hypot(e.clientX - robot.x, e.clientY - robot.bodyY);
    const dHead = Math.hypot(e.clientX - robot.headX, e.clientY - robot.headY);
    if (dBody < 20 || dHead < 28) robot.poke();
    else robot.commandGoto(e.clientX, e.clientY);
  });

  const rebuild = () => {
    graph = compileTerrain(collectRects());
    robot.setTerrain(graph);
  };
  let rebuildTimer = null;
  const queueRebuild = () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 150);
  };
  window.addEventListener('resize', queueRebuild);
  window.addEventListener('scroll', queueRebuild, { passive: true });

  // Panel controls.
  const noiseEl = document.querySelector('#noise');
  const debugEl = document.querySelector('#debug');
  const stateEl = document.querySelector('#state');
  noiseEl.addEventListener('input', () => {
    robot.noise = parseFloat(noiseEl.value);
  });
  for (const btn of document.querySelectorAll('.faces button')) {
    btn.addEventListener('click', () => robot.face.set(btn.dataset.face, 2));
  }
  if (new URLSearchParams(location.search).get('debug') === '1') debugEl.checked = true;

  function drawDebug() {
    debugG.clear();
    if (!debugEl.checked) return;
    for (const s of graph.segments) {
      debugG.moveTo(s.x1, s.y).lineTo(s.x2, s.y).stroke({ width: 2, color: 0x3ddc97, alpha: 0.45 });
    }
    for (const [aId, edges] of graph.adj) {
      const a = graph.nodes[aId];
      for (const e of edges) {
        if (e.type === 'walk') continue;
        const b = graph.nodes[e.to];
        debugG
          .moveTo(a.x, a.y)
          .lineTo(b.x, b.y)
          .stroke({ width: 1, color: EDGE_COLORS[e.type], alpha: 0.55 });
      }
    }
    for (const n of graph.nodes) debugG.circle(n.x, n.y, 2.5).fill({ color: 0x3ddc97, alpha: 0.7 });
    // Remaining route as a white polyline from the robot.
    const steps = robot.executor.steps;
    if (steps) {
      let px = robot.x;
      let py = robot.surfaceY;
      for (let i = robot.executor.ix; i < steps.length; i++) {
        const st = steps[i];
        const end = st.type === 'walk' ? { x: st.toX, y: st.y } : st.to;
        debugG.moveTo(px, py).lineTo(end.x, end.y).stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
        px = end.x;
        py = end.y;
      }
    }
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    if (performance.now() - lastMove > 80) {
      cursor.vx *= 0.8;
      cursor.vy *= 0.8;
    }
    cursor.speed = Math.hypot(cursor.vx, cursor.vy);
    robot.update(dt, { cursor: cursor.has ? cursor : null });
    renderer.draw(robot, dt);
    drawDebug();
    stateEl.textContent = `${robot.state} | ${robot.mode}${robot.executor.steps ? ' | on route' : ''} | face ${robot.face.expr}`;
  });

  window.__sandbox = { robot, app, graph: () => graph };
}

main();
