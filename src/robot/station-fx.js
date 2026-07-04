// Diegetic fault FX for the task stations, drawn on the overlay canvas so they
// are never clipped by a station's own box. A broken station occasionally
// sputters small electrical sparks from its top edge: it reads as the device
// itself faulting, not a HUD icon floating over it. There is deliberately no
// warning badge and no smoke plume; the "what broke" legibility lives on the
// box (LED recolor, dead screen, the fault the villain leaves) plus the CSS
// glow ring, and a repair in progress (busy) is read from the box, not here.
//
// Reads live DOM rects and data-state each frame, the same live-DOM model the
// terrain graph and the plug cables use. Purely additive: with no canvas
// (reduced motion / no WebGL) there is no villain either, so stations stay
// online and there is nothing to flag.

import { Graphics } from 'pixi.js';
import { clamp, randRange } from 'bysters/core/math.js';

export class StationFx {
  constructor(stations) {
    this.stations = stations; // the station store (single source of truth)
    this.g = new Graphics();
    this.sparks = [];
    this.sparkTimer = 0;
    this.t = 0;
  }

  // space: the current Space snapshot (TDD Section 5). Station rects come from
  // it in document coordinates, the same live-DOM model the terrain graph uses,
  // so nothing here reads window.
  update(dt, space) {
    this.t += dt;
    const g = this.g;
    g.clear();

    this.sparkTimer -= dt;
    const emit = this.sparkTimer <= 0;
    for (const el of document.querySelectorAll('[data-station]')) {
      if (!el.isConnected) continue;
      if (this.stations.get(el.dataset.station) !== 'broken') continue;
      const r = space ? space.rectOf(el) : null;
      if (!r || r.w < 6) continue;
      if (emit) {
        // A short electric spit from a random point along the top of the box.
        this.sparks.push({
          x: r.x + randRange(r.w * 0.18, r.w * 0.82),
          y: r.y + randRange(1, Math.min(r.h * 0.5, 14)),
          vx: randRange(-46, 46),
          vy: randRange(-95, -30),
          t: 0,
          life: randRange(0.16, 0.4),
          color: Math.random() < 0.5 ? 0xff6a4d : 0xffd8b0,
        });
      }
    }
    if (emit) this.sparkTimer = randRange(0.12, 0.32);

    for (const s of this.sparks) {
      s.t += dt;
      s.vy += 760 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = 1 - s.t / s.life;
      if (k > 0) g.rect(s.x - 1.1, s.y - 1.1, 2.4, 2.4).fill({ color: s.color, alpha: clamp(k, 0, 1) });
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
  }

  destroy() {
    if (this.g.parent) this.g.parent.removeChild(this.g);
    this.g.destroy();
  }
}
