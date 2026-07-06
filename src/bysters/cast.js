// The cast: who lives where, what each byster wants, and the story that
// emerges. Every personality is an ordered stack of generic library behaviors
// plus tuning; the framework stays value-neutral. All good/bad meaning (what
// counts as broken, who is naughty) lives here and in the fixture CSS.
//
// THE STORY
//   Kip and Pip, twin toddlers, play an endless game of tag across the hero
//   and the project cards. Kip is bold: he chases, follows the cursor, pokes
//   at things. Pip is shy: she flees the cursor and copies whatever grown-up
//   is nearby. Their poking sometimes cuts a project's power wire or jams the
//   deploy pipeline, purely by accident, and they scatter in a panic when the
//   engineer storms over. Chunk, the engineer, lives by the GitHub shelf and
//   heaves himself up the rail to re-link whatever the twins cut, then sits
//   on a card edge, wipes his brow and squints at the cursor as if to say: I
//   know it was you. Otto, the operator, keeps the deploy pipeline flowing
//   from the big hero console and presents it to your cursor with a ta-da.
//   Nib, the lamplighter, sleeps by the contact links and relights the neon
//   whenever someone (that would be you) switches it off.
//
// ANTI-LOOP DESIGN: every recurring beat is either fatigue-gated (chases
// breathe: run, rest, run), probability-gated via sometimes() with per-byster
// odds and windows, or cadenced with co-prime "every" values so the same two
// beats never lock into phase. liveliness() adds a per-byster random drift to
// pace so even the walk cycles never sync up.

import { LAUNCH, LAUNCH_AGILE, behaviors } from "@banjobyster/bysters";
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
// a rise of ~maxLaunch^2 / (2 * gravity) >= 80 is the price of the ladder:
// the twins (169px) climb it easily, Chunk (85px) barely heaves up it, Otto
// (85px) can but rarely wants to, and Nib stays floaty near the floor.
const TWIN_CAPS = LAUNCH_AGILE; // { maxLaunch: 900, gravity: 2400 }
const HEAVY_CAPS = LAUNCH; // { maxLaunch: 640, gravity: 2400 }
const NIB_CAPS = { maxLaunch: 700, gravity: 1700 }; // small, floaty hops

// What the twins can wreck, and who mends what. states[0] is healthy.
const isWire = (fx) => fx.type === "wire";
const isPipeline = (fx) => fx.type === "pipeline";
const isNeon = (fx) => fx.type === "neon";

// One twin, parameterized by temperament. `other` is the sibling's name.
// Shared beats: the tag game, separation anxiety, mimicry of the grown-ups,
// guilty scattering when the engineer storms in.
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
            // Kip chases in fatigue-gated bursts, gloats when he tags her.
            fatigue(
              approach((v) => v.name === other && !v.tags.has("caught"), { notice: 480, face: "grin", priority: 60 }),
              { runFor: 5, restFor: 3.5, face: "sleepy", tag: "winded", minPace: 0.45 },
            ),
            reactTo((v) => v.name === other && v.tags.has("caught"), { radius: 130, face: "excited", pace: 0.5, priority: 58, gaze: true }),
          ]
        : [
            // Pip flees a fresh Kip, and is caught if he closes the gap; the
            // stun + immunity beat is what makes the game breathe.
            caughtBy((v) => v.name === other && !v.tags.has("winded"), { radius: 52, stunFor: 2, immuneFor: 4.5, face: "dizzy" }),
            flee((v) => v.name === other && !v.tags.has("winded"), { radius: 175, face: "panic", priority: 62 }),
          ]),

      // -- guilt: scatter when the engineer storms close --
      flee((v) => v.name === "chunk" && !v.tags.has("resting"), { radius: 85, face: "panic", priority: 70 }),

      // -- accidental sabotage: rare, curious poking that goes wrong --
      sometimes(
        operateFixtures({ match: (fx) => isWire(fx) && fx.state === "linked", drive: "cut", face: "curious", priority: 44 }),
        bold ? 0.16 : 0.09,
        { window: 11 },
      ),
      sometimes(
        operateFixtures({ match: (fx) => isPipeline(fx) && fx.state === "flowing", drive: "jammed", face: "curious", priority: 44 }),
        bold ? 0.1 : 0.06,
        { window: 13 },
      ),

      // -- cursor: the bold one plays with it, the shy one skitters --
      ...(bold
        ? [sometimes(followCursor({ face: "excited", near: 70 }), 0.5, { window: 9 })]
        : [fleeCursor({ radius: 130, face: "peek", speed: 1.4 }), avoidCursorGaze()]),

      // -- mimicry: copy the nearby grown-up for a bit, then get distracted --
      sometimes(reactTo((v) => v.name === "chunk", { radius: 150, face: "grit", pace: 0.55, priority: 16, gaze: true }), 0.6, { window: 7 }),
      sometimes(reactTo((v) => v.name === "otto", { radius: 150, face: "focus", pace: 0.8, priority: 16, gaze: true }), 0.6, { window: 7 }),

      // -- separation anxiety: when idle and far apart, seek the sibling --
      approach((v) => v.name === other, { notice: 4000, face: bold ? "sad" : "cry", priority: 12 }),
      reactTo((v) => v.name === other, { radius: 120, face: "happy", priority: 14 }),

      // -- texture --
      perch({ every: bold ? 19 : 9, dwell: 3, face: bold ? "grin" : "peek", priority: 33 }),
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

  // Chunk, the engineer: mends cut wires in fatigue-gated shifts. While the
  // `resting` tag is up the twins stop fearing him (and he stops chasing
  // repairs), so the rivalry has a truce beat built in.
  {
    name: "chunk",
    character: CHUNK,
    caps: HEAVY_CAPS,
    speedScale: DERATE,
    spawnAt: ".repoCard",
    behaviors: [
      fatigue(
        operateFixtures({ match: (fx) => isWire(fx) && fx.state === "cut", drive: "linked", face: "grit", priority: 60 }),
        { runFor: 8, restFor: 4.5, face: "wipe", tag: "resting", minPace: 0.4 },
      ),
      // Off duty: sit somewhere, wipe the brow, squint at the cursor.
      perch({ every: 13, dwell: 5.5, face: "wipe", priority: 32 }),
      wander(),
      watchCursor(),
      flourish(["sigh", "squint"], { every: 10.7, hold: 1.8 }),
      liveliness({ base: DERATE, vary: 0.1, every: 4.1 }),
      mood("idle"),
    ],
  },

  // Otto, the operator: keeps the deploy pipeline flowing from the hero
  // console, and now and then glides over to present things to your cursor.
  {
    name: "otto",
    character: OTTO,
    caps: HEAVY_CAPS,
    speedScale: DERATE,
    spawnAt: "#ci-console",
    behaviors: [
      operateFixtures({ match: (fx) => isPipeline(fx) && fx.state === "jammed", drive: "flowing", face: "alarm", priority: 60 }),
      sometimes(followCursor({ near: 170, face: "tada" }), 0.4, { window: 12 }),
      perch({ every: 8.3, dwell: 6, face: "calm", priority: 30 }),
      wander(),
      watchCursor(),
      flourish(["tada", "calm"], { every: 8.9, hold: 1.6 }),
      liveliness({ base: DERATE, vary: 0.15, every: 3.4 }),
      mood("idle"),
    ],
  },

  // Nib, the lamplighter: sleeps by the contact links, relights the neon,
  // startles away from the cursor. The only chaos that reaches him is you.
  {
    name: "nib",
    character: NIB,
    caps: NIB_CAPS,
    speedScale: 0.6,
    spawnAt: ".contactBody",
    behaviors: [
      operateFixtures({ match: (fx) => isNeon(fx) && fx.state === "off", drive: "on", face: "happy", priority: 65 }),
      fleeCursor({ radius: 90, face: "startle", speed: 1.5 }),
      sleep({ awakeFor: 8, sleepFor: 5.5, dim: 0.55, face: "sleepy" }),
      perch({ every: 11.3, dwell: 4, face: "dream", priority: 30 }),
      wander(),
      watchNearest(),
      flourish(["dream", "peek"], { every: 12.7, hold: 2 }),
      liveliness({ base: 0.6, vary: 0.18, every: 5.2 }),
      mood("idle"),
    ],
  },
];
