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
//
// More regions are appended as their terrain is built (featured cards, the
// middle band, the footer).

import { LAUNCH, LAUNCH_AGILE, behaviors } from "@banjobyster/bysters";
import { CRT_TODDLER } from "./characters/crt-toddler.js";
import { GLITCH_IMP } from "./characters/glitch-imp.js";
import { SARGE } from "./characters/sarge.js";
import { WINNOW } from "./characters/winnow.js";

const {
  operateFixtures, followCursor, wander, watchCursor, watchNearest,
  approach, flee, caughtBy, reactTo, perch, fatigue, fleeCursor,
  avoidCursorGaze, liveliness, mood, flourish,
} = behaviors;

// Scene-wide cruise derate so nobody blurs across the screen.
export const DERATE = 0.72;

// Heavier than the imp, so Sarge lumbers; the imp keeps its agile caps.
const SARGE_CAPS = { maxLaunch: 770, gravity: 2400 };
// Low gravity: big, slow, floaty leaps. Winnow drifts the cards on these.
const MOON = { maxLaunch: 900, gravity: 780 };

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
];
