// Hero chase (Part 3d): when the hero notices the villain close by and on
// screen, it scowls and takes one short step toward it to shoo it off, then
// gives up. The imp always wins the footrace (its flee is top priority), so
// this never actually catches anything: it just reads as the hero telling the
// troublemaker off. A one-shot impulse on a long cooldown; it never holds the
// job slot, so real jobs (repairs, the fetch theater) always win. Between
// shoos it still keeps a wary eye on the imp so the two feel mutually aware.

import { randRange } from 'bysters/core/math.js';
import { nearestOther } from './util.js';

const NOTICE = 250;
const WATCH = 360;

export function chase() {
  return {
    name: 'chase',
    priority: 35,

    init() {
      this.cool = 0;
      this.glance = randRange(2, 4);
    },

    update(ctx) {
      const { d, R, api, sensors: s } = ctx;
      this.cool = Math.max(0, this.cool - ctx.dt);
      this.glance = Math.max(0, this.glance - ctx.dt);

      const other = nearestOther(api, R);
      const v = other && other.robot;
      const onScreen = v && v.bodyY > s.scrollY - 20 && v.bodyY < s.scrollY + s.vh + 20;

      // Idle wariness: track the imp with a glance even when not shooing it.
      if (
        v &&
        onScreen &&
        other.dist < WATCH &&
        this.glance <= 0 &&
        R.state === 'idle' &&
        R.mode === 'ground'
      ) {
        this.glance = randRange(3, 5);
        d.lookAt(v.x, v.bodyY, 0.7);
      }

      if (ctx.owner || this.cool > 0 || R.state !== 'idle' || R.mode !== 'ground') return false;
      if (!v || other.dist > NOTICE || !onScreen) return false;

      const dir = Math.sign(v.x - R.x) || R.facing;
      R.facing = dir; // snap round to face the troublemaker (double-take)
      d.lookAt(v.x, v.bodyY, 0.8);
      R.face.set('angry', 1.2);
      R.commandGoto(v.x - dir * 40, v.bodyY, {
        noise: 0.3,
        quiet: true,
        speed: R.P.walkSpeed * 1.15,
      });
      this.cool = randRange(15, 24);
      d.note('chase: shooing the imp off');
      return false; // one-shot; do not hold the slot
    },
  };
}
