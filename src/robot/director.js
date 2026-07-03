// The behavior host: one Director per robot. It owns the page-shaped
// plumbing every behavior needs (section tracking, the debug trail, shared
// gaze/shrug timers, wander helper) and runs registered behavior plugins in
// priority order each frame.
//
// Arbitration (SPEC 4.2b): behaviors run highest priority first; the first
// one whose update() returns true becomes ctx.owner (the frame's job
// holder). Lower behaviors still get their update called, so they can track
// state and clean up, but they are expected to check ctx.owner before
// issuing movement. The default ladder lives in behaviors/index.js:
// boot > hover-card > catch-up > pipeline > reactions > curiosity > ambience.

import { randRange, choose } from './engine/math.js';

const SECTIONS = [
  ['hero', 'header.hero'],
  ['featured', '#featured'],
  ['more', '#more'],
  ['about', '#about'],
  ['contact', '#contact'],
];

export class Director {
  // api: { segFor(el), segsByTag(tag), graph(), getPageState(), emit(ev) }
  constructor(robot, effects, renderer, api, behaviors = []) {
    this.R = robot;
    this.fx = effects;
    this.rd = renderer;
    this.api = api;
    this.sectionEls = SECTIONS.map(([name, sel]) => [name, document.querySelector(sel)]).filter(
      ([, el]) => el,
    );
    this.section = null;
    this.sectionTimer = 0;
    this.gazeT = 0;
    this.shrugT = 0;
    this.behaviors = [];
    this.trail = []; // capped event trail for debugging (?robot=debug)
    for (const b of behaviors) this.register(b);
  }

  register(behavior) {
    this.behaviors.push(behavior);
    this.behaviors.sort((a, b) => b.priority - a.priority);
    if (behavior.init) behavior.init(this.makeCtx());
    return behavior;
  }

  note(msg) {
    this.trail.push(`${(performance.now() / 1000).toFixed(1)} ${msg}`);
    if (this.trail.length > 200) this.trail.shift();
  }

  // ---------------- shared helpers for behaviors ----------------

  // Point the gaze somewhere for a moment (document coords).
  lookAt(x, y, dur = 0.9) {
    this.R.gazeOverride = { x, y };
    this.gazeT = dur;
  }

  // A head-wiggle shrug, decaying over dur seconds.
  shrug(dur = 0.7) {
    this.shrugT = dur;
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

  // ---------------- frame loop ----------------

  makeCtx(sensors = null, dt = 0) {
    return {
      d: this,
      R: this.R,
      fx: this.fx,
      rd: this.rd,
      api: this.api,
      page: this.api.getPageState(),
      section: this.section,
      sensors,
      dt,
      owner: null,
    };
  }

  update(dt, s) {
    const R = this.R;

    if (this.gazeT > 0) {
      this.gazeT -= dt;
      if (this.gazeT <= 0) R.gazeOverride = null;
    }
    if (this.shrugT > 0) {
      this.shrugT -= dt;
      R.headWiggle = Math.sin(this.shrugT * 26) * 0.14 * Math.min(Math.max(this.shrugT / 0.7, 0), 1);
      if (this.shrugT <= 0) R.headWiggle = 0;
    }

    this.updateSection(dt, s);

    const ctx = this.makeCtx(s, dt);
    for (const b of this.behaviors) {
      if (b.update && b.update(ctx) && !ctx.owner) ctx.owner = b.name;
    }
  }

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
      const prev = this.section;
      this.section = cur;
      this.note(`section: ${cur}`);
      const ctx = this.makeCtx(s, dt);
      for (const b of this.behaviors) {
        if (b.onSectionChange) b.onSectionChange(ctx, prev, cur);
      }
    }
  }

  // ---------------- event dispatch (called by the facade) ----------------

  onPoke() {
    const ctx = this.makeCtx();
    for (const b of this.behaviors) {
      if (b.onPoke) b.onPoke(ctx);
    }
  }

  onPageClick(x, y, target) {
    const ctx = this.makeCtx();
    for (const b of this.behaviors) {
      if (b.onPageClick) b.onPageClick(ctx, x, y, target);
    }
  }

  onTerrainRebuilt() {
    const ctx = this.makeCtx();
    for (const b of this.behaviors) {
      if (b.onTerrainRebuilt) b.onTerrainRebuilt(ctx);
    }
  }
}
