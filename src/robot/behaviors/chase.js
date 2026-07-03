// Hero chase (Part 3d): when the hero notices the villain close by and on
// screen, it scowls and takes one short step toward it to shoo it off, then
// gives up. The imp always wins the footrace (its flee is top priority), so
// this never actually catches anything: it just reads as the hero telling the
// troublemaker off. A one-shot impulse on a long cooldown; it never holds the
// job slot, so real jobs (repairs, the fetch theater) always win.

import { randRange } from '../engine/math.js';
import { nearestOther } from './util.js';

const NOTICE = 250;

export function chase() {
  return {
    name: 'chase',
    priority: 35,

    init() {
      this.cool = 0;
    },

    update(ctx) {
      const { d, R, api, sensors: s } = ctx;
      this.cool = Math.max(0, this.cool - ctx.dt);
      if (ctx.owner || this.cool > 0 || R.state !== 'idle' || R.mode !== 'ground') return false;

      const other = nearestOther(api, R);
      if (!other || other.dist > NOTICE) return false;
      const v = other.robot;
      const onScreen = v.bodyY > s.scrollY - 20 && v.bodyY < s.scrollY + s.vh + 20;
      if (!onScreen) return false;

      const dir = Math.sign(v.x - R.x) || R.facing;
      R.face.set('angry', 1.2);
      R.commandGoto(v.x - dir * 40, v.bodyY, {
        noise: 0.3,
        quiet: true,
        speed: R.P.walkSpeed * 1.15,
      });
      this.cool = randRange(9, 15);
      d.note('chase: shooing the imp off');
      return false; // one-shot; do not hold the slot
    },
  };
}
