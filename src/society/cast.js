// The society: who lives where, what each byster does, and the emergent story.
// Every personality is just an ordered stack of generic library behaviors plus
// tuning; the framework knows nothing of operator vs gremlin, healthy vs
// degraded. All of that meaning is the actuator CSS and the config here.
//
// THE STORY
//   HERO      Byte (a glitch gremlin) shorts out the server rack; Pip (the
//             on-call operator) runs over and brings it back online; Sarge (the
//             floor warden) chases Byte off in tiring bursts. Byte flees only a
//             Sarge who is not winded, and slips through gaps Sarge cannot.
//             Pip also notices the cursor and follows it, friendly.
//   PROJECTS  Winnow drifts the real project cards, shying from the cursor. On
//             the shelves woven between the cards, Nix (a gremlin) fails the CI
//             pipeline, drains the datastore and jams the queue, while Dot (an
//             operator) chases behind restoring each one. Three separate scenes
//             stay put because their terrain clusters sit past jump range.
//   FOOTER    Gus keeps the platform bay: a container, a deploy rocket and a
//             monitor. He tends them, but his own tinkering sometimes knocks one
//             out, so he has to go set it right again. He is shy of the cursor.

import { LAUNCH, LAUNCH_AGILE, behaviors } from "@banjobyster/bysters";
import { CRT_TODDLER } from "./characters/crt-toddler.js";
import { GLITCH_IMP } from "./characters/glitch-imp.js";
import { SARGE } from "./characters/sarge.js";
import { WINNOW } from "./characters/winnow.js";

const {
  operateFixtures, followCursor, wander, watchCursor, watchNearest,
  approach, flee, caughtBy, reactTo, perch, fatigue, fleeCursor,
  avoidCursorGaze, sometimes, liveliness, mood, flourish,
} = behaviors;

// Scene-wide cruise derate so nobody blurs across the screen.
export const DERATE = 0.72;

// Heavier than the imp, so Sarge lumbers; the imp keeps its agile caps.
const SARGE_CAPS = { maxLaunch: 770, gravity: 2400 };
// Low gravity: big, slow, floaty leaps. Winnow drifts the cards on these.
const MOON = { maxLaunch: 900, gravity: 780 };

// The devices each operator/gremlin tends, with their healthy + degraded state
// names. states[0] is healthy, states[1] is degraded (the actuators.css
// convention), so a fixer drives toward `ok` and a gremlin toward `bad`.
const PROJECT_DEVICES = [
  { type: "ci-pipeline", ok: "running", bad: "failed" },
  { type: "database", ok: "synced", bad: "draining" },
  { type: "message-queue", ok: "flowing", bad: "backed-up" },
];
const FOOTER_DEVICES = [
  { type: "container", ok: "running", bad: "stopped" },
  { type: "deploy-rocket", ok: "shipped", bad: "held" },
  { type: "monitor", ok: "nominal", bad: "alert" },
];
// One operateFixtures per device type: an operator only bids on a device that
// is actually degraded, so with several down it heals them one at a time (the
// arbiter's incumbency keeps it on one until done). Mirror it for the gremlin.
const fixBehaviors = (devices, face) =>
  devices.map((d) =>
    operateFixtures({ match: (fx) => fx.type === d.type && fx.state === d.bad, drive: d.ok, face }),
  );
const breakBehaviors = (devices, face) =>
  devices.map((d) =>
    operateFixtures({ match: (fx) => fx.type === d.type && fx.state === d.ok, drive: d.bad, face }),
  );

export const CAST = [
  // ---- HERO: the rivalry over the server rack ----
  {
    name: "pip",
    character: CRT_TODDLER,
    caps: LAUNCH,
    speedScale: DERATE,
    spawnAt: "#hero-floor",
    behaviors: [
      operateFixtures({
        match: (fx) => fx.type === "rack" && fx.state === "degraded",
        drive: "online",
        face: "happy",
      }),
      followCursor({ face: "happy" }),
      wander(),
      watchCursor(),
      flourish(["happy", "excited"], { every: 6 }),
      liveliness({ base: DERATE, vary: 0.16, every: 3 }),
      mood("idle"),
    ],
  },
  {
    name: "sarge",
    character: SARGE,
    caps: SARGE_CAPS,
    speedScale: DERATE,
    spawnAt: "#hero-floor",
    behaviors: [
      fatigue(
        approach((v) => v.name === "byte" && !v.tags.has("caught"), { notice: 520, face: "alert" }),
        { runFor: 4, restFor: 3, face: "winded", tag: "winded" },
      ),
      reactTo((v) => v.name === "byte", { tag: "caught", radius: 200, face: "content", pace: 0.55, gaze: true }),
      perch({ every: 16, dwell: 4, face: "content", priority: 50 }),
      wander(),
      watchCursor(),
      liveliness({ base: DERATE, vary: 0.1, every: 3.6 }),
      mood("idle"),
    ],
  },
  {
    name: "byte",
    character: GLITCH_IMP,
    caps: LAUNCH_AGILE,
    speedScale: DERATE,
    spawnAt: "#hero-floor",
    behaviors: [
      caughtBy((v) => v.name === "sarge" && !v.tags.has("winded"), { radius: 56, stunFor: 2.4, immuneFor: 1.4, face: "panic" }),
      flee((v) => v.name === "sarge" && !v.tags.has("winded"), { radius: 210 }),
      operateFixtures({
        match: (fx) => fx.type === "rack" && fx.state !== "degraded",
        drive: "degraded",
        face: "mischief",
      }),
      perch({ every: 12, dwell: 3, face: "mischief", priority: 40 }),
      wander(),
      watchNearest(),
      liveliness({ base: DERATE, vary: 0.42, every: 1.3 }),
      mood("mischief"),
    ],
  },

  // ---- FEATURED PROJECTS: Winnow drifts the real cards ----
  // Scene 2 IS the projects section: Winnow spawns on the featured cards and
  // treats them as terrain, walking their tops, scaling their walls and hanging
  // beneath them. Low gravity turns her hops between cards into slow, floaty
  // leaps, and she shies away from the cursor, turning glassy when startled.
  {
    name: "winnow",
    character: WINNOW,
    caps: MOON,
    speedScale: DERATE,
    spawnAt: ".device",
    alpha: 0.6,
    behaviors: [
      fleeCursor({ radius: 240, face: "lookaway", speed: 1.6, alpha: 0.14 }),
      perch({ every: 7, dwell: 3, face: "peek", priority: 60 }),
      avoidCursorGaze(),
      wander(),
      flourish(["peek", "dream"], { every: 5 }),
      liveliness({ base: DERATE, vary: 0.26, every: 4.4 }),
      mood("idle"),
    ],
  },
  {
    name: "dot",
    character: CRT_TODDLER,
    caps: LAUNCH,
    speedScale: DERATE,
    spawnAt: "#ops-floor",
    behaviors: [
      ...fixBehaviors(PROJECT_DEVICES, "happy"),
      followCursor({ face: "happy" }),
      perch({ every: 13, dwell: 3, face: "idle", priority: 45 }),
      wander(),
      watchCursor(),
      liveliness({ base: DERATE, vary: 0.18, every: 3.2 }),
      mood("idle"),
    ],
  },
  {
    name: "nix",
    character: GLITCH_IMP,
    caps: LAUNCH_AGILE,
    speedScale: DERATE,
    spawnAt: "#ops-floor",
    behaviors: [
      ...breakBehaviors(PROJECT_DEVICES, "mischief"),
      perch({ every: 11, dwell: 2.5, face: "mischief", priority: 40 }),
      wander(),
      watchNearest(),
      liveliness({ base: DERATE, vary: 0.4, every: 1.4 }),
      mood("mischief"),
    ],
  },

  // ---- FOOTER: Gus keeps the platform bay ----
  {
    name: "gus",
    character: SARGE,
    caps: SARGE_CAPS,
    speedScale: DERATE,
    spawnAt: "#footer-floor",
    behaviors: [
      ...fixBehaviors(FOOTER_DEVICES, "content"),
      // his own tinkering occasionally knocks one out, and then he fixes it
      ...breakBehaviors(FOOTER_DEVICES, "alert").map((b) => sometimes(b, 0.22, { window: 6 })),
      fleeCursor({ radius: 150, face: "sleepy", speed: 1.3 }),
      perch({ every: 10, dwell: 4, face: "content", priority: 45 }),
      wander(),
      watchCursor(),
      liveliness({ base: DERATE, vary: 0.12, every: 3.8 }),
      mood("idle"),
    ],
  },
];
