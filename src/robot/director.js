// Site behavior brain (M2): reads the page sensors and drives the robot's
// jobs. Priorities each frame: boot theater > hovered-card plug-in > section
// ambience. Noise scales inversely with stakes (SPEC 4.2b): purposeful jobs
// run near-zero noise and never stall; ambience is distractible.

import { makeWave } from './maneuvers.js';
import { clamp, randRange, choose } from './math.js';

const SECTIONS = [
  ['hero', 'header.hero'],
  ['featured', '#featured'],
  ['more', '#more'],
  ['about', '#about'],
  ['contact', '#contact'],
];

export function cssColorToInt(str, fallback) {
  if (!str) return fallback;
  const s = str.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return (r << 16) | (g << 8) | b;
  }
  m = s.match(/^#([0-9a-f]{6})/i);
  if (m) return parseInt(m[1], 16);
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return (+m[1] << 16) | (+m[2] << 8) | +m[3];
  return fallback;
}

// Face palette [off, dim, main, hot] derived from a card accent color.
function accentPalette(col) {
  const r = (col >> 16) & 255;
  const g = (col >> 8) & 255;
  const b = col & 255;
  const mix = (c, t, k) => Math.round(c + (t - c) * k);
  const dim = (mix(r, 0, 0.55) << 16) | (mix(g, 0, 0.55) << 8) | mix(b, 0, 0.55);
  const hot = (mix(r, 255, 0.75) << 16) | (mix(g, 255, 0.75) << 8) | mix(b, 255, 0.75);
  return [0, dim, col, hot];
}

export class Director {
  // api: { segFor(el), segsByTag(tag), graph(), getPageState(), emit(ev) }
  constructor(robot, effects, renderer, api) {
    this.R = robot;
    this.fx = effects;
    this.rd = renderer;
    this.api = api;
    this.sectionEls = SECTIONS.map(([name, sel]) => [name, document.querySelector(sel)]).filter(
      ([, el]) => el,
    );
    this.section = null;
    this.sectionTimer = 0;
    this.fetchSeen = 'loading';
    this.boot = { phase: 'start', t: 0, portEl: null, plugT: 0 };
    this.hover = { el: null, phase: 'none' };
    this.plugFaceT = 0;
    this.amb = { timer: 2.5, phase: null, tug: 0 };
    this.followCool = 0;
    this.curT = 0;
    this.curCool = 0;
    this.catchingUp = false;
    this.catchUpCool = 0;
    this.pokes = [];
    this.clicks = [];
    this.gazeT = 0;
    this.shrugT = 0;
    this.ledColor = cssColorToInt(
      getComputedStyle(document.documentElement).getPropertyValue('--led'),
      0x3ddc97,
    );
    this.trail = []; // capped event trail for debugging (?robot=debug)
  }

  note(msg) {
    this.trail.push(`${(performance.now() / 1000).toFixed(1)} ${msg}`);
    if (this.trail.length > 200) this.trail.shift();
  }

  update(dt, s) {
    const R = this.R;
    const page = this.api.getPageState();

    this.followCool = Math.max(0, this.followCool - dt);
    if (this.gazeT > 0) {
      this.gazeT -= dt;
      if (this.gazeT <= 0) R.gazeOverride = null;
    }
    if (this.shrugT > 0) {
      this.shrugT -= dt;
      R.headWiggle = Math.sin(this.shrugT * 26) * 0.14 * clamp(this.shrugT / 0.7, 0, 1);
      if (this.shrugT <= 0) R.headWiggle = 0;
    }

    // Fetch resolution outside the boot theater plays wherever the robot is.
    if (page.fetch !== this.fetchSeen && page.fetch !== 'loading') {
      if (this.boot.phase === 'done') {
        this.fetchSeen = page.fetch;
        this.reactToFetch(page.fetch);
      }
      // else: the boot plug phase consumes it with full theater
    }

    // Big scroll: brace a little (stumbles are disabled, this is the nod to it).
    if (s.scrollSpeed > 2200 && R.state === 'idle' && R.mode === 'ground') {
      R.heightScale = Math.max(0.82, R.heightScale - dt * 2.5);
      if (R.face.expr === 'idle') R.face.set('curious', 0.5);
    }

    this.updateSection(dt, s);
    this.updateBoot(dt, page);
    this.updateHover(dt, s);
    if (this.boot.phase === 'done' && this.hover.phase === 'none') {
      // Left outside the viewport: walking back IS the job. No teleports;
      // the corridor graph guarantees a real route (the cable ladder).
      const off = R.bodyY < s.scrollY - 40 || R.bodyY > s.scrollY + s.vh + 40;
      if (off) {
        this.updateCatchUp(dt, s);
      } else {
        this.catchingUp = false;
        this.updateCuriosity(dt, s);
        this.updateAmbient(dt, s, page);
      }
    }
  }

  updateCatchUp(dt, s) {
    const R = this.R;
    this.catchUpCool = Math.max(0, this.catchUpCool - dt);
    if (this.catchingUp || this.catchUpCool > 0 || R.mode !== 'ground') return;
    if (R.state !== 'idle' && R.state !== 'sleep' && R.state !== 'wander') return;
    const g = this.api.graph();
    let best = null;
    for (const seg of g.segments) {
      if (seg.rect.tag === 'ground') continue;
      if (seg.x2 - seg.x1 < 36) continue;
      if (seg.y < s.scrollY + 60 || seg.y > s.scrollY + s.vh - 60) continue;
      const cx = (seg.x1 + seg.x2) / 2;
      if (!best || Math.abs(cx - R.x) < Math.abs((best.x1 + best.x2) / 2 - R.x)) best = seg;
    }
    if (!best) best = g.segments.find((seg) => seg.rect.tag === 'ground');
    if (!best) return;
    this.catchingUp = true;
    this.catchUpCool = 0.6; // never re-issue in a tight loop (instant/empty routes)
    this.note('catch-up: heading back into view');
    R.commandGotoSeg(best.id, clamp(R.x, best.x1 + 4, best.x2 - 4), {
      noise: 0.15,
      quiet: true,
      speed: R.P.walkSpeed * 1.25,
      onDone: () => {
        this.catchingUp = false;
      },
      onFail: () => {
        this.catchingUp = false;
        this.catchUpCool = 1.5; // do not spin on an unreachable target
      },
    });
  }

  // Cursor interplay (SPEC 4.4): a cursor sitting still nearby draws a slow,
  // cautious approach that stops short. Hero has its own follow behavior.
  updateCuriosity(dt, s) {
    const R = this.R;
    const c = s.cursor;
    this.curCool = Math.max(0, this.curCool - dt);
    if (!c || this.curCool > 0 || this.section === 'hero' || R.state !== 'idle' || R.mode !== 'ground') {
      this.curT = 0;
      return;
    }
    const d = Math.hypot(c.x - R.x, c.y - R.bodyY);
    if (c.speed < 18 && d > 120 && d < 420) {
      this.curT += dt;
      if (this.curT > 2.2) {
        this.curT = 0;
        this.curCool = randRange(8, 14);
        const dir = Math.sign(c.x - R.x) || 1;
        R.face.set('curious', 1.4);
        R.commandGoto(c.x - dir * 80, c.y, {
          noise: 0.5,
          speed: R.P.wanderSpeed * 0.7,
          quiet: true,
        });
        this.note('curiosity: creeping toward the idle cursor');
      }
    } else {
      this.curT = 0;
    }
  }

  // Repeat pokes stop being funny to the robot pretty fast.
  onPoke() {
    const now = performance.now();
    this.pokes = this.pokes.filter((t) => now - t < 5000);
    this.pokes.push(now);
    if (this.pokes.length >= 3) {
      this.pokes = [];
      const R = this.R;
      R.face.set('glitch', 1.2);
      this.shrugT = 0.7;
      this.fx.burst(R.headX, R.headY - 10, 0xf08c3c, 6);
      const flee = R.x - R.facing * 130;
      R.commandGoto(flee, R.bodyY, { noise: 0.2, quiet: true, speed: R.P.walkSpeed * 1.3 });
      this.note('poked too much, storming off');
    }
  }

  // ---------------- boot theater ----------------

  updateBoot(dt, page) {
    const R = this.R;
    const b = this.boot;
    if (b.phase === 'done') return;
    b.t += dt;

    if (b.phase === 'start') {
      if (R.state === 'wake') return; // let the eyes flick on and look around
      const port = this.api.segsByTag('port')[0];
      if (!port) {
        // page loaded scrolled away from the hero; skip the plug theater
        this.note('boot: no port visible, skipping plug theater');
        b.phase = 'done';
        return;
      }
      b.portEl = port.rect.el;
      b.phase = 'walk';
      this.note('boot: walking to port');
      R.commandGotoSeg(port.id, (port.x1 + port.x2) / 2, {
        noise: 0.15,
        quiet: true,
        onDone: () => {
          b.phase = 'plug';
          b.plugT = 0;
          this.note('boot: arrived at port, plugging in');
        },
        onFail: () => {
          b.phase = 'done';
          this.note('boot: no route to port, skipping');
        },
      });
    } else if (b.phase === 'plug') {
      b.plugT += dt;
      if (!this.fx.plug) {
        this.fx.plugTo(b.portEl, this.ledColor);
        R.face.set('sync');
      }
      R.facing = 1; // face the page while syncing
      R.sleepTimer = Math.max(R.sleepTimer, 20);
      if (page.fetch !== 'loading' && b.plugT > 1.4) {
        this.fx.unplug();
        this.fetchSeen = page.fetch;
        this.reactToFetch(page.fetch);
        b.phase = 'done';
        this.note(`boot: unplugged, reacted to ${page.fetch}`);
      }
    }
  }

  reactToFetch(state) {
    const R = this.R;
    this.note(`fetch reaction: ${state}`);
    if (state === 'ready') {
      R.face.set('happy', 2.0);
      R.bodyYV -= 140 * R.P.scale;
      this.api.emit('synced');
    } else {
      this.fx.burst(R.x, R.bodyY + 2, 0xf08c3c, 14);
      R.face.set('glitch', 1.5);
      this.shrugT = 0.7;
      this.api.emit('offline');
    }
  }

  // ---------------- hovered card plug-in ----------------

  updateHover(dt, s) {
    const R = this.R;
    const h = this.hover;
    const el = this.boot.phase === 'done' ? s.hoverCard : null;

    if (el !== h.el) {
      if (h.phase === 'plugged') this.unplugCard();
      h.el = el;
      h.phase = 'none';
      if (el) {
        const segIx = this.api.segFor(el);
        if (segIx >= 0) {
          const seg = this.api.graph().segments[segIx];
          const port = el.querySelector('.devicePort');
          const pr = port ? port.getBoundingClientRect() : null;
          const px = pr ? pr.left + pr.width / 2 + window.scrollX : (seg.x1 + seg.x2) / 2;
          h.phase = 'walk';
          R.commandGotoSeg(segIx, clamp(px, seg.x1 + 4, seg.x2 - 4), {
            noise: 0.08,
            speed: R.P.walkSpeed * 1.15,
            quiet: true,
            onDone: () => {
              if (this.hover.el === el) this.plugCard(el);
            },
            onFail: () => {
              this.hover.phase = 'none';
            },
          });
        }
      }
      return;
    }

    if (h.phase === 'plugged') {
      R.sleepTimer = Math.max(R.sleepTimer, 20);
      if (this.plugFaceT > 0) {
        this.plugFaceT -= dt;
        if (this.plugFaceT <= 0) R.face.set('happy');
      }
    }
  }

  plugCard(el) {
    const R = this.R;
    this.hover.phase = 'plugged';
    this.note('hover: plugged into card');
    const port = el.querySelector('.devicePort') || el;
    const accent = cssColorToInt(getComputedStyle(el).getPropertyValue('--accent'), 0x3ddc97);
    this.fx.plugTo(port, accent);
    this.rd.setFacePalette(accentPalette(accent));
    R.face.set('sync'); // reading the card...
    R.face.dirty = true;
    this.plugFaceT = 1.1;
    R.facing = port === el ? R.facing : -1; // the port sits at the card's right edge
  }

  unplugCard() {
    this.fx.unplug();
    this.rd.setFacePalette(null);
    this.R.face.dirty = true;
    if (this.R.face.expr === 'sync' || this.R.face.expr === 'happy') this.R.face.set('idle');
    this.plugFaceT = 0;
  }

  // ---------------- section ambience ----------------

  updateSection(dt, s) {
    this.sectionTimer -= dt;
    if (this.sectionTimer > 0) return;
    this.sectionTimer = 0.2;
    const mid = s.scrollY + s.vh / 2;
    // A section owns the band from its top to the next section's top, so the
    // big inter-section margins never leave the robot without a job.
    let cur = null;
    for (const [name, el] of this.sectionEls) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (mid >= top - 60) cur = name;
    }
    // The footer is shorter than half a viewport, so mid-view can never
    // reach it: at the bottom of the document the last section wins.
    if (
      this.sectionEls.length &&
      s.scrollY + s.vh >= document.documentElement.scrollHeight - 40
    ) {
      cur = this.sectionEls[this.sectionEls.length - 1][0];
    }
    if (cur !== this.section) {
      this.exitSection();
      this.section = cur;
      this.note(`section: ${cur}`);
    }
  }

  exitSection() {
    const R = this.R;
    if (this.amb.phase === 'sit') {
      R.sitTarget = null;
      if (R.face.expr === 'portrait') R.face.set('idle');
    }
    if (this.amb.phase === 'hatch' && R.face.expr === 'sync') R.face.set('idle');
    this.amb = { timer: randRange(1.5, 3), phase: null, tug: 0 };
  }

  updateAmbient(dt, s, page) {
    const R = this.R;
    this.amb.timer -= dt;

    switch (this.section) {
      case 'hero': {
        const c = s.cursor;
        if (
          c &&
          this.followCool <= 0 &&
          R.state === 'idle' &&
          R.mode === 'ground' &&
          Math.abs(c.x - R.x) > 150 &&
          c.speed < 500 &&
          this.inSection('hero', c.y)
        ) {
          this.followCool = randRange(2.5, 4.5);
          R.commandGoto(c.x, c.y, { noise: 0.8, quiet: true });
        }
        if (this.amb.timer <= 0 && R.state === 'idle') {
          this.amb.timer = randRange(5, 9);
          this.wanderVisible(s);
        }
        break;
      }

      case 'featured': {
        if (this.amb.timer <= 0 && R.state === 'idle') {
          this.amb.timer = randRange(5, 9);
          const cards = this.api.segsByTag('card');
          if (cards.length) {
            const seg = choose(cards);
            R.commandGotoSeg(seg.id, randRange(seg.x1 + 10, seg.x2 - 10), {
              noise: 0.9,
              quiet: true,
            });
          } else {
            this.wanderVisible(s);
          }
        }
        break;
      }

      case 'more': {
        if (page.fetch === 'loading') {
          // reel-in theater at the hatch while repos are still in flight
          if (this.amb.phase !== 'hatch' && this.amb.phase !== 'hatch-walk') {
            const hatch = this.api.segsByTag('hatch')[0];
            if (hatch) {
              this.amb.phase = 'hatch-walk';
              R.commandGotoSeg(hatch.id, (hatch.x1 + hatch.x2) / 2, {
                noise: 0.1,
                quiet: true,
                onDone: () => {
                  this.amb.phase = 'hatch';
                  R.face.set('sync');
                  this.amb.tug = 0.4;
                },
                onFail: () => {
                  this.amb.phase = null;
                },
              });
            }
          } else if (this.amb.phase === 'hatch') {
            R.sleepTimer = Math.max(R.sleepTimer, 20);
            this.amb.tug -= dt;
            if (this.amb.tug <= 0) {
              this.amb.tug = randRange(0.7, 1.1);
              R.bodyYV -= 65 * R.P.scale; // impatient little tugs at the hatch
            }
          }
        } else {
          if (this.amb.phase === 'hatch' || this.amb.phase === 'hatch-walk') {
            this.amb.phase = null;
            if (R.face.expr === 'sync') R.face.set('happy', 1.2);
          }
          if (this.amb.timer <= 0 && R.state === 'idle') {
            this.amb.timer = randRange(6, 10);
            const repos = this.api.segsByTag('repo');
            if (repos.length) {
              const seg = choose(repos);
              R.commandGotoSeg(seg.id, randRange(seg.x1 + 8, seg.x2 - 8), {
                noise: 0.9,
                quiet: true,
                onDone: () => {
                  if (Math.random() < 0.35) {
                    R.face.set('happy', 1.0); // polishing a star
                    this.shrugT = 0.5;
                  }
                },
              });
            } else {
              this.wanderVisible(s);
            }
          }
        }
        break;
      }

      case 'about': {
        if (this.amb.phase !== 'sit' && this.amb.phase !== 'sit-walk') {
          const about = this.api.segsByTag('about')[0];
          if (about) {
            this.amb.phase = 'sit-walk';
            R.commandGotoSeg(about.id, about.x1 + 46, {
              noise: 0.3,
              quiet: true,
              onDone: () => {
                this.amb.phase = 'sit';
                R.sitTarget = 0.72;
                R.facing = 1;
                R.face.set('portrait');
                this.note('about: sitting, portrait on');
              },
              onFail: () => {
                this.amb.phase = null;
              },
            });
          }
        } else if (this.amb.phase === 'sit') {
          R.sleepTimer = Math.max(R.sleepTimer, 15);
          R.idleTimer = Math.max(R.idleTimer, 2);
        }
        break;
      }

      case 'contact': {
        if (!this.amb.phase) {
          const spot = this.api.segsByTag('contact')[0] || this.api.segsByTag('socket')[0];
          if (spot) {
            this.amb.phase = 'contact-walk';
            R.commandGotoSeg(spot.id, (spot.x1 + spot.x2) / 2, {
              noise: 0.25,
              quiet: true,
              onDone: () => {
                this.amb.phase = 'waved';
                R.facing = 1;
                R.executor.maneuver = makeWave(R);
                R.mode = 'maneuver';
                R.face.set('happy', 1.6);
                this.note('contact: waving');
              },
              onFail: () => {
                this.amb.phase = null;
              },
            });
          }
        } else if (this.amb.phase === 'waved' && R.mode === 'ground') {
          this.amb.phase = 'drowsy';
          R.sleepTimer = Math.min(R.sleepTimer, randRange(4, 7));
        }
        break;
      }

      default:
        break;
    }
  }

  // Idle wander bounded to on-screen platforms; the raw robot.startWander()
  // would happily pick a corridor node beyond the viewport.
  wanderVisible(s) {
    const R = this.R;
    const g = this.api.graph();
    const candidates = g.segments.filter(
      (seg) =>
        seg.x2 - seg.x1 >= 36 &&
        seg.y >= s.scrollY + 40 &&
        seg.y <= s.scrollY + s.vh - 20 &&
        (seg.id !== R.seg || seg.x2 - seg.x1 > 120),
    );
    if (!candidates.length) return;
    const seg = choose(candidates);
    R.commandGotoSeg(seg.id, randRange(seg.x1 + 8, seg.x2 - 8), { noise: 1, quiet: true });
  }

  inSection(name, docY) {
    const entry = this.sectionEls.find(([n]) => n === name);
    if (!entry) return false;
    const r = entry[1].getBoundingClientRect();
    const top = r.top + window.scrollY;
    return docY >= top && docY < top + r.height;
  }

  // ---------------- page clicks (hero escalation) ----------------

  onPageClick(x, y, target) {
    const R = this.R;
    if (this.boot.phase !== 'done') return;
    if (target && target.closest && target.closest('a, button, [role="button"]')) return;

    R.gazeOverride = { x, y };
    this.gazeT = 0.9;

    if (this.section !== 'hero') {
      if (R.face.expr === 'idle') R.face.set('curious', 0.8);
      return;
    }

    const now = performance.now();
    this.clicks = this.clicks.filter((t) => now - t < 4500);
    this.clicks.push(now);
    const n = this.clicks.length;
    if (n === 1) {
      R.face.set('curious', 1.0);
    } else if (n <= 3) {
      R.wakeIfSleeping();
      if (R.mode === 'ground' && R.state !== 'wake') {
        R.startle(Math.sign(R.x - x) || -R.facing);
      }
    } else {
      R.face.set('glitch', 1.1);
      this.shrugT = 0.7;
      const port = this.api.segsByTag('port')[0];
      if (port) {
        R.commandGotoSeg(port.id, (port.x1 + port.x2) / 2, {
          noise: 0.15,
          quiet: true,
          speed: R.P.walkSpeed * 1.25,
        });
      }
      this.clicks = [];
    }
  }

  // ---------------- rebuild recovery ----------------

  onTerrainRebuilt() {
    // The rebind canceled any route; re-dispatch positional work.
    this.catchingUp = false; // re-issued next frame if still offscreen
    if (this.boot.phase === 'walk') this.boot.phase = 'start';

    const h = this.hover;
    if (h.phase === 'walk') {
      h.el = null; // re-detected next frame while the pointer stays on the card
      h.phase = 'none';
    } else if (h.phase === 'plugged' && h.el && this.api.segFor(h.el) < 0) {
      this.unplugCard();
      h.el = null;
      h.phase = 'none';
    }

    if (this.amb.phase === 'hatch-walk' || this.amb.phase === 'sit-walk' || this.amb.phase === 'contact-walk') {
      this.amb.phase = null;
    } else if (this.amb.phase === 'sit' && !this.api.segsByTag('about').length) {
      this.R.sitTarget = null;
      if (this.R.face.expr === 'portrait') this.R.face.set('idle');
      this.amb.phase = null;
    }
  }
}
