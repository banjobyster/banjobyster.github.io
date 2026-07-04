# Bysters: implementation handoff

Hand this to the agent that will build the framework. It assumes access to the
`banjobyster.github.io` repo. The authoritative design is `FRAMEWORK_TDD.md`
(repo root); this file is the working brief that points into it.

---

You are implementing **Bysters**, a reusable framework that brings a web page to
life with **bysters**: small procedurally-animated creatures that treat the DOM as
physical terrain, sense the cursor and each other, and operate stateful elements on
the page. It is the extraction of the working robot overlay already in this repo
(`src/robot/`) into a clean, importable library. Build it test-first, in small
reviewable milestones.

## Terminology (use the owner's vocabulary)

The animated creatures are **bysters** (the framework is named after them; the
owner's handle is banjobyster). One creature is *a byster*; the cast is *bysters*;
`Bysters` (capitalized) is the package. The public API speaks byster: `bysters:`
(mount config), `world.bysters.*` (sensing), `data-byster` / `data-byster-behavior`
(markup), and `stage` for the mount handle. "Robot" appears only as the flagship
look, because Characters are creature-agnostic. Follow the TDD "Naming" note exactly.

## Step 0: read before writing anything

1. `FRAMEWORK_TDD.md` in full. It is v1.0 and its decisions are settled (Section 17);
   implement them, do not relitigate. Section 13 is your test-first acceptance spec,
   Section 15 is your milestone order, Section 4 is the module layout, Appendix A is
   the exact reuse/coupling map, Appendix B is the current-API to framework-API table.
2. `src/robot/README.md` and `SPEC.md` for how the current overlay is built.
3. Skim `src/robot/engine/` (the pure core you lift almost verbatim) and
   `src/robot/facade.js` + `src/robot/director.js` (the coupled layers you generalize).

## The mental model

Bysters is a value-neutral substrate for byster-actuated distributed state over the
DOM. A byster walks a path graph compiled from marked-up divs, senses the world
through a read-only snapshot, bids per actuator channel each frame, and transitions
opaque **Fixture** states. Every bit of meaning (which state is a "failure", who is
"good") lives in consumer config and CSS, never in the framework.

## Non-negotiable principles (from the TDD)

- **Pure core.** `bysters/core/` imports no `document`, `window`, or `pixi`. DOM lives
  only in `bysters/dom/`, Pixi only in `bysters/pixi/`. All `window.scroll*` access
  goes through an injected `Space` (TDD Section 5); removing the ~10 direct reads
  (Appendix A) is the main portability job.
- **Value-neutral Fixtures** (Section 9): multi-state elements with opaque string
  states; the rivalry is one `operateFixtures({ match, drive })` behavior with
  mirrored config, never two byster types. Acceptance test FX-4 is the proof; make it
  pass literally.
- **Per-channel arbitration** (8.2): locomotion / gaze / face / fx / interact resolve
  independently, so behaviors coexist. Fixes the single-slot bottleneck in the audit.
- **Decentralized interaction** (8.4): a byster reacts to others from its own behavior
  code via `world.bysters.named(...)`; adding a byster edits no other byster.
- **Pure-intent behaviors** (8.3): behaviors return per-channel intents, a motor
  executes and smooths them. Channel-gated semi-imperative is only a fallback.
- **Additive and degradable:** `prefers-reduced-motion` or no-WebGL means a no-op mount
  and an untouched page.
- **SOLID / composition over inheritance:** a byster HAS behaviors; no inheritance trees.

## How to work

- **Test-first.** Turn each TDD Section 13 Given/When/Then into a failing test, then
  build until green. The pure core runs headless (no DOM, no Pixi) under `vitest`
  (add it; the repo has only ESLint + Vite today). A `FixedSpace` makes the sim
  deterministic (tests PE-6, DI-2).
- **Milestone order** (Section 15), each independently reviewable and each leaving the
  existing portfolio running: **M0** (extract the pure core into `bysters/core` +
  `bysters/pixi` verbatim, introduce `Space`, behavior identical, build +
  `node scripts/check-terrain.mjs` still green) -> **M-path** (`data-walk` per-side
  surfaces + connection strategies + occlusion + reachability report; conservative
  default strategy chain) -> **M-arb** (per-channel arbiter + intents/motor + world
  sensing + built-in behavior library) -> **M-fix** (Fixtures + guards + actuate
  handshake + cascade) -> **M-cast** -> **M-inject** (port the portfolio to consume
  bysters as a local package, then delete the old `src/robot/*` in one sweep).
- **Sandbox-first, then inject.** Build a `bysters` demo sandbox (mirror the existing
  `sandbox.html` / `src/sandbox/`) exposing `window.__bysters` (the cast, graph,
  `step(dt)`, space) and a reachability overlay. Get the framework alive standalone
  before touching the real site. The portfolio must keep working at every milestone
  until the final migration sweep.

## Start here (M0 deliverable)

Scaffold the `bysters/` package per TDD Section 4 (single package, subpath exports
`bysters`, `bysters/behaviors`, `bysters/pixi`, `bysters/react`). Move
`math, ik, gait, maneuvers, executor, face, renderer, robot, overlay` into it
unchanged (Appendix A marks them reuse-as-is). Introduce `DocumentSpace` and route
every `window.scroll*` read through it. Add `vitest` and write the deterministic-core
tests (PE-1, PE-3, PE-6). Keep the live site running by having the current facade
import from the new locations. Hand back: the scaffold, green tests, an unchanged
site, and a short note on anything in the TDD that fought reality.

## Stack and constraints

React 19 + Vite 7, PixiJS 8, plain ESM JavaScript (TypeScript is acceptable for the
new package if you want a typed public API, but keep it Vite-buildable and
vitest-testable and match the repo's ESLint). Keep the NAV base-caps contract
absolute-px and re-run `scripts/check-terrain.mjs` at 1280/768/390/320 after any
terrain change (the generalized reachability report should subsume it). Preserve the
ghost-rect rule (TDD/README). WebGL screenshots are unreliable for verification;
verify the core with headless tests and integration via `window.__bysters` state
inspection, not pixels. Work on a branch, not the default branch. Do not use em
dashes anywhere in code, comments, docs, or copy (owner style rule); use commas,
colons, or hyphens.

If anything in the TDD is ambiguous or wrong once you are in the code, note it and
propose a fix rather than guessing silently. The design is settled but the map is not
the territory.

## Future roadmap (context, not your task yet)

Do NOT do these until the framework is proven and tested inside this portfolio (they
are TDD milestone M-publish):

1. Once `bysters/` is stable and the portfolio runs on it, extract the package into
   its OWN repo under the owner's GitHub profile with a full README (concept,
   quickstart, API, examples, live demo) and a published artifact (npm or git dep).
2. The portfolio then consumes `bysters` as an external dependency instead of a local
   dir, and any remaining inline copy is removed.
3. Add a dedicated **bysters showcase page** to the portfolio, linked from the top nav
   beside the dark/light toggle (what it is, a playground, a link to the repo).

The portfolio is the first consumer and the test bed; the standalone repo comes after
it is battle-tested here.
