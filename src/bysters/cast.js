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
//   Kip and Pip, tiny twin toddlers, play tag across the machine. Their
//   poking pops card plugs, jams the pipeline, stalls the archive, and once
//   in a blue moon closes the intake itself, browning out the whole page.
//   Chunk, the field engineer, treks the trunk re-seating plugs and freeing
//   the archive reels. Otto, the conductor, lives on the pipeline console
//   and owns the head of the line: the pipeline and the intake. Nib, the
//   lamplighter, keeps to the neon at the end of the line and relights it.
//   When a visitor scrolls to the About section, every territory in the
//   cast re-aims there and the whole family drifts in for a reunion.
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

const {
  operateFixtures, followCursor, wander, watchCursor, watchNearest,
  approach, flee, caughtBy, reactTo, perch, fatigue, fleeCursor,
  avoidCursorGaze, sometimes, liveliness, mood, flourish, sleep,
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

// --- territory: a home preference, not a cage -------------------------------
// Built entirely from perch's public pick seam: every `every` seconds the
// byster settles somewhere NEAR its anchor element instead of the library
// default (the highest point on the page, which slowly migrates the whole
// cast to the top). The jitter varies the chosen spot so homing never becomes
// "always the same vertex". And one shared rule makes the reunion emergent:
// while the About section is on screen, EVERY territory re-aims at it, so the
// whole cast drifts together, then disperses home when the visitor scrolls
// on. Nothing is locked anywhere; urgent work still preempts the outing.
const GATHER_SEL = "#about .aboutBody";

function inView(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.1;
}

function anchorPoint(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX + r.width / 2, y: r.top + window.scrollY + r.height / 2 };
}

function territory(homeSel, { every = 12, dwell = 4, face = "idle", priority = 34 } = {}) {
  return perch({
    every,
    dwell,
    face,
    priority,
    pick: (p) => {
      const gathering = inView(document.querySelector(GATHER_SEL));
      const c = anchorPoint(gathering ? GATHER_SEL : homeSel) || anchorPoint(homeSel);
      if (!c) return -p.y;
      return -Math.hypot(p.x - c.x, p.y - c.y) * (0.75 + Math.random() * 0.5);
    },
  });
}

// One twin, parameterized by temperament. `other` is the sibling's name.
function twin({ name, character, other, bold }) {
  return {
    name,
    character,
    caps: TWIN_CAPS,
    speedScale: DERATE,
    spawnAt: ".device",
    behaviors: [
      // -- the tag game (asymmetric so it never becomes a stable orbit) --
      ...(bold
        ? [
            fatigue(
              approach((v) => v.name === other && !v.tags.has("caught"), { notice: 480, face: "grin", priority: 60 }),
              { runFor: 5, restFor: 3.5, face: "sleepy", tag: "winded", minPace: 0.45 },
            ),
            reactTo((v) => v.name === other && v.tags.has("caught"), { radius: 130, face: "excited", pace: 0.5, priority: 58, gaze: true }),
          ]
        : [
            caughtBy((v) => v.name === other && !v.tags.has("winded"), { radius: 52, stunFor: 2, immuneFor: 4.5, face: "dizzy" }),
            flee((v) => v.name === other && !v.tags.has("winded"), { radius: 175, face: "panic", priority: 62 }),
          ]),

      // -- stall buddy: when the sibling is winded or stunned, come sit with
      //    them, so every pause reads as "twins", never "two random sleepers"
      approach((v) => v.name === other && (v.tags.has("winded") || v.tags.has("caught")), { notice: 4000, face: "curious", priority: 42 }),

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

      // -- mimicry: copy the nearby grown-up for a bit, then get distracted --
      sometimes(reactTo((v) => v.name === "chunk", { radius: 150, face: "grit", pace: 0.55, priority: 16, gaze: true }), 0.6, { window: 7 }),
      sometimes(reactTo((v) => v.name === "otto", { radius: 150, face: "focus", pace: 0.8, priority: 16, gaze: true }), 0.6, { window: 7 }),

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

export const CAST = [
  twin({ name: "kip", character: KIP, other: "pip", bold: true }),
  twin({ name: "pip", character: PIP, other: "kip", bold: false }),

  // Chunk, the field engineer: re-seats popped card plugs and frees the
  // archive reels, in fatigue-gated shifts. While the `resting` tag is up
  // the twins stop fearing him, so the rivalry has a truce beat built in.
  {
    name: "chunk",
    character: CHUNK,
    caps: HEAVY_CAPS,
    speedScale: DERATE,
    spawnAt: ".hatch",
    behaviors: [
      fatigue(
        operateFixtures({ match: (fx) => isPort(fx) && fx.state === "cut", drive: "linked", face: "grit", priority: 60 }),
        { runFor: 8, restFor: 4.5, face: "wipe", tag: "resting", minPace: 0.4 },
      ),
      operateFixtures({ match: (fx) => isArchive(fx) && fx.state === "offline", drive: "syncing", face: "grit", priority: 56 }),
      territory(".hatch", { every: 13, dwell: 5.5, face: "wipe", priority: 32 }),
      wander(),
      watchCursor(),
      flourish(["sigh", "squint"], { every: 10.7, hold: 1.8 }),
      liveliness({ base: DERATE, vary: 0.1, every: 4.1 }),
      mood("idle"),
    ],
  },

  // Otto, the conductor: owns the head of the line. He lives ON the console
  // (tight territory cadence), restores the pipeline, reopens the intake,
  // and now and then glides over to present things to your cursor.
  {
    name: "otto",
    character: OTTO,
    caps: HEAVY_CAPS,
    speedScale: DERATE,
    spawnAt: "#ci-console",
    behaviors: [
      operateFixtures({ match: (fx) => isIntake(fx) && fx.state === "closed", drive: "open", face: "alarm", priority: 64 }),
      operateFixtures({ match: (fx) => isPipeline(fx) && fx.state === "jammed", drive: "flowing", face: "alarm", priority: 60 }),
      sometimes(followCursor({ near: 170, face: "tada" }), 0.4, { window: 12 }),
      territory("#ci-console", { every: 6.1, dwell: 7, face: "calm", priority: 30 }),
      wander(),
      watchCursor(),
      flourish(["tada", "calm"], { every: 8.9, hold: 1.6 }),
      liveliness({ base: DERATE, vary: 0.15, every: 3.4 }),
      mood("idle"),
    ],
  },

  // Nib, the lamplighter: relights the neon and prefers its glow. His
  // confinement is a preference, not a wall: the territory always pulls him
  // back to the neon, so he can explore without ever stranding.
  {
    name: "nib",
    character: NIB,
    caps: NIB_CAPS,
    speedScale: 0.6,
    spawnAt: ".contactBody",
    behaviors: [
      operateFixtures({ match: (fx) => isNeon(fx) && fx.state === "off", drive: "on", face: "happy", priority: 65 }),
      // dozing against the lever: now and then he douses his own sign by
      // accident, wakes, and relights it (with the zap). Short window + tiny
      // p, because he LIVES beside this fixture: a long active window would
      // have him flap it off-on-off for the whole window.
      sometimes(operateFixtures({ match: (fx) => isNeon(fx) && fx.state === "on", drive: "off", face: "sleepy", priority: 44 }), 0.025, { window: 5 }),
      fleeCursor({ radius: 90, face: "startle", speed: 1.5 }),
      sleep({ awakeFor: 8, sleepFor: 5.5, dim: 0.55, face: "sleepy" }),
      territory(".neonWrap", { every: 9.1, dwell: 4, face: "dream", priority: 30 }),
      wander(),
      watchNearest(),
      flourish(["dream", "peek"], { every: 12.7, hold: 2 }),
      liveliness({ base: 0.6, vary: 0.18, every: 5.2 }),
      mood("idle"),
    ],
  },
];
