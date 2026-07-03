// Villain sabotage (Part 3d): pick a working station in view, dart to it,
// tamper with a quick fiddling animation, then EITHER break it (cackle plus a
// spark burst) or fumble (~35% of the time: panic face, nothing breaks). A
// success arms a ~20s cooldown so at most one station goes down per ~20s; a
// fumble retries sooner. Finishing an attempt asks exit-return to slink off.
//
// Priority 50, below flee (90), exit-return (70), and catch-up (60): getting
// away and re-entering always beat picking a new target.

import { clamp, randRange } from '../engine/math.js';
import { planRoute } from '../engine/terrain.js';
import { makeTamper } from '../engine/maneuvers.js';
import { findStations, setStation, nearestOther } from './util.js';

const SUCCESS_COOLDOWN = 20; // pacing: one successful sabotage per ~20s
const FUMBLE_COOLDOWN = 6;
const FUMBLE_CHANCE = 0.35;

export function sabotage(mind) {
  return {
    name: 'sabotage',
    priority: 50,

    init() {
      this.phase = 'none'; // none | dart | arrived | tamper
      this.target = null; // { name, el, seg }
      this.cool = randRange(2, 5); // a beat before the first mischief
      this.tamperT = 0;
    },

    reset(cool) {
      this.phase = 'none';
      this.target = null;
      if (cool != null) this.cool = cool;
    },

    update(ctx) {
      const { d, R, fx, api } = ctx;
      this.cool = Math.max(0, this.cool - ctx.dt);
      if (ctx.owner) {
        if (this.phase === 'dart') this.reset(this.cool); // flee/exit took over
        return false;
      }

      if (this.phase === 'dart') {
        if (!this.target.el.isConnected || api.segFor(this.target.el) < 0) this.reset(1);
        return this.phase !== 'none';
      }

      if (this.phase === 'arrived') {
        // Start the tamper on solid ground (set from the goto onDone).
        if (R.mode === 'ground') {
          R.facing = R.x <= this.stationX ? 1 : -1;
          R.executor.maneuver = makeTamper(R, 0.8);
          R.mode = 'maneuver';
          this.phase = 'tamper';
          this.tamperT = 0.8;
          R.face.set('mischief');
          d.note(`sabotage: tampering with ${this.target.name}`);
        }
        return true;
      }

      if (this.phase === 'tamper') {
        this.tamperT -= ctx.dt;
        if (R.mode === 'ground' && this.tamperT <= 0) {
          const name = this.target.name;
          const at = { x: this.stationX, y: R.bodyY };
          if (Math.random() < FUMBLE_CHANCE) {
            R.face.set('fumble', 1.2);
            d.shrug(0.6);
            d.note(`sabotage: fumbled ${name}, nothing broke`);
            this.reset(FUMBLE_COOLDOWN);
          } else {
            setStation(name, 'broken');
            fx.burst(at.x, at.y - 4, 0xff2d6a, 12);
            R.face.set('cackle', 1.6);
            R.bodyYV -= 90 * R.P.scale;
            d.note(`sabotage: broke ${name}`);
            this.reset(SUCCESS_COOLDOWN);
          }
          mind.wantsExit = true; // duck out after any attempt
        }
        return true;
      }

      // phase 'none': look for a target.
      if (this.cool > 0 || R.mode !== 'ground') return false;
      const from = { seg: R.seg, x: R.x };
      const hero = nearestOther(api, R);
      const targets = findStations(api, 'ok')
        .filter((st) => {
          // Skip a station the hero is basically standing on; flee (priority
          // 90) already aborts the dart if the hero closes in while en route,
          // so this only needs to avoid the degenerate on-top case.
          return !hero || Math.hypot(st.s.x1 - hero.robot.x, st.s.y - hero.robot.bodyY) > 60;
        })
        .sort((a, b) => Math.abs((a.s.x1 + a.s.x2) / 2 - R.x) - Math.abs((b.s.x1 + b.s.x2) / 2 - R.x));
      let pick = null;
      for (const st of targets) {
        if (planRoute(api.graph(), from, { seg: st.seg, x: (st.s.x1 + st.s.x2) / 2 })) {
          pick = st;
          break;
        }
      }
      if (!pick) return false;

      this.target = { name: pick.name, el: pick.el, seg: pick.seg };
      this.stationX = (pick.s.x1 + pick.s.x2) / 2;
      this.phase = 'dart';
      R.wakeIfSleeping();
      R.face.set('mischief');
      d.note(`sabotage: darting at ${pick.name}`);
      R.commandGotoSeg(pick.seg, clamp(this.stationX, pick.s.x1 + 4, pick.s.x2 - 4), {
        noise: 0.1,
        quiet: true,
        speed: R.P.walkSpeed * 1.3,
        onDone: () => {
          if (this.phase === 'dart' && this.target) this.phase = 'arrived';
        },
        onFail: () => this.reset(2),
      });
      return true;
    },

    onTerrainRebuilt() {
      if (this.phase === 'dart') this.reset(0.5); // route cancelled by the rebind
    },
  };
}
