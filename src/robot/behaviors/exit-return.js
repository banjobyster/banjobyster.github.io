// Villain exit-and-return (Part 3d): after a sabotage or a flee the imp ducks
// out of view on its own legs, waits a short beat (10-25s), then walks back in
// on the far side of the view from the hero, so it does not re-enter straight
// into a shoo loop. It is on the page from first load and keeps coming and
// going instead of loitering.
//
// Priority 70 sits ABOVE catch-up (60) on purpose: while the imp is meant to
// stay gone, exit-return holds the job slot so catch-up cannot immediately walk
// it back. The re-entry it commands still traverses the graph on foot,
// including the climb up from below the fold that the ghost-ground rule makes
// possible; if it cannot find a far platform it releases and lets catch-up do
// the plain re-entry.

import { clamp } from 'bysters/core/math.js';
import { planRoute } from 'bysters/core/path/terrain.js';
import { offscreenTarget, nearestOther } from './util.js';

export function exitReturn(mind) {
  return {
    name: 'exit-return',
    priority: 70,

    init() {
      this.phase = 'idle'; // idle | leaving | out | returning
      this.timer = 0;
      this.arrived = false;
      this.reissue = 0;
    },

    offscreen(ctx) {
      const { R, sensors: s } = ctx;
      return R.bodyY < s.scrollY - 40 || R.segment.y > s.scrollY + s.vh + 5;
    },

    update(ctx) {
      const { d, R, api } = ctx;
      this.reissue = Math.max(0, this.reissue - ctx.dt);
      if (ctx.owner) {
        // flee is driving; let it. A flee that ends offscreen sets
        // mind.wantsExit, which we pick up once flee releases.
        return false;
      }

      if (this.phase === 'idle') {
        if (!mind.wantsExit || R.mode !== 'ground') return false;
        mind.wantsExit = false;
        if (this.offscreen(ctx)) {
          this.phase = 'out';
          this.timer = 8 + Math.random() * 8;
          return true;
        }
        const off = offscreenTarget(api, R, 'below', planRoute, {
          hero: nearestOther(api, R)?.robot,
        });
        if (!off) return false; // nowhere to slink to; stay put
        this.phase = 'leaving';
        this.arrived = false;
        d.note('exit: slinking offscreen');
        R.commandGotoSeg(off.seg, off.x, {
          noise: 0.15,
          quiet: true,
          speed: R.P.walkSpeed * 1.2,
          onDone: () => {
            this.arrived = true;
          },
          onFail: () => {
            this.phase = 'idle';
          },
        });
        return true;
      }

      if (this.phase === 'leaving') {
        if ((this.arrived || R.state === 'idle') && this.offscreen(ctx)) {
          this.phase = 'out';
          this.timer = 8 + Math.random() * 8;
        } else if (this.arrived && !this.offscreen(ctx)) {
          this.phase = 'idle'; // ended up on screen after all; give up the exit
        }
        return this.phase !== 'idle';
      }

      if (this.phase === 'out') {
        // Wait offscreen. Holding the slot keeps catch-up (60) from pulling it
        // back before the beat is up.
        this.timer -= ctx.dt;
        R.sleepTimer = Math.max(R.sleepTimer, 12);
        if (this.timer <= 0) {
          this.phase = 'returning';
          this.reissue = 0;
        }
        return true;
      }

      // phase 'returning': walk back in, aiming for the on-screen platform
      // farthest (in x) from the hero so we get room before the next shooing.
      if (!this.offscreen(ctx) && R.state !== 'goto') {
        this.phase = 'idle';
        return false;
      }
      if (R.mode === 'ground' && this.reissue <= 0 && R.state !== 'goto') {
        this.reissue = 0.6;
        const g = api.graph();
        const { scrollY: sy, viewportH: vh } = api.space();
        const hero = nearestOther(api, R);
        const heroX = hero ? hero.robot.x : R.x;
        const from = { seg: R.seg, x: R.x };
        const onScreen = g.segments
          .filter(
            (s) =>
              s.rect.tag !== 'ground' &&
              s.x2 - s.x1 >= 36 &&
              s.y >= sy + 60 &&
              s.y <= sy + vh - 60,
          )
          .sort((a, b) => Math.abs((b.x1 + b.x2) / 2 - heroX) - Math.abs((a.x1 + a.x2) / 2 - heroX));
        let picked = false;
        for (const s of onScreen) {
          const x = (s.x1 + s.x2) / 2;
          if (planRoute(g, from, { seg: s.id, x }, R.caps)) {
            d.note('return: coming back into view');
            R.commandGotoSeg(s.id, clamp(x, s.x1 + 4, s.x2 - 4), {
              noise: 0.2,
              quiet: true,
              speed: R.P.walkSpeed * 1.25,
              onDone: () => {
                this.phase = 'idle';
              },
              onFail: () => {
                this.phase = 'idle';
              },
            });
            picked = true;
            break;
          }
        }
        if (!picked) {
          this.phase = 'idle'; // nothing routes; let catch-up handle it
          return false;
        }
      }
      return true;
    },

    onTerrainRebuilt() {
      if (this.phase === 'leaving' || this.phase === 'returning') this.phase = 'idle';
    },
  };
}
