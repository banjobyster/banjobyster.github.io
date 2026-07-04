// Cursor interplay (SPEC 4.4): a cursor sitting still nearby draws a slow,
// cautious approach that stops short. The hero has its own follow behavior,
// so this one skips that section. Never claims the slot: the creep is a
// quiet one-shot with a long cooldown.

import { randRange } from 'bysters/core/math.js';

export function curiosity() {
  return {
    name: 'curiosity',
    priority: 30,

    init() {
      this.t = 0;
      this.cool = 0;
    },

    update(ctx) {
      const { d, R, sensors: s } = ctx;
      const c = s.cursor;
      this.cool = Math.max(0, this.cool - ctx.dt);
      if (
        !c ||
        ctx.owner ||
        this.cool > 0 ||
        ctx.section === 'hero' ||
        R.state !== 'idle' ||
        R.mode !== 'ground'
      ) {
        this.t = 0;
        return false;
      }
      const dist = Math.hypot(c.x - R.x, c.y - R.bodyY);
      if (c.speed < 18 && dist > 120 && dist < 420) {
        this.t += ctx.dt;
        if (this.t > 2.2) {
          this.t = 0;
          this.cool = randRange(8, 14);
          const dir = Math.sign(c.x - R.x) || 1;
          R.face.set('suspicious', 1.6); // eyes it sideways before creeping over
          R.commandGoto(c.x - dir * 80, c.y, {
            noise: 0.5,
            speed: R.P.wanderSpeed * 0.7,
            quiet: true,
          });
          d.note('curiosity: creeping toward the idle cursor');
        }
      } else {
        this.t = 0;
      }
      return false;
    },
  };
}
