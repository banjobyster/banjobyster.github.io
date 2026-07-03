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
//   boot (100) > hover-card (80) > catch-up (60) > pipeline (50)
//   > reactions (40) > curiosity (30) > section ambience (10)

import { boot } from './boot.js';
import { hoverCard } from './hover-card.js';
import { catchUp } from './catch-up.js';
import { pipeline } from './pipeline.js';
import { reactions } from './reactions.js';
import { curiosity } from './curiosity.js';
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
    pipeline(),
    reactions(),
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
