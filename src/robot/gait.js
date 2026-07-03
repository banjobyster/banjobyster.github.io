// Step scheduler for the four feet. A foot steps when its planted position
// drifts past a speed-scaled threshold from its rest anchor; diagonal pairs
// alternate; each step is a short parabolic swing.

import { clamp, lerp, randRange } from './math.js';

const PAIRS = [
  [0, 2], // front-near + back-far
  [1, 3], // front-far + back-near
];

export class Gait {
  constructor(P) {
    this.P = P;
    this.feet = [0, 1, 2, 3].map(() => ({
      x: 0,
      y: 0,
      swing: null, // {fromX, fromY, toX, toY, t, dur, h}
      override: false, // true while a maneuver drives this foot directly
    }));
    this.fidgetTimer = randRange(2, 4);
  }

  reset(bodyX, surfY, facing) {
    for (let i = 0; i < 4; i++) {
      const f = this.feet[i];
      f.x = bodyX + this.P.footRestX[i] * facing + randRange(-3, 3);
      f.y = surfY;
      f.swing = null;
      f.override = false;
    }
  }

  startSwing(i, toX, toY, dur, h) {
    const f = this.feet[i];
    f.swing = { fromX: f.x, fromY: f.y, toX, toY, t: 0, dur, h };
  }

  pairSwinging(pairIx) {
    return PAIRS[pairIx].some((i) => this.feet[i].swing);
  }

  update(dt, bodyX, vel, surfY, facing, segX1, segX2) {
    const P = this.P;

    for (const f of this.feet) {
      if (f.override || !f.swing) continue;
      const s = f.swing;
      s.t += dt;
      const u = clamp(s.t / s.dur, 0, 1);
      f.x = lerp(s.fromX, s.toX, u);
      f.y = lerp(s.fromY, s.toY, u) - s.h * 4 * u * (1 - u);
      if (u >= 1) {
        f.x = s.toX;
        f.y = s.toY;
        f.swing = null;
      }
    }

    const S = P.scale;
    const speed = Math.abs(vel);
    const threshold = clamp(P.stepThresholdBase + speed * 0.08, 8 * S, 30 * S);
    const swingDur = clamp(0.12 - speed * 0.00022, 0.075, 0.12);
    const swingH = clamp(3 * S + speed * 0.02, 3 * S, 8 * S);

    for (let p = 0; p < 2; p++) {
      const other = 1 - p;
      if (this.pairSwinging(p) || this.pairSwinging(other)) continue;
      const errs = PAIRS[p].map((i) => {
        const anchor = bodyX + P.footRestX[i] * facing;
        return { i, anchor, err: Math.abs(this.feet[i].x - anchor) };
      });
      if (errs.some((e) => e.err > threshold)) {
        for (const e of errs) {
          if (e.err > threshold * 0.45) {
            const lead = vel * 0.12;
            const toX = clamp(e.anchor + lead, segX1 - 2, segX2 + 2);
            this.startSwing(e.i, toX, surfY, swingDur, swingH);
          }
        }
        break; // one pair per frame at most
      }
    }

    // Idle fidget: tiny nervous replants while standing still.
    if (speed < 5) {
      this.fidgetTimer -= dt;
      if (this.fidgetTimer <= 0) {
        this.fidgetTimer = randRange(2.5, 5.5);
        const i = (Math.random() * 4) | 0;
        const f = this.feet[i];
        if (!f.swing && !f.override) {
          const anchor = bodyX + P.footRestX[i] * facing;
          const toX = clamp(anchor + randRange(-4, 4), segX1 - 2, segX2 + 2);
          this.startSwing(i, toX, surfY, 0.1, 3 * this.P.scale);
        }
      }
    }
  }

  plantedAvgY(fallbackY) {
    let sum = 0;
    let n = 0;
    for (const f of this.feet) {
      if (!f.swing && !f.override) {
        sum += f.y;
        n++;
      }
    }
    return n ? sum / n : fallbackY;
  }
}
