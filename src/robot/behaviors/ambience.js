// Section ambience (SPEC 4.4): the robot's idle jobs per section, one small
// behavior each. High noise, low priority: any purposeful job outranks them,
// and each one runs only while its section owns the mid-viewport band.

import { makeWave } from 'bysters/core/kinematics/maneuvers.js';
import { randRange, choose } from 'bysters/core/math.js';

// Hero: idle-follow the cursor, wander the visible platforms.
export function heroAmbience() {
  return {
    name: 'ambience-hero',
    priority: 10,

    init() {
      this.timer = randRange(1.5, 3);
      this.followCool = 0;
    },

    update(ctx) {
      const { R, sensors: s } = ctx;
      this.followCool = Math.max(0, this.followCool - ctx.dt);
      if (ctx.owner || ctx.section !== 'hero') return false;
      this.timer -= ctx.dt;
      const c = s.cursor;
      if (
        c &&
        this.followCool <= 0 &&
        R.state === 'idle' &&
        R.mode === 'ground' &&
        Math.abs(c.x - R.x) > 150 &&
        c.speed < 500 &&
        ctx.d.inSection('hero', c.y)
      ) {
        this.followCool = randRange(2.5, 4.5);
        R.commandGoto(c.x, c.y, { noise: 0.8, quiet: true });
      }
      if (this.timer <= 0 && R.state === 'idle') {
        this.timer = randRange(5, 9);
        ctx.d.wanderVisible(s);
      }
      return false;
    },
  };
}

// Featured: walk along the card tops.
export function featuredAmbience() {
  return {
    name: 'ambience-featured',
    priority: 10,

    init() {
      this.timer = randRange(1.5, 3);
    },

    update(ctx) {
      const { R, api, sensors: s } = ctx;
      if (ctx.owner || ctx.section !== 'featured') return false;
      this.timer -= ctx.dt;
      if (this.timer <= 0 && R.state === 'idle') {
        this.timer = randRange(5, 9);
        const cards = api.segsByTag('card');
        if (cards.length) {
          const seg = choose(cards);
          R.commandGotoSeg(seg.id, randRange(seg.x1 + 10, seg.x2 - 10), {
            noise: 0.9,
            quiet: true,
          });
        } else {
          ctx.d.wanderVisible(s);
        }
      }
      return false;
    },
  };
}

// More on GitHub: reel-in theater at the hatch while repos are in flight,
// otherwise wander the grid and polish the odd star.
export function moreAmbience() {
  return {
    name: 'ambience-more',
    priority: 10,

    init() {
      this.timer = randRange(1.5, 3);
      this.phase = null; // null | hatch-walk | hatch
      this.tug = 0;
    },

    leave(ctx) {
      if (this.phase && ctx.R.face.expr === 'sync') ctx.R.face.set('idle');
      this.phase = null;
      this.timer = randRange(1.5, 3);
    },

    onSectionChange(ctx, prev) {
      if (prev === 'more') this.leave(ctx);
    },

    onTerrainRebuilt() {
      if (this.phase === 'hatch-walk') this.phase = null;
    },

    update(ctx) {
      const { d, R, api, page, sensors: s } = ctx;
      if (ctx.owner || ctx.section !== 'more') return false;
      this.timer -= ctx.dt;

      if (page.fetch === 'loading') {
        if (!this.phase) {
          const hatch = api.segsByTag('hatch')[0];
          if (hatch) {
            this.phase = 'hatch-walk';
            R.commandGotoSeg(hatch.id, (hatch.x1 + hatch.x2) / 2, {
              noise: 0.1,
              quiet: true,
              onDone: () => {
                this.phase = 'hatch';
                R.face.set('sync');
                this.tug = 0.4;
              },
              onFail: () => {
                this.phase = null;
              },
            });
          }
        } else if (this.phase === 'hatch') {
          R.sleepTimer = Math.max(R.sleepTimer, 20);
          this.tug -= ctx.dt;
          if (this.tug <= 0) {
            this.tug = randRange(0.7, 1.1);
            R.bodyYV -= 65 * R.P.scale; // impatient little tugs at the hatch
          }
        }
        return false;
      }

      if (this.phase) {
        this.phase = null;
        if (R.face.expr === 'sync') R.face.set('happy', 1.2);
      }
      if (this.timer <= 0 && R.state === 'idle') {
        this.timer = randRange(6, 10);
        const repos = api.segsByTag('repo');
        if (repos.length) {
          const seg = choose(repos);
          R.commandGotoSeg(seg.id, randRange(seg.x1 + 8, seg.x2 - 8), {
            noise: 0.9,
            quiet: true,
            onDone: () => {
              if (Math.random() < 0.35) {
                R.face.set('happy', 1.0); // polishing a star
                d.shrug(0.5);
              }
            },
          });
        } else {
          ctx.d.wanderVisible(s);
        }
      }
      return false;
    },
  };
}

// About: sit beside the text and show the pixel portrait.
export function aboutAmbience() {
  return {
    name: 'ambience-about',
    priority: 10,

    init() {
      this.phase = null; // null | sit-walk | sit
    },

    standUp(ctx) {
      if (this.phase === 'sit') {
        ctx.R.sitTarget = null;
        if (ctx.R.face.expr === 'portrait') ctx.R.face.set('idle');
      }
      this.phase = null;
    },

    onSectionChange(ctx, prev) {
      if (prev === 'about') this.standUp(ctx);
    },

    onTerrainRebuilt(ctx) {
      if (this.phase === 'sit-walk') this.phase = null;
      else if (this.phase === 'sit' && !ctx.api.segsByTag('about').length) this.standUp(ctx);
    },

    update(ctx) {
      const { d, R, api } = ctx;
      if (ctx.owner || ctx.section !== 'about') {
        if (ctx.owner) this.standUp(ctx);
        return false;
      }
      if (!this.phase) {
        const about = api.segsByTag('about')[0];
        if (about) {
          this.phase = 'sit-walk';
          R.commandGotoSeg(about.id, about.x1 + 46, {
            noise: 0.3,
            quiet: true,
            onDone: () => {
              this.phase = 'sit';
              R.sitTarget = 0.72;
              R.facing = 1;
              R.face.set('portrait');
              d.note('about: sitting, portrait on');
            },
            onFail: () => {
              this.phase = null;
            },
          });
        }
      } else if (this.phase === 'sit') {
        R.sleepTimer = Math.max(R.sleepTimer, 15);
        R.idleTimer = Math.max(R.idleTimer, 2);
      }
      return false;
    },
  };
}

// Contact: walk to the end of the cable, wave, then get drowsy.
export function contactAmbience() {
  return {
    name: 'ambience-contact',
    priority: 10,

    init() {
      this.phase = null; // null | walk | waved | drowsy
    },

    onSectionChange(ctx, prev) {
      if (prev === 'contact') this.phase = null;
    },

    onTerrainRebuilt() {
      if (this.phase === 'walk') this.phase = null;
    },

    update(ctx) {
      const { d, R, api } = ctx;
      if (ctx.owner || ctx.section !== 'contact') return false;
      if (!this.phase) {
        const spot = api.segsByTag('contact')[0] || api.segsByTag('socket')[0];
        if (spot) {
          this.phase = 'walk';
          R.commandGotoSeg(spot.id, (spot.x1 + spot.x2) / 2, {
            noise: 0.25,
            quiet: true,
            onDone: () => {
              this.phase = 'waved';
              R.facing = 1;
              R.executor.maneuver = makeWave(R);
              R.mode = 'maneuver';
              R.face.set('wink', 1.6);
              d.note('contact: waving');
            },
            onFail: () => {
              this.phase = null;
            },
          });
        }
      } else if (this.phase === 'waved' && R.mode === 'ground') {
        this.phase = 'drowsy';
        R.sleepTimer = Math.min(R.sleepTimer, randRange(4, 7));
      }
      return false;
    },
  };
}
