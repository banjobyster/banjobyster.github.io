// The default site behavior set, in one place so the facade (and any future
// second robot) can compose its own. Each entry is a factory returning a
// fresh stateful behavior instance; never share instances between directors.
//
// Behavior contract (see Director):
//   name                       - id, becomes ctx.owner while it claims
//   priority                   - higher runs first each frame
//   init?(ctx)                 - once at registration
//   update?(ctx) -> claim      - per frame; return true to own the job slot.
//                                ctx.owner is the higher-priority claimant so
//                                far (null if none): check it before moving
//                                the robot.
//   onSectionChange?(ctx, prev, next)
//   onPoke?(ctx)
//   onPageClick?(ctx, x, y, target)
//   onTerrainRebuilt?(ctx)
//
// The priority ladder encodes the SPEC 4.2b arbitration:
//   hero:    boot (100) > hover-card (80) > catch-up (60) > repair (55)
//            > pipeline (50) > reactions (40) > chase (35) > curiosity (30)
//            > section ambience (10)
//   villain: flee (90) > exit-return (70) > catch-up (60) > sabotage (50)
//            > reactions (40) > roam (10)

import { boot } from './boot.js';
import { hoverCard } from './hover-card.js';
import { catchUp } from './catch-up.js';
import { repair } from './repair.js';
import { pipeline } from './pipeline.js';
import { reactions } from './reactions.js';
import { chase } from './chase.js';
import { curiosity } from './curiosity.js';
import { flee } from './flee.js';
import { exitReturn } from './exit-return.js';
import { sabotage } from './sabotage.js';
import { randRange, choose } from '../engine/math.js';
import {
  heroAmbience,
  featuredAmbience,
  moreAmbience,
  aboutAmbience,
  contactAmbience,
} from './ambience.js';

export function defaultBehaviors() {
  return [
    boot(),
    hoverCard(),
    catchUp(),
    repair(),
    pipeline(),
    reactions(),
    chase(),
    curiosity(),
    heroAmbience(),
    featuredAmbience(),
    moreAmbience(),
    aboutAmbience(),
    contactAmbience(),
  ];
}

// The set for a companion robot that plays no theater: it just exists,
// wanders, follows the ladder back into view, and reacts to the cursor.
// The About sit and contact wave are left to the primary robot; two robots
// stacking on the same authored spot reads as a bug.
export function ambientBehaviors() {
  return [catchUp(), reactions(), curiosity(), heroAmbience(), featuredAmbience(), moreAmbience()];
}

// A light idle skitter for the villain between its errands, so it is not
// frozen in place while waiting out a cooldown. Low priority: any villain job
// (flee, exit, sabotage) outranks it.
function villainRoam() {
  return {
    name: 'villain-roam',
    priority: 10,
    init() {
      this.timer = randRange(2, 4);
    },
    update(ctx) {
      const { R, api, sensors: s } = ctx;
      if (ctx.owner) return false;
      this.timer -= ctx.dt;
      if (this.timer <= 0 && R.state === 'idle' && R.mode === 'ground') {
        this.timer = randRange(4, 8);
        const g = api.graph();
        const cand = g.segments.filter(
          (seg) =>
            seg.rect.tag !== 'ground' &&
            seg.x2 - seg.x1 >= 36 &&
            seg.y >= s.scrollY + 40 &&
            seg.y <= s.scrollY + s.vh - 20 &&
            (seg.id !== R.seg || seg.x2 - seg.x1 > 120),
        );
        if (cand.length) {
          const seg = choose(cand);
          R.commandGotoSeg(seg.id, randRange(seg.x1 + 8, seg.x2 - 8), {
            noise: 0.8,
            quiet: true,
            speed: R.P.wanderSpeed * 1.3,
          });
        }
      }
      return false;
    },
  };
}

// The villain set: its own director, sharing one "mind" so sabotage and flee
// can hand the exit beat to exit-return. No boot / hover / pipeline / repair.
export function villainBehaviors() {
  const mind = { wantsExit: false };
  return [flee(mind), exitReturn(mind), catchUp(), sabotage(mind), reactions(), villainRoam()];
}
