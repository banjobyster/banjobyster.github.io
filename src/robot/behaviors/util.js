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

// ---------------- task stations (Part 3) ----------------
// Stations are DOM elements tagged data-station that the robot cast sabotages
// and repairs. Their geometry is the live DOM (a station is also a data-terrain
// platform, so api.segFor(el) resolves it); their STATE is the shared station
// store, read and written synchronously through the facade (api.stationState /
// api.setStation). No DOM-attribute-as-state, no async round trip.

// On-screen stations, each resolved to its terrain segment. Pass wantState to
// filter (e.g. 'ok' for sabotage targets, 'broken' for repair jobs).
// Reachability is left to the caller (planRoute needs the robot's position).
export function findStations(api, wantState = null) {
  const g = api.graph();
  if (!g) return [];
  const { scrollY: sy, viewportH: vh } = api.space();
  const out = [];
  for (const el of document.querySelectorAll('[data-station]')) {
    if (!el.isConnected) continue;
    const name = el.dataset.station;
    const state = api.stationState(name);
    if (wantState && state !== wantState) continue;
    const seg = api.segFor(el);
    if (seg < 0) continue;
    const s = g.segments[seg];
    if (s.y < sy + 6 || s.y > sy + vh - 6) continue; // fully on screen
    out.push({ el, name, state, seg, s });
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
//
// opts.hero: when escaping a rival, prefer the vertical side AWAY from it and
// aim for the platform farthest from it, so the imp flees up, down, or off to
// the side depending on where the hero is, instead of always draining downward.
// Routes with R's own caps, so the nimble imp can pick exits the hero cannot.
export function offscreenTarget(api, R, prefer, planRoute, opts = {}) {
  const g = api.graph();
  if (!g) return null;
  const { scrollY: sy, viewportH: vh } = api.space();
  const from = { seg: R.seg, x: R.x };
  const caps = R.caps;
  const hero = opts.hero || null;
  const cx = (s) => (s.x1 + s.x2) / 2;
  const band = (side) =>
    side === 'below' ? [sy + vh + 40, sy + vh + 560] : [sy - 560, sy - 40];
  let sides;
  if (hero) {
    const away = R.bodyY >= hero.bodyY ? 'below' : 'above';
    sides = [away, away === 'below' ? 'above' : 'below'];
  } else {
    sides = prefer === 'above' ? ['above', 'below'] : ['below', 'above'];
  }
  for (const side of sides) {
    const [lo, hi] = band(side);
    const cand = g.segments
      .filter((s) => s.rect.tag !== 'ground' && s.x2 - s.x1 >= 36 && s.y >= lo && s.y <= hi)
      .sort((a, b) =>
        hero
          ? Math.hypot(cx(b) - hero.x, b.y - hero.bodyY) -
            Math.hypot(cx(a) - hero.x, a.y - hero.bodyY)
          : Math.abs(cx(a) - R.x) - Math.abs(cx(b) - R.x),
      );
    for (const s of cand) {
      const x = cx(s);
      if (planRoute(g, from, { seg: s.id, x }, caps)) return { seg: s.id, x, y: s.y };
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
