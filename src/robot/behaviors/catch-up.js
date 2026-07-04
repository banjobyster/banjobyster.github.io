// Viewport catch-up: left outside the viewport, walking back IS the job.
// No teleports; the corridor graph guarantees a real route (the cable
// ladder). Claims the slot the whole time the robot is offscreen so
// ambience never fights the walk back in.

import { clamp } from 'bysters/core/math.js';
import { planRoute } from 'bysters/core/path/terrain.js';

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

      // Self-heal the walking flag: another behavior (the villain's flee,
      // exit-return, or sabotage) can preempt our walk back by issuing its own
      // goto, which cancels the executor without firing our onDone/onFail. That
      // would strand walking = true and stop us re-issuing forever. On the hero
      // a scroll-driven rebuild resets it via onTerrainRebuilt, but a robot
      // parked offscreen with no scroll never gets one. If we think we are
      // walking yet no route is live, clear it.
      if (this.walking && R.mode === 'ground' && !R.executor.active && !R.pendingGoal) {
        this.walking = false;
      }

      if (ctx.owner) return false;

      // Below the fold, judge by the standing surface, not bodyY: the body
      // sits ~22px above the feet and the head ~60px above that, so a bodyY
      // slack of +40 called a fully hidden robot "on screen" and left it
      // parked just under the edge after a mid-route cancel (every scroll
      // tick rebuilds terrain and cancels the route). Surface at the fold
      // (the ground) stays "in view"; anything deeper walks back up.
      const off = R.bodyY < s.scrollY - 40 || R.segment.y > s.scrollY + s.vh + 5;
      if (!off) {
        this.walking = false;
        return false;
      }

      if (!this.walking && this.cool <= 0 && R.mode === 'ground') {
        if (R.state === 'idle' || R.state === 'sleep' || R.state === 'wander') {
          const g = api.graph();
          // The nearest on-screen platform the robot can ACTUALLY reach. Going
          // up is tightly bounded (climb 95px, hop rise 80px) while dropping
          // down is easy (320px), so the nearest-x platform above the robot
          // often has no up-route. Picking purely by x let catch-up lock onto
          // such a platform and burn every retry on it, leaving the robot
          // stranded offscreen until a scroll happened to make a reachable
          // platform the nearest one: the "sometimes it comes back, sometimes
          // it does not" bug. Sort by x, then take the first that routes.
          const from = { seg: R.seg, x: R.x };
          const onScreen = g.segments
            .filter(
              (seg) =>
                seg.rect.tag !== 'ground' &&
                seg.x2 - seg.x1 >= 36 &&
                seg.y >= s.scrollY + 60 &&
                seg.y <= s.scrollY + s.vh - 60,
            )
            .sort(
              (a, b) =>
                Math.abs((a.x1 + a.x2) / 2 - R.x) - Math.abs((b.x1 + b.x2) / 2 - R.x),
            );
          let best = null;
          for (const seg of onScreen) {
            if (planRoute(g, from, { seg: seg.id, x: (seg.x1 + seg.x2) / 2 }, R.caps)) {
              best = seg;
              break;
            }
          }
          // The ground rides the viewport bottom and is the guaranteed reentry
          // surface, so it is the last resort when nothing on screen routes.
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
