// Viewport catch-up: left outside the viewport, walking back IS the job.
// No teleports; the corridor graph guarantees a real route (the cable
// ladder). Claims the slot the whole time the robot is offscreen so
// ambience never fights the walk back in.

import { clamp } from '../engine/math.js';

export function catchUp() {
  return {
    name: 'catch-up',
    priority: 60,

    init() {
      this.walking = false;
      this.cool = 0;
    },

    update(ctx) {
      const { d, R, api, sensors: s } = ctx;
      this.cool = Math.max(0, this.cool - ctx.dt);
      if (ctx.owner) return false;

      const off = R.bodyY < s.scrollY - 40 || R.bodyY > s.scrollY + s.vh + 40;
      if (!off) {
        this.walking = false;
        return false;
      }

      if (!this.walking && this.cool <= 0 && R.mode === 'ground') {
        if (R.state === 'idle' || R.state === 'sleep' || R.state === 'wander') {
          const g = api.graph();
          let best = null;
          for (const seg of g.segments) {
            if (seg.rect.tag === 'ground') continue;
            if (seg.x2 - seg.x1 < 36) continue;
            if (seg.y < s.scrollY + 60 || seg.y > s.scrollY + s.vh - 60) continue;
            const cx = (seg.x1 + seg.x2) / 2;
            if (!best || Math.abs(cx - R.x) < Math.abs((best.x1 + best.x2) / 2 - R.x)) best = seg;
          }
          if (!best) best = g.segments.find((seg) => seg.rect.tag === 'ground');
          if (best) {
            this.walking = true;
            this.cool = 0.6; // never re-issue in a tight loop (instant/empty routes)
            d.note('catch-up: heading back into view');
            R.commandGotoSeg(best.id, clamp(R.x, best.x1 + 4, best.x2 - 4), {
              noise: 0.15,
              quiet: true,
              speed: R.P.walkSpeed * 1.25,
              onDone: () => {
                this.walking = false;
              },
              onFail: () => {
                this.walking = false;
                this.cool = 1.5; // do not spin on an unreachable target
              },
            });
          }
        }
      }
      return true; // offscreen: hold the slot even between route attempts
    },

    onTerrainRebuilt() {
      this.walking = false; // the rebind canceled any route; re-issued next frame
    },
  };
}
