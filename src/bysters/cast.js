// The cast: who lives where, what each byster wants, and the story that
// emerges. Every personality is an ordered stack of generic library behaviors
// plus tuning; the framework stays value-neutral. All good/bad meaning (what
// counts as broken, who is naughty) lives here and in the fixture CSS.
//
// THE MACHINE
//   The page is one system: data enters at PORT DATA-01 (the intake valve),
//   is processed by the deploy pipeline in the hero, feeds every project
//   card through its own port plug, is archived to EXT STORAGE (the tape
//   spool by the repo grid), and terminates at the footer's EOF socket,
//   where the last of the feed powers the contact neon.
//
// THE SOCIETY
//   Kip and Pip, tiny twin toddlers, play tag across the machine, idolize
//   the grown-ups (trekking over to visibly ape them), and their poking
//   pops card plugs, jams the pipeline, stalls the archive, and once in a
//   blue moon closes the intake itself, browning out the whole page.
//   Chunk, the field engineer, is the ONLY fixer: every broken station on
//   the page is his work order. Otto, the conductor, lives on the console
//   catwalk and never lifts a wrench: he presents the machine to your
//   cursor, goes into visible alarm while anything is broken, and cheers
//   when it all comes back. Nib, the lamplighter, keeps to the neon at the
//   end of the line and relights it.
//   When a visitor scrolls to the About section, every territory in the
//   cast re-aims there and the whole family drifts in for a reunion; and
//   wherever the visitor lingers, far-from-home territories project into
//   the viewport, so the reader always has company.
//
// ANTI-LOOP DESIGN: chases are fatigue-gated (run, rest, run), sabotage is
// probability-gated with windows long enough to actually complete the trek,
// cadences are co-prime so beats never lock into phase, and liveliness()
// drifts each byster's pace so not even walk cycles sync up.

import { LAUNCH_AGILE, behaviors } from "@banjobyster/bysters";
import { KIP, PIP } from "./characters/twins.js";
import { CHUNK } from "./characters/chunk.js";
import { OTTO } from "./characters/otto.js";
import { NIB } from "./characters/nib.js";
import { whimsicalPlanner } from "./planner.js";

const {
  operateFixtures, followCursor, wander, watchCursor, watchNearest,
  approach, flee, caughtBy, reactTo, perch, fatigue, fleeCursor,
  avoidCursorGaze, sometimes, liveliness, mood, flourish,
} = behaviors;

// Scene-wide cruise derate so nobody blurs across the page.
const DERATE = 0.72;

// Caps pick who can go where. The rail clips are spaced up to 80px apart, so
// a rise of ~maxLaunch^2 / (2 * gravity) >= 80 is the price of the ladder.
// Measured on the live graph (BFS per caps): the jump that gates the project
// cards needs launch > 660; below it the whole cluster is unreachable, with
// one-way drops that could strand a byster. 700 clears it with margin while
// keeping the heavies visibly slower than the twins; their weight lives in
// walk tuning, not caps.
const TWIN_CAPS = LAUNCH_AGILE; // { maxLaunch: 900, gravity: 2400 }
const HEAVY_CAPS = { maxLaunch: 700, gravity: 2400 };
const NIB_CAPS = { maxLaunch: 700, gravity: 1700 }; // small, floaty hops

// The stations of the machine, by fixture type.
const isPort = (fx) => fx.type === "port";
const isPipeline = (fx) => fx.type === "pipeline";
const isIntake = (fx) => fx.type === "intake";
const isArchive = (fx) => fx.type === "archive";
const isNeon = (fx) => fx.type === "neon";

// --- the machine's health, in one table ------------------------------------
// Every station: what broken and healthy look like, and whose job it is.
// This single table powers Chunk's work order (owner: chunk, in triage
// order: the page-wide outage first), Nib's lamplighting (owner: nib), and
// Otto's alarm/all-clear (any bad state at all). Add a station here and
// everyone's behavior follows.
const STATIONS = [
  { match: isIntake, bad: "closed", good: "open", owner: "chunk" },
  { match: isPipeline, bad: "jammed", good: "flowing", owner: "chunk" },
  { match: isPort, bad: "cut", good: "linked", owner: "chunk" },
  { match: isArchive, bad: "offline", good: "syncing", owner: "chunk" },
  { match: isNeon, bad: "off", good: "on", owner: "nib" },
];
const isBroken = (fx) => STATIONS.some((s) => s.match(fx) && fx.state === s.bad);

// One byster, one work order: try each owned job in table order and bid the
// first that has work, so a single fatigue shift can govern all of it. Each
// line is the same generic operator; triage priority is just row order.
function workOrder(owner, { priority = 60, face = "grit" } = {}) {
  const ops = STATIONS.filter((s) => s.owner === owner).map((s) =>
    operateFixtures({ match: (fx) => s.match(fx) && fx.state === s.bad, drive: s.good, face, priority }),
  );
  const trekFace = mood(face, { priority });
  return {
    id: `work-order-${owner}`,
    priority,
    channels: ["locomotion", "interact", "face"],
    update(world, self) {
      for (const op of ops) {
        const bid = op.update(world, self);
        // wear the work face for the whole call-out, trek included, so a
        // byster en route to a job never reads as loitering
        if (bid) return { ...trekFace.update(world, self), ...bid };
      }
      return null;
    },
  };
}

// --- territory: a home preference, not a cage -------------------------------
// Built entirely from perch's public pick seam: every `every` seconds the
// byster settles somewhere NEAR its anchor element instead of the library
// default (the highest point on the page, which slowly migrates the whole
// cast to the top). The jitter varies the chosen spot so homing never becomes
// "always the same vertex". Two shared rules make the social beats emergent:
// while the About section is on screen, EVERY territory re-aims at it (the
// reunion); and a home anchor far outside the current viewport aims at its
// projection INTO the viewport instead (same x, y clamped inside), so
// whoever is reading always has company. Both are biases, never cages;
// urgent work still preempts the outing.
const GATHER_SEL = "#about .aboutBody";

// Viewport top in page coordinates. The one scroll read, so headless
// verification can simulate any reading position by stubbing window.scrollY
// (and window.innerHeight) without real scrolling.
const viewTop = () => window.scrollY || 0;

function inView(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const d = document.documentElement.getBoundingClientRect();
  const top = viewTop();
  const vh = window.innerHeight || 800;
  return r.top - d.top < top + vh * 0.85 && r.bottom - d.top > top + vh * 0.1;
}

// An element's center in page coordinates via pure rect math (no scroll
// read), so anchors stay correct under a stubbed viewport.
function pageAnchor(el) {
  const r = el.getBoundingClientRect();
  const d = document.documentElement.getBoundingClientRect();
  return { x: r.left - d.left + r.width / 2, y: r.top - d.top + r.height / 2 };
}

// Anchors near the view keep zone rules; far-off ones project into it.
function towardView(c) {
  const top = viewTop();
  const vh = window.innerHeight || 800;
  if (c.y > top - vh * 0.5 && c.y < top + vh * 1.5) return c;
  const m = vh * 0.22;
  return { x: c.x, y: Math.min(Math.max(c.y, top + m), top + vh - m) };
}

function territory(homeSel, { every = 12, dwell = 4, face = "idle", priority = 34 } = {}) {
  return perch({
    every,
    dwell,
    face,
    priority,
    pick: (p) => {
      const gathering = inView(document.querySelector(GATHER_SEL));
      const el = document.querySelector(gathering ? GATHER_SEL : homeSel) || document.querySelector(homeSel);
      if (!el) return -p.y;
      const c = towardView(pageAnchor(el));
      return -Math.hypot(p.x - c.x, p.y - c.y) * (0.75 + Math.random() * 0.5);
    },
  });
}

// --- mimicry, made legible ---------------------------------------------------
// A twin picks a grown-up, treks over, and falls in step BESIDE it: a
// copycat face, the adult's pace, eyes locked on the model. approach +
// reactTo merged into ONE behavior so a single sometimes() gates the whole
// episode (trek and copy never desync) and the copy channels override the
// trek's while the adult is within `beside`.
// The trek runs against a shifted world view in which the model stands
// `gap` px to the side (picked once per episode, so the shadow never crosses
// through its model), landing the copycat NEXT to its idol, never
// underneath it: model and mini stay side by side where the impression can
// actually be seen.
// The impression tracks the model's MOMENT, not a frozen caricature:
// `moment(world, model)` names the face for what the model is visibly doing
// right now, from what a twin can legitimately sense (broadcast tags, the
// machine's state), so a resting Chunk gets a flopped-down copy beside him,
// not an angry one. Stance follows for free: a stopped model stops the
// trek's goal, so the mini idles beside it.
function mimic(adult, { moment, pace: paceMul, beside = 150, gap = 110, priority = 72 } = {}) {
  const trek = approach((v) => v.name === adult, { notice: Infinity, face: "curious", priority });
  const copy = reactTo((v) => v.name === adult, { radius: beside, pace: paceMul, gaze: true, priority });
  const faces = {}; // face name -> a mood() that bids it, created on demand
  const faceBid = (name, world, self) => (faces[name] || (faces[name] = mood(name, { priority }))).update(world, self);
  return {
    id: `mimic-${adult}`,
    priority,
    channels: [...new Set([...trek.channels, ...copy.channels, "face"])],
    _side: null,
    update(world, self) {
      const aside = {
        ...world,
        bysters: {
          ...world.bysters,
          nearestMatching: (s, pred, radius) => {
            const t = world.bysters.nearestMatching(s, pred, radius);
            if (!t) return null;
            if (this._side == null) this._side = Math.sign(s.x - t.x) || 1;
            return { ...t, x: t.x + this._side * gap };
          },
        },
      };
      // never stand ON the model: where terrain is sparse the vertex nearest
      // the offset point can be the model's own, so veto its personal space
      // from the trek's options (falling back to everything if that empties)
      const real = world.bysters.nearestMatching(self, (v) => v.name === adult, Infinity);
      let trekSelf = self;
      if (real) {
        const keep = new Set();
        for (const id of self.reachable) {
          const p = world.nav.vertexPoint(id);
          if (!p || Math.hypot(p.x - real.x, p.y - real.bodyY) > 48) keep.add(id);
        }
        if (keep.size) trekSelf = { ...self, reachable: keep };
      }
      const go = trek.update(aside, trekSelf);
      const ape = copy.update(world, self);
      if (!go && !ape) {
        this._side = null;
        return null;
      }
      const model = ape ? world.bysters.nearestMatching(self, (v) => v.name === adult, beside) : null;
      const impression = model ? faceBid(moment(world, model), world, self) : null;
      return { ...(go || {}), ...(ape || {}), ...(impression || {}) };
    },
  };
}

// --- the conductor's temperament ---------------------------------------------
// Otto never fixes anything. While ANY station is bad he makes it everyone's
// problem: alarm face, agitated pace, quick pacing of his catwalk (the same
// territory primitive on a frantic cadence). The gate is the machine's
// health, read from the same store the operators use.
function conductorAlarm({ priority = 58 } = {}) {
  const pacing = territory("#ci-console", { every: 2.1, dwell: 0.9, face: "alarm", priority });
  const siren = mood("alarm", { priority });
  const surge = liveliness({ base: DERATE * 1.55, vary: 0.25, every: 0.9, priority });
  return {
    id: "conductor-alarm",
    priority,
    channels: ["locomotion", "face", "pace"],
    update(world, self) {
      if (!world.fixtures || !world.fixtures.all().some(isBroken)) return null;
      return { ...siren.update(world, self), ...surge.update(world, self), ...(pacing.update(world, self) || {}) };
    },
  };
}

// Brownout protocol: while the intake is shut the WHOLE page is starving,
// so the engineer double-times it, tired or not. A pace bid one notch above
// his work order, so it outranks the fatigue wind-down without touching the
// shift clock; everything else about the trek is unchanged.
function brownoutHustle({ priority = 61, pace = 1.2 } = {}) {
  const hustle = liveliness({ base: pace, vary: 0.08, every: 1.3, priority });
  return {
    id: "brownout-hustle",
    priority,
    channels: ["pace"],
    update(world, self) {
      const down = world.fixtures && world.fixtures.all().some((fx) => isIntake(fx) && fx.state === "closed");
      return down ? hustle.update(world, self) : null;
    },
  };
}

// ...and the payoff: the moment the last fault clears, a tada burst, so a
// repair lands as a scene (Chunk wipes his brow, Otto takes the credit).
function conductorCheer({ priority = 57, hold = 3.4 } = {}) {
  const cheer = mood("tada", { priority });
  const bounce = liveliness({ base: DERATE * 1.4, vary: 0.35, every: 0.7, priority });
  return {
    id: "conductor-cheer",
    priority,
    channels: ["face", "pace"],
    _broken: false,
    _left: 0,
    update(world, self) {
      if (!world.fixtures) return null;
      const broken = world.fixtures.all().some(isBroken);
      if (this._broken && !broken) this._left = hold;
      this._broken = broken;
      if (broken || this._left <= 0) return null;
      this._left -= world.dt || 0;
      return { ...cheer.update(world, self), ...bounce.update(world, self) };
    },
  };
}

// One twin, parameterized by temperament. `other` is the sibling's name.
function twin({ name, character, other, bold }) {
  return {
    name,
    character,
    caps: TWIN_CAPS,
    speedScale: DERATE,
    spawnAt: ".device",
    planner: whimsicalPlanner(WHIMSY.twins),
    behaviors: [
      // -- the tag game (asymmetric so it never becomes a stable orbit).
      //    fatigue() here is re-skinned as a toddler attention span: Kip does
      //    not get TIRED (he is tiny, he never tires), he gets DISTRACTED
      //    (curious face, dawdling pace) and then remembers the game --
      ...(bold
        ? [
            fatigue(
              approach((v) => v.name === other && !v.tags.has("caught"), { notice: 480, face: "grin", priority: 60 }),
              { runFor: 5, restFor: 3.5, face: "curious", tag: "distracted", minPace: 0.45 },
            ),
            reactTo((v) => v.name === other && v.tags.has("caught"), { radius: 130, face: "excited", pace: 0.5, priority: 58, gaze: true }),
          ]
        : [
            caughtBy((v) => v.name === other && !v.tags.has("distracted"), { radius: 52, stunFor: 2, immuneFor: 4.5, face: "dizzy" }),
            flee((v) => v.name === other && !v.tags.has("distracted"), { radius: 175, face: "panic", priority: 62 }),
          ]),

      // -- stall buddy: when the sibling is distracted or stunned, come hang
      //    around them, so every pause reads as "twins", never two sleepers
      approach((v) => v.name === other && (v.tags.has("distracted") || v.tags.has("caught")), { notice: 4000, face: "curious", priority: 42 }),

      // -- guilt: scatter when the engineer storms close --
      flee((v) => v.name === "chunk" && !v.tags.has("resting"), { radius: 85, face: "panic", priority: 70 }),

      // -- accidental sabotage: rare, and the window is long enough to
      //    actually complete the trek to the fixture (short windows abort
      //    mid-journey and nothing ever breaks) --
      sometimes(
        operateFixtures({ match: (fx) => isPort(fx) && fx.state === "linked", drive: "cut", face: "curious", priority: 44 }),
        bold ? 0.16 : 0.08,
        { window: bold ? 28 : 32 },
      ),
      sometimes(
        operateFixtures({ match: (fx) => isPipeline(fx) && fx.state === "flowing", drive: "jammed", face: "curious", priority: 44 }),
        bold ? 0.14 : 0.08,
        { window: bold ? 33 : 41 },
      ),
      sometimes(
        operateFixtures({ match: (fx) => isArchive(fx) && fx.state === "syncing", drive: "offline", face: "curious", priority: 44 }),
        bold ? 0.16 : 0.1,
        { window: bold ? 35 : 43 },
      ),
      // the big one: only the bold twin, and only once in a long while. The
      // window is SHORT on purpose: Otto reopens the intake within seconds,
      // and a long active window would let Kip re-close it in a brownout
      // flap loop. Short window + tiny p = one accident per ~10 minutes,
      // and only when he already happens to be near the hero.
      ...(bold
        ? [sometimes(operateFixtures({ match: (fx) => isIntake(fx) && fx.state === "open", drive: "closed", face: "curious", priority: 44 }), 0.012, { window: 8 })]
        : []),

      // -- cursor: the bold one plays with it, the shy one skitters --
      ...(bold
        ? [sometimes(followCursor({ face: "excited", near: 70 }), 0.5, { window: 9 })]
        : [fleeCursor({ radius: 130, face: "peek", speed: 1.4 }), avoidCursorGaze()]),

      // -- mimicry: idolize the grown-ups. Trek over, fall in step, and APE
      //    what they are doing right now: Chunk's brow-slash scowl at a
      //    heavy crawl (or a flopped-down nap when he is resting), Otto's
      //    gauge-and-graph dashboard at a conductor's stride (or wide-eyed
      //    panic while he is alarming), eyes pinned on the model the whole
      //    time. Windows are long so an episode reads as a scene, not a
      //    flicker, and while it runs the twin even forgets to be scared of
      //    the engineer (priority above the guilt flee) --
      sometimes(
        mimic("chunk", { pace: 0.42, moment: (w, model) => (model.tags.has("resting") ? "sleepy" : "mimicChunk") }),
        0.4,
        { window: bold ? 15 : 17 },
      ),
      sometimes(
        mimic("otto", { pace: 1.25, moment: (w) => (w.fixtures && w.fixtures.all().some(isBroken) ? "panic" : "mimicOtto") }),
        0.4,
        { window: bold ? 19 : 23 },
      ),

      // -- separation anxiety: when idle and far apart, seek the sibling --
      approach((v) => v.name === other, { notice: 4000, face: bold ? "sad" : "cry", priority: 24 }),
      reactTo((v) => v.name === other, { radius: 120, face: "happy", priority: 14 }),

      // -- texture --
      territory(".cards", { every: bold ? 16 : 9.7, dwell: 3, face: bold ? "grin" : "peek", priority: 33 }),
      wander(),
      watchCursor(),
      flourish(bold ? ["excited", "grin"] : ["peek", "happy"], { every: bold ? 5 : 7.3 }),
      liveliness({ base: DERATE, vary: bold ? 0.5 : 0.38, every: bold ? 1.2 : 1.9 }),
      mood(bold ? "happy" : "idle"),
    ],
  };
}

// Route temperament, through the framework's planner seam: the twins take
// gleefully scenic near-ties, Nib meanders, the working adults stay mostly
// efficient with just enough variance to never grind one staircase.
const WHIMSY = { twins: 0.9, chunk: 0.25, otto: 0.2, nib: 0.7 };

// Cast order is draw order (each renderer is added to the stage in turn), so
// the big adults come first and the tiny bysters last: when a copycat twin
// stands beside its model, the small one is always the one in front.
export const CAST = [
  // Chunk, the field engineer, THE fixer: every broken station on the page
  // is one work order (intake, pipeline, card ports, archive, in triage
  // order), worked in fatigue-gated shifts long enough to finish a full
  // cross-page trek. While the `resting` tag is up the twins stop fearing
  // him, so the rivalry has a truce beat built in.
  {
    name: "chunk",
    character: CHUNK,
    caps: HEAVY_CAPS,
    speedScale: DERATE,
    spawnAt: ".hatch",
    planner: whimsicalPlanner(WHIMSY.chunk),
    behaviors: [
      fatigue(workOrder("chunk", { priority: 60 }), { runFor: 30, restFor: 2.8, face: "wipe", tag: "resting", minPace: 0.7 }),
      brownoutHustle(),
      territory(".hatch", { every: 13, dwell: 5.5, face: "wipe", priority: 32 }),
      wander(),
      watchCursor(),
      flourish(["sigh", "squint"], { every: 10.7, hold: 1.8 }),
      liveliness({ base: DERATE, vary: 0.1, every: 4.1 }),
      mood("idle"),
    ],
  },

  // Otto, the conductor: lives on the console catwalk and never repairs a
  // thing. He patrols the console, presents the machine to your cursor with
  // a tada, panics visibly (alarm face, frantic catwalk pacing) while
  // anything on the page is broken, and cheers the moment it all clears.
  {
    name: "otto",
    character: OTTO,
    caps: HEAVY_CAPS,
    speedScale: DERATE,
    spawnAt: "#ci-console",
    planner: whimsicalPlanner(WHIMSY.otto),
    behaviors: [
      conductorAlarm(),
      conductorCheer(),
      sometimes(followCursor({ near: 170, face: "tada" }), 0.45, { window: 11 }),
      territory("#ci-console", { every: 5.9, dwell: 4.5, face: "calm", priority: 30 }),
      wander(),
      watchCursor(),
      flourish(["tada", "calm"], { every: 8.9, hold: 1.6 }),
      liveliness({ base: DERATE, vary: 0.15, every: 3.4 }),
      mood("idle"),
    ],
  },

  // Nib, the lamplighter: a tiny moth of a byster. He tends the sign he
  // loves, meanders (whimsical routes), and is achingly shy: he creeps
  // toward the twins when they visit the bottom of the page, bolts the
  // moment they get close, and hides from being looked at. No sleeping, no
  // stopping: he is small, small things do not tire. His confinement is a
  // preference, not a wall: the territory always pulls him back to the
  // neon, so he can explore without ever stranding.
  {
    name: "nib",
    character: NIB,
    caps: NIB_CAPS,
    speedScale: 0.6,
    spawnAt: ".contactBody",
    planner: whimsicalPlanner(WHIMSY.nib),
    behaviors: [
      workOrder("nib", { priority: 65, face: "happy" }),
      // brushing the lever: now and then he douses his own sign by accident
      // and relights it (with the zap). The window is barely longer than one
      // actuation, because he LIVES beside this fixture: any window that fits
      // a second flip becomes a douse-relight flap loop with his own
      // lamplighting. p keeps the same accident rate (~1 per 3 min).
      sometimes(operateFixtures({ match: (fx) => isNeon(fx) && fx.state === "on", drive: "off", face: "startle", priority: 44 }), 0.01, { window: 2 }),
      fleeCursor({ radius: 90, face: "startle", speed: 1.5 }),
      // the shy-kid loop: fascinated by the twins from a distance, gone the
      // moment they close in
      flee((v) => v.name === "kip" || v.name === "pip", { radius: 70, face: "startle", priority: 72 }),
      approach((v) => v.name === "kip" || v.name === "pip", { notice: 300, face: "peek", priority: 36 }),
      avoidCursorGaze(),
      territory(".neonWrap", { every: 9.1, dwell: 4, face: "dream", priority: 30 }),
      wander(),
      watchNearest(),
      flourish(["dream", "peek", "happy"], { every: 9.7, hold: 2 }),
      liveliness({ base: 0.6, vary: 0.3, every: 2.6 }),
      mood("idle"),
    ],
  },

  twin({ name: "kip", character: KIP, other: "pip", bold: true }),
  twin({ name: "pip", character: PIP, other: "kip", bold: false }),
];
