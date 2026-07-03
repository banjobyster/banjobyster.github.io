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
