// Hero repair (Part 3c): the CRT toddler is the site's caretaker. When a task
// station in the current section is broken (the villain's doing), it walks
// over, works the station for ~1.5s with the sync face (state busy), resets it
// (state ok), and gives a pleased little bounce. One repair at a time.
//
// Priority 55 sits above the pipeline toy (50) and below catch-up (60): a
// broken station outranks idle supervision, but getting back on screen still
// comes first. The job claims the slot while walking and working so nothing
// ambient fights it.

import { clamp } from 'bysters/core/math.js';
import { planRoute } from 'bysters/core/path/terrain.js';
import { findStations, cssColorToInt, accentPalette } from './util.js';

export function repair() {
  return {
    name: 'repair',
    priority: 55,

    init() {
      this.phase = 'none'; // none | walk | fix
      this.target = null; // { name, el, seg }
      this.fixT = 0;
      this.cool = 0;
    },

    // Drop the current job. If we had already flagged the station busy, hand it
    // back as broken so it does not get stuck mid-repair and someone finishes
    // the job later.
    abort(api, revertBusy) {
      if (revertBusy && this.target) api.setStation(this.target.name, 'broken');
      this.phase = 'none';
      this.target = null;
    },

    update(ctx) {
      const { d, R, api, rd } = ctx;
      this.cool = Math.max(0, this.cool - ctx.dt);
      if (ctx.owner) {
        // A higher job (catch-up walking back into view) took over; a walk in
        // progress was cancelled, so relinquish and retry once free.
        if (this.phase === 'walk') this.abort(api, false);
        return false;
      }

      if (this.phase === 'fix') {
        // If the station vanished mid-fix, drop it (nothing to flag).
        if (!this.target.el.isConnected || api.segFor(this.target.el) < 0) {
          this.abort(api, false);
          return false;
        }
        R.sleepTimer = Math.max(R.sleepTimer, 6);
        R.facing = R.x <= this.stationX ? 1 : -1; // face the station
        this.fixT -= ctx.dt;
        if (this.fixT <= 0) {
          api.setStation(this.target.name, 'ok');
          R.face.set('excited', 1.6);
          R.bodyYV -= 110 * R.P.scale;
          d.note(`repair: fixed ${this.target.name}`);
          this.phase = 'none';
          this.target = null;
          this.cool = 1.2;
        }
        return true;
      }

      if (this.phase === 'walk') {
        // Target scrolled offscreen or its element removed before arrival.
        if (!this.target.el.isConnected || api.segFor(this.target.el) < 0) this.abort(api, false);
        return this.phase !== 'none';
      }

      // phase 'none': look for work.
      if (this.cool > 0 || R.mode !== 'ground') return false;
      const broken = findStations(api, 'broken').filter(
        (st) => ctx.section && d.inSection(ctx.section, st.s.y),
      );
      if (!broken.length) return false;

      const from = { seg: R.seg, x: R.x };
      // Nearest reachable broken station.
      broken.sort(
        (a, b) => Math.abs((a.s.x1 + a.s.x2) / 2 - R.x) - Math.abs((b.s.x1 + b.s.x2) / 2 - R.x),
      );
      let pick = null;
      for (const st of broken) {
        if (planRoute(api.graph(), from, { seg: st.seg, x: (st.s.x1 + st.s.x2) / 2 }, R.caps)) {
          pick = st;
          break;
        }
      }
      if (!pick) return false;

      R.wakeIfSleeping(); // a quiet sabotage while asleep wakes the caretaker
      this.target = { name: pick.name, el: pick.el, seg: pick.seg };
      this.stationX = (pick.s.x1 + pick.s.x2) / 2;
      this.phase = 'walk';
      R.face.set('curious', 0.8); // spots the fault, heads over
      d.note(`repair: walking to ${pick.name}`);
      R.commandGotoSeg(pick.seg, clamp(this.stationX, pick.s.x1 + 4, pick.s.x2 - 4), {
        noise: 0.12,
        quiet: true,
        speed: R.P.walkSpeed * 1.2,
        onDone: () => {
          if (this.phase !== 'walk' || !this.target) return;
          this.phase = 'fix';
          this.fixT = 1.5;
          api.setStation(this.target.name, 'busy');
          R.face.set('sync');
          // Restoring a service: take on its accent while working it, so the
          // fix reads as the hero re-flashing THAT device's signal.
          const el = this.target.el;
          if (el.dataset.terrain === 'card') {
            const accent = cssColorToInt(getComputedStyle(el).getPropertyValue('--accent'), 0x3ddc97);
            rd.setFacePalette(accentPalette(accent), 2.6);
            R.face.dirty = true;
          }
          d.note(`repair: working ${this.target.name}`);
        },
        onFail: () => {
          this.abort(api, false);
          this.cool = 1.5;
        },
      });
      return true;
    },

    onTerrainRebuilt(ctx) {
      // The rebind cancelled any in-flight route; re-issue from the new graph.
      if (this.phase === 'walk') this.abort(ctx.api, false);
    },
  };
}
