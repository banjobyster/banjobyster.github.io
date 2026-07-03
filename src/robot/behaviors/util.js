// Small shared helpers for behavior modules.

export function cssColorToInt(str, fallback) {
  if (!str) return fallback;
  const s = str.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return (r << 16) | (g << 8) | b;
  }
  m = s.match(/^#([0-9a-f]{6})/i);
  if (m) return parseInt(m[1], 16);
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return (+m[1] << 16) | (+m[2] << 8) | +m[3];
  return fallback;
}

// ---------------- task stations (Part 3c) ----------------
// Stations are DOM elements tagged data-station / data-state that the robot
// cast sabotages and repairs. The robot stack must not import React, so it
// talks to them purely through the DOM: request a change by dispatching this
// event, read the current state off the attribute. The event name is
// duplicated in src/components/stations.js; the two must stay in sync.
export const STATION_EVENT = 'robot:station';

export function setStation(name, state) {
  window.dispatchEvent(new CustomEvent(STATION_EVENT, { detail: { name, state } }));
}

// On-screen stations, each resolved to its terrain segment. Every station
// element is itself a data-terrain element, so api.segFor(el) finds it
// directly. Pass wantState to filter (e.g. 'ok' for sabotage targets,
// 'broken' for repair jobs). Reachability is left to the caller (planRoute
// needs the robot's current position).
export function findStations(api, wantState = null) {
  const g = api.graph();
  if (!g) return [];
  const sy = window.scrollY;
  const vh = window.innerHeight;
  const out = [];
  for (const el of document.querySelectorAll('[data-station]')) {
    if (!el.isConnected) continue;
    const state = el.dataset.state;
    if (wantState && state !== wantState) continue;
    const seg = api.segFor(el);
    if (seg < 0) continue;
    const s = g.segments[seg];
    if (s.y < sy + 6 || s.y > sy + vh - 6) continue; // fully on screen
    out.push({ el, name: el.dataset.station, state, seg, s });
  }
  return out;
}

// The nearest OTHER robot in the cast (the facade exposes api.robots()), with
// the document-space distance to it. Used by the villain's flee (watching the
// hero) and the hero's chase (watching the villain). Returns null when alone.
export function nearestOther(api, self) {
  const others = (api.robots ? api.robots() : []).filter((r) => r !== self);
  let best = null;
  for (const r of others) {
    const d = Math.hypot(r.x - self.x, r.bodyY - self.bodyY);
    if (!best || d < best.dist) best = { robot: r, dist: d };
  }
  return best;
}

// A reachable platform beyond a viewport edge, for leaving the scene on foot.
// prefer: 'below' | 'above'. Falls back to the other side, then to any
// offscreen platform. Returns { seg, x } or null. Never teleports: the caller
// routes to it through the graph (the corridor band makes the exit legal).
export function offscreenTarget(api, R, prefer, planRoute) {
  const g = api.graph();
  if (!g) return null;
  const sy = window.scrollY;
  const vh = window.innerHeight;
  const from = { seg: R.seg, x: R.x };
  const band = (side) =>
    side === 'below' ? [sy + vh + 40, sy + vh + 560] : [sy - 560, sy - 40];
  const sides = prefer === 'above' ? ['above', 'below'] : ['below', 'above'];
  for (const side of sides) {
    const [lo, hi] = band(side);
    const cand = g.segments
      .filter((s) => s.rect.tag !== 'ground' && s.x2 - s.x1 >= 36 && s.y >= lo && s.y <= hi)
      .sort((a, b) => Math.abs((a.x1 + a.x2) / 2 - R.x) - Math.abs((b.x1 + b.x2) / 2 - R.x));
    for (const s of cand) {
      const x = (s.x1 + s.x2) / 2;
      if (planRoute(g, from, { seg: s.id, x })) return { seg: s.id, x, y: s.y };
    }
  }
  return null;
}

// Face palette [off, dim, main, hot] derived from an accent color.
export function accentPalette(col) {
  const r = (col >> 16) & 255;
  const g = (col >> 8) & 255;
  const b = col & 255;
  const mix = (c, t, k) => Math.round(c + (t - c) * k);
  const dim = (mix(r, 0, 0.55) << 16) | (mix(g, 0, 0.55) << 8) | mix(b, 0, 0.55);
  const hot = (mix(r, 255, 0.75) << 16) | (mix(g, 255, 0.75) << 8) | mix(b, 255, 0.75);
  return [0, dim, col, hot];
}
