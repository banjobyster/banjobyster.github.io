// Villain sabotage (Part 3d): pick a working station in view, dart to it,
// tamper with a quick fiddling animation, then EITHER break it (cackle plus a
// spark burst) or fumble (~35% of the time: panic face, nothing breaks). A
// success arms a ~20s cooldown so at most one station goes down per ~20s; a
// fumble retries sooner. Finishing an attempt asks exit-return to slink off.
//
// Priority 50, below flee (90), exit-return (70), and catch-up (60): getting
// away and re-entering always beat picking a new target.

import { clamp, randRange } from 'bysters/core/math.js';
import { planRoute } from 'bysters/core/path/terrain.js';
import { makeTamper } from 'bysters/core/kinematics/maneuvers.js';
import { findStations, nearestOther, cssColorToInt } from './util.js';

const SUCCESS_COOLDOWN = 12; // pacing: one successful sabotage per ~12s
const FUMBLE_COOLDOWN = 5;
const FUMBLE_CHANCE = 0.35;
const TAMPER_DUR = 0.7;
const BREAK_AT = 0.4; // tamperT value at which the jab lands the break

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
      const setStation = api.setStation;
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
        // Start the tamper on solid ground (set from the goto onDone). Decide
        // the outcome up front so the break can land ON the jab, not after a
        // full tamper: that pins a live pipeline stage before it advances and
        // makes the fault read as caused by the physical jab.
        if (R.mode === 'ground') {
          R.facing = R.x <= this.stationX ? 1 : -1;
          R.executor.maneuver = makeTamper(R, TAMPER_DUR);
          R.mode = 'maneuver';
          this.phase = 'tamper';
          this.tamperT = TAMPER_DUR;
          this.willFumble = Math.random() < FUMBLE_CHANCE;
          this.broke = false;
          R.face.set('mischief');
          d.note(`sabotage: tampering with ${this.target.name}`);
        }
        return true;
      }

      if (this.phase === 'tamper') {
        this.tamperT -= ctx.dt;
        const name = this.target.name;
        const at = { x: this.stationX, y: R.bodyY };
        // The jab lands the break partway through the tamper.
        if (!this.willFumble && !this.broke && this.tamperT <= BREAK_AT) {
          this.broke = true;
          setStation(name, 'broken');
          // Spark in the service's own accent when corrupting a card, so the
          // hit reads as "red just took THIS service down", not a generic pop.
          const el = this.target.el;
          const sparkColor =
            el.dataset.terrain === 'card'
              ? cssColorToInt(getComputedStyle(el).getPropertyValue('--accent'), 0xff8a3c)
              : 0xff8a3c;
          fx.burst(at.x, at.y - 4, sparkColor, 14);
          R.face.set('cackle', 1.6);
          // Taunt: if the hero is watching, turn and cackle right at it.
          const h = nearestOther(api, R);
          if (h && h.dist < 320) {
            R.facing = Math.sign(h.robot.x - R.x) || R.facing;
            d.lookAt(h.robot.x, h.robot.bodyY, 0.8);
          }
          d.note(`sabotage: jammed ${name}`);
        }
        if (R.mode === 'ground' && this.tamperT <= 0) {
          if (this.willFumble) {
            // Botched it: skulk off and try again soon. It stays on the page,
            // so it keeps feeling present rather than vanishing after a miss.
            R.face.set('fumble', 1.2);
            d.shrug(0.6);
            d.note(`sabotage: fumbled ${name}, nothing broke`);
            this.reset(FUMBLE_COOLDOWN);
          } else {
            R.bodyYV -= 90 * R.P.scale;
            this.reset(SUCCESS_COOLDOWN);
            mind.wantsExit = true; // vanish after actually pulling one off
          }
        }
        return true;
      }

      // phase 'none': look for a target.
      if (this.cool > 0 || R.mode !== 'ground') return false;
      const from = { seg: R.seg, x: R.x };
      const hero = nearestOther(api, R);
      const dist = (st) => Math.abs((st.s.x1 + st.s.x2) / 2 - R.x);
      const isLiveStage = (st) => (st.el.dataset.bench ? 0 : 1); // 0 sorts first
      const targets = findStations(api, 'ok')
        .filter((st) => {
          // Skip a station the hero is basically standing on; flee (priority
          // 90) already aborts the dart if the hero closes in while en route,
          // so this only needs to avoid the degenerate on-top case.
          return !hero || Math.hypot(st.s.x1 - hero.robot.x, st.s.y - hero.robot.bodyY) > 60;
        })
        // A live pipeline stage (a bench box that is a station right now) is the
        // meaningful target: red goes for the running deploy, not the nearest
        // random box. Fall back to distance for everything else.
        .sort((a, b) => isLiveStage(a) - isLiveStage(b) || dist(a) - dist(b));
      let pick = null;
      for (const st of targets) {
        if (planRoute(api.graph(), from, { seg: st.seg, x: (st.s.x1 + st.s.x2) / 2 }, R.caps)) {
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
