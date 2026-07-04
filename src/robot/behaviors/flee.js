// Villain flee (Part 3d), highest priority in the villain set. Graded so the
// imp is bold but jumpy, and so the rivalry reads as real:
//   - wary (hero within ~230px): a REACTION only, never claims the slot. The
//     imp shoots the hero a nervous glance and an alert bubble but keeps
//     scheming, so it will still dart in for a sabotage under the hero's nose.
//   - bolt (hero within ~140px): drop everything, startle-hop, and sprint for a
//     far / offscreen platform, sweating. Only this claims the slot.
// Coming out of a bolt asks exit-return to slink the imp off (shared mind).

import { clamp } from 'bysters/core/math.js';
import { planRoute } from 'bysters/core/path/terrain.js';
import { nearestOther, offscreenTarget } from './util.js';

const BOLT = 140; // this close: run
const BOLT_OFF = 210; // stop bolting once this far again (hysteresis)
const WARY = 230; // this close: nervous, but still bold

export function flee() {
  return {
    name: 'flee',
    priority: 90,

    init() {
      this.bolting = false;
      this.hopped = false;
      this.reissue = 0;
    },

    update(ctx) {
      const { d, R, api } = ctx;
      this.reissue = Math.max(0, this.reissue - ctx.dt);
      const near = nearestOther(api, R);
      if (!near) return false;
      const dist = near.dist;
      const hero = near.robot;

      const wasBolting = this.bolting;
      if (dist <= BOLT) this.bolting = true;
      else if (dist >= BOLT_OFF) this.bolting = false;
      // Coming out of a bolt it stays present (it just ran to a far platform or
      // popped offscreen, where catch-up walks it back) instead of vanishing.
      // Only a successful sabotage triggers the full exit-and-return beat.
      if (wasBolting && !this.bolting) this.hopped = false;

      if (this.bolting) {
        R.wakeIfSleeping();
        d.lookAt(hero.x, hero.bodyY, 0.35);
        const away = Math.sign(R.x - hero.x) || R.facing || 1;
        if (!this.hopped && R.mode === 'ground') {
          R.face.set('panic', 0.9);
          R.startle(away);
          this.hopped = true;
          d.note('flee: startled, bolting');
          return true;
        }
        if (
          R.mode === 'ground' &&
          this.reissue <= 0 &&
          (R.state === 'idle' || R.state === 'startled')
        ) {
          this.reissue = 0.5;
          R.face.set('panic', 0.7);
          // Flee to the side away from the hero (up, down, or off sideways),
          // not always downward.
          const off = offscreenTarget(api, R, 'below', planRoute, { hero });
          if (off) {
            R.commandGotoSeg(off.seg, off.x, { noise: 0.1, quiet: true, speed: R.P.walkSpeed * 1.4 });
          } else {
            this.sprintAway(ctx, away);
          }
        }
        return true;
      }

      // Wary: a jumpy reaction, but it does NOT claim the slot, so sabotage and
      // prowl keep running. Only flavor while idling near the hero: a nervous
      // sideways look and a wary face.
      if (dist <= WARY && R.state !== 'goto') {
        d.lookAt(hero.x, hero.bodyY, 0.4);
        if (R.face.expr === 'idle' || R.face.expr === 'mischief') R.face.set('suspicious', 0.4);
      }
      return false;
    },

    // Fallback when there is no clean offscreen route: run to the far end of a
    // reachable platform on the away side.
    sprintAway(ctx, away) {
      const { R, api } = ctx;
      const g = api.graph();
      const from = { seg: R.seg, x: R.x };
      const cand = g.segments
        .filter((s) => s.rect.tag !== 'ground' && s.x2 - s.x1 >= 36)
        .filter((s) => Math.sign((s.x1 + s.x2) / 2 - R.x) === away)
        .sort((a, b) => Math.abs((b.x1 + b.x2) / 2 - R.x) - Math.abs((a.x1 + a.x2) / 2 - R.x));
      for (const s of cand) {
        if (planRoute(g, from, { seg: s.id, x: (s.x1 + s.x2) / 2 }, R.caps)) {
          R.commandGotoSeg(s.id, clamp((s.x1 + s.x2) / 2, s.x1 + 4, s.x2 - 4), {
            noise: 0.15,
            quiet: true,
            speed: R.P.walkSpeed * 1.4,
          });
          return;
        }
      }
    },

    onTerrainRebuilt() {
      this.reissue = 0;
    },
  };
}
