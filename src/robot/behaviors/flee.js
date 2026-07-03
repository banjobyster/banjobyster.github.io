// Villain flee (Part 3d), highest priority in the villain set: whenever the
// hero robot gets close, the imp bolts. It startle-hops first, then sprints
// for a platform on the far side (an offscreen corridor platform if it can),
// so a chase pushes it right out of view. Leaving the scene here feeds the
// exit-return beat through the shared villain mind (mind.wantsExit).

import { clamp } from '../engine/math.js';
import { planRoute } from '../engine/terrain.js';
import { nearestOther, offscreenTarget } from './util.js';

const FLEE_ON = 180; // hero this close: run
const FLEE_OFF = 300; // relax once this far again (hysteresis)

export function flee(mind) {
  return {
    name: 'flee',
    priority: 90,

    init() {
      this.on = false;
      this.hopped = false;
      this.reissue = 0;
    },

    update(ctx) {
      const { d, R, api } = ctx;
      this.reissue = Math.max(0, this.reissue - ctx.dt);
      const near = nearestOther(api, R);
      if (!near) return false;

      if (near.dist < FLEE_ON) this.on = true;
      else if (near.dist > FLEE_OFF) {
        if (this.on) mind.wantsExit = true; // it got away: slink off and reset
        this.on = false;
        this.hopped = false;
      }
      if (!this.on) return false;

      R.wakeIfSleeping();
      const away = Math.sign(R.x - near.robot.x) || R.facing || 1;

      // A startled first hop, once per flee.
      if (!this.hopped && R.mode === 'ground') {
        R.face.set('panic', 0.9);
        R.startle(away);
        this.hopped = true;
        d.note('flee: startled by the hero, bolting');
        return true;
      }

      // Sprint away: prefer bolting clean offscreen; else the far platform.
      if (R.mode === 'ground' && this.reissue <= 0 && (R.state === 'idle' || R.state === 'startled')) {
        this.reissue = 0.5;
        R.face.set('panic', 0.7);
        const off = offscreenTarget(api, R, 'below', planRoute);
        if (off) {
          R.commandGotoSeg(off.seg, off.x, {
            noise: 0.1,
            quiet: true,
            speed: R.P.walkSpeed * 1.4,
          });
        } else {
          // no offscreen route: run to the far end of a reachable platform
          const g = api.graph();
          const from = { seg: R.seg, x: R.x };
          const cand = g.segments
            .filter((s) => s.rect.tag !== 'ground' && s.x2 - s.x1 >= 36)
            .filter((s) => Math.sign((s.x1 + s.x2) / 2 - R.x) === away)
            .sort((a, b) => Math.abs((b.x1 + b.x2) / 2 - R.x) - Math.abs((a.x1 + a.x2) / 2 - R.x));
          for (const s of cand) {
            if (planRoute(g, from, { seg: s.id, x: (s.x1 + s.x2) / 2 })) {
              R.commandGotoSeg(s.id, clamp((s.x1 + s.x2) / 2, s.x1 + 4, s.x2 - 4), {
                noise: 0.15,
                quiet: true,
                speed: R.P.walkSpeed * 1.4,
              });
              break;
            }
          }
        }
      }
      return true; // hold the slot the whole time the hero is close
    },

    onTerrainRebuilt() {
      this.reissue = 0; // rebind cancelled the sprint; re-issue next frame
    },
  };
}
