# The robot overlay

The animated crawler(s) that live on the portfolio. A small cast of Pixar-styled
CRT machines treats the DOM layout as physical terrain, walks it on procedurally
animated legs, and acts out a little rivalry over the page's "task stations."

This directory is a self-contained module. **Site code imports one thing from it:
`facade.js` (`mountRobot`).** Nothing else here is part of the site's public
surface. See SPEC.md sections 4 and 5 for the product intent; this README is the
implementation map.

```
src/robot/
  engine/           character-agnostic core (no knowledge of THIS robot or THIS site)
    math.js         helpers: clamp/lerp/spring/qbez/easing/rot2d/random
    terrain.js      DOM rects -> nav graph (typed edges) + A* planner + NAV limits
    robot.js        body state, FSM, sensors, locomotion; also holds the face
    gait.js         step scheduler (which foot swings, when)
    face.js         low-res pixel face buffer + expression renderer
    maneuvers.js    authored moves: hop / drop / climb / wave / tamper
    executor.js     runs a planned route step by step (stumbles DISABLED)
    renderer.js     Pixi draw edge: legs, body, head, ground shadow, face blit
    ik.js, overlay.js  leg helpers; the full-page transparent Pixi canvas
  characters/       what makes a robot look/tune like ITSELF
    crt-toddler.js  the hero: beige monitor, green face, blue chest (SPEC 4.1)
    glitch-imp.js   the villain: warm cherry gremlin, amber face (Part 3d)
  behaviors/        director plugins (the "brain"); one file per behavior
    index.js        the composed sets: defaultBehaviors() / villainBehaviors()
    util.js         shared helpers (station lookup, nearest-other-robot, palettes)
    boot / hover-card / catch-up / repair / pipeline / reactions / chase /
    curiosity / ambience   (hero)
    flee / exit-return / sabotage   (villain)
  director.js       one per robot: section tracking, the plugin host, shared timers
  effects.js        per-robot diegetic FX: plug cable, sparks, sleep Zzz
  station-fx.js     shared FX: electrical fault sparks sputtering off broken stations
  facade.js         THE integration surface: mount a cast, wire it to the page
```

## Layering, top to bottom

- **engine/** knows nothing about this robot or this site. It is a reusable
  little locomotion engine: give it axis-aligned rects and a character
  definition and it walks. `P.scale` multiplies every authored motion offset in
  `gait.js`/`maneuvers.js`; it never touches the terrain NAV constants (those are
  absolute CSS px, see below).
- **characters/** are pure data + draw functions: proportions, palette, leg
  style, the face expression table, and `buildBody`/`buildHead` graphics. Swapping
  the character is how the hero and villain differ; the engine is identical.
- **behaviors/** are the brain. Each is a small plugin the `Director` runs in
  priority order every frame. They read sensors and the page and issue high-level
  commands (`commandGotoSeg`, `face.set`). They never reach into the
  engine's internals beyond the documented robot API.
- **facade.js** is the only thing the site touches. It boots the Pixi canvas,
  builds the cast, owns the terrain graph and sensors, and drives everyone each
  frame.

## The facade: `mountRobot(opts)`

```js
const handle = await mountRobot({
  getPageState,          // () => ({ fetch: 'loading'|'ready'|'error', repoCount, ... })
  stations,              // the station store (single source of truth; see below)
  robots,                // optional: [{ character, behaviors }]; default is hero + villain
});
// handle: { unmount(), goto(el), setExpression(name, hold), on(ev, cb) }
```

- **One canvas, one world, one graph, one sensor set** are shared by the whole
  cast. Each robot gets its own `Robot`, `RobotRenderer`, `Effects`, and
  `Director`. `robots[0]` is the **primary** (the hero): `handle.goto` /
  `setExpression` and the emitted `arrive/sleep/wake/synced/offline` events all
  operate on it.
- **Default cast** (no `opts.robots`): the CRT toddler with `defaultBehaviors()`
  plus the glitch imp with `villainBehaviors()`. A caller can override with
  `opts.robots`; extra robots with no behavior set get the plain
  `ambientBehaviors()`.
- **Coordinate model:** robot logic runs in **document space**; the Pixi world
  container is offset by `-scroll` each frame, so routes and in-flight maneuvers
  survive scrolling. The synthesized ground rect rides the viewport bottom edge.
- **`window.__robot`** (only with `?robot=debug`): `{ robot, robots, director,
  effects, app, graph(), rebuild(), step(seconds), stations, setStation(n,s),
  stationState(n) }`. `step(s)` advances the whole sim deterministically (for
  occluded tabs where rAF is frozen). Read `director.trail` (a capped event log)
  instead of polling.

### Auto-terrain contract

Terrain is discovered from the live DOM, never hand-registered:

- Any element tagged **`data-terrain="<role>"`** is a robot platform. The facade
  re-queries `document.querySelectorAll('[data-terrain]')` on a **debounced (150ms)
  rebuild**, triggered by `scroll`, `resize`, **and a `ResizeObserver` on
  `document.body`** (live data swaps, font/image load, and reflow all move the
  layout). Add a new `data-terrain` element anywhere and the cast picks it up on
  the next rebuild; no wiring required.
- On rebuild every robot is **rebound** to the element it was standing on (feet
  and body shift with it, no teleport). A robot left far offscreen is quietly
  repositioned onto a corridor platform just beyond the near edge **while unseen**,
  then walks/climbs back in on its own legs. The corridor band extends ~600px past
  the viewport so a left-behind robot always has a real route home.
- **The ghost-rect rule (do not regress).** The synthesized full-width ground rect
  at the viewport bottom carries a `ghost: true` flag, and `compileTerrain`'s
  climb-blocker check skips ghost rects. Without it, every climb that crosses the
  viewport-bottom edge is severed and a robot below the fold can never climb back
  in. Any new synthesized rect that is a walkable *line* rather than a solid box
  needs the same flag. The villain's re-entry from below the fold depends on this.

### Terrain NAV contract (BINDING, SPEC 4.2c)

`terrain.js` `NAV` limits are **absolute CSS px** and deliberately do **not**
scale with any character's `P.scale` (layouts are authored in px): hop gap 6–120px
/ rise ≤80px, corner-climb wall ≤95px with ~12px of approach space beside it, drop
≤320px, standable width ~40px. The page ground plus the platforms must form a
**connected** graph via **the base NAV moves** at every breakpoint (that is the
binding contract; the heavy hero plans with exactly these). Any layout change to a
`data-terrain` element requires re-running `scripts/check-terrain.mjs` at
1280/768/390/320. **Hover states on terrain elements must never transform their
rects.**

**Per-character caps (Part 4).** The base contract above is unchanged; a nimble
character just gets *more*. The live overlay graph is compiled to a permissive
superset, `NAV_AGILE` (`compileTerrain(rects, NAV_AGILE)` in the facade), and
every transition edge is tagged with the geometry that gates it (`req`).
`planRoute(graph, start, goal, caps)` then filters edges by the planning robot's
`caps`, and each `Robot` carries `caps = P.nav || NAV`. So the hero (no `P.nav`)
routes over exactly the base subset (its verified connectivity is unchanged), and
the imp (`P.nav` up to `NAV_AGILE`) can additionally take the agile-only edges.
Invariants: **base `NAV` stays absolute px and is the compiler/`planRoute`
default** (so `check-terrain.mjs` and the sandbox keep measuring the base
contract), and no character's `P.nav` may exceed `NAV_AGILE` (the compile ceiling).

## Character definition contract

A character (see `crt-toddler.js` / `glitch-imp.js`) is:

```js
{
  name,                       // id string
  params,                     // P: proportions + motion tuning. P.scale multiplies
                              //    authored motion offsets; NEVER the NAV constants.
                              //    Optional heft/nav knobs (defaults keep the
                              //    original feel): bodySpring/bodyDamp,
                              //    rotSpring/rotDamp, leanGain/leanMax, headMass
                              //    (head inertia), nav (per-character caps, <=
                              //    NAV_AGILE; omit for the base NAV contract).
  palette,                    // colors, incl. pix: [off, dim, main, hot] face palette
  legs: { rings, near, far }, // accordion leg style per depth layer
  face: { w, h, animated, exprs },  // low-res buffer size + expr table (see face.js)
  buildBody(g),               // draw the chest into a Pixi Graphics
  buildHead(g) -> faceBox,    // draw the head; return where the face buffer maps
  buildHeadGloss?(g, faceBox) // optional CRT glass drawn over the face
}
```

Expressions listed in `face.animated` re-render every frame (so they can move off
`f.t`); everything else redraws only on gaze/blink/expression change. Missing
engine expressions (e.g. a character that omits `happy`) fall back to `idle`.

## Behavior contract

Each behavior is a factory returning a fresh stateful object (never share an
instance between directors):

```js
{
  name,                       // becomes ctx.owner while it claims the job slot
  priority,                   // higher runs first each frame
  init?(ctx),                 // once at registration
  update?(ctx) -> claim,      // per frame; return true to own the job slot.
                              //   ctx.owner is the higher-priority claimant so far
                              //   (null if none) — CHECK IT before moving the robot.
  onSectionChange?(ctx, prev, next),
  onPoke?(ctx),
  onPageClick?(ctx, x, y, target),
  onTerrainRebuilt?(ctx),
}
```

`ctx = { d (director), R (robot), fx (effects), rd (renderer), api, page,
section, sensors, dt, owner }`. Arbitration (SPEC 4.2b): behaviors run
highest-priority first; the first whose `update` returns `true` owns `ctx.owner`
for the frame. Lower behaviors still get called (so they can track state and clean
up) but must check `ctx.owner` before issuing movement.

`api` (the facade's surface to behaviors):
`segFor(el)`, `segsByTag(tag)`, `graph()`, `getPageState()`, `emit(ev)`,
`robots()` (the whole cast, so a robot can see the others),
`stationState(name)` / `setStation(name, state)`.

### Priority ladders

```
hero (defaultBehaviors):
  boot 100 > hover-card 80 > catch-up 60 > repair 55 > pipeline 50
  > reactions 40 > chase 35 > curiosity 30 > section ambience 10

villain (villainBehaviors):
  flee 90 > exit-return 70 > catch-up 60 > sabotage 50 > reactions 40
  > villain-prowl 10
```

- **catch-up** self-heals its `walking` flag: if another behavior preempts its
  walk-back by issuing its own goto (which cancels the executor without firing
  catch-up's `onDone`/`onFail`), catch-up clears the flag when it sees no route is
  live. Without this a robot parked offscreen with no scroll gets stuck.

## The rivalry (Part 3, unified into "one fiction" in Part 4)

The rivalry is not a game bolted onto random boxes: red and blue fight over the
site's **real running systems.** Every station is a live piece of infra, and the
villain breaking it / the hero fixing it ARE that system's fail / recover
transitions (see "One fiction" below).

**Task stations.** A station is a `data-terrain` element also tagged
`data-station="<name>"`. Its **state** (`ok`|`broken`|`busy`) lives in a single
synchronous store, `src/stations/store.js`. The current stations are the live
deploy-pipeline stage (`pl-build`/`pl-test`/`pl-ship`, only the running stage is
a station at a time), every featured service card (`svc-N`), and the storage bay
(`bay`). The hero port row is deliberately NOT a station (it is boot theater).

- Behaviors read/write it through `api.stationState`/`api.setStation`
  (synchronous, no lag).
- React mirrors it into the DOM `data-state` attribute via `useStation`
  (`useSyncExternalStore`), which drives the CSS view (LED colors, red glow, a
  broken card's red-static screen and chromatic-split title, a jammed bench
  stage's dead screen and stuck fault chip). Rect-safe: only color/box-shadow/
  opacity and inner overlays, never a transform on the terrain element.
- The canvas `StationFx` reads the store live and sputters small **electrical
  sparks** off a broken station (diegetic "this device is faulting"), on top of
  the robots. There is deliberately **no** warning badge and no smoke plume: the
  damage reads on the box itself, so a break looks like the thing breaking, not a
  HUD icon floating over a random div.

This replaced an earlier design where the state lived in the DOM attribute and was
poked via a window event — that made the game logic depend on React's async commit
(a broken station was invisible to the hero for a frame or two) and was untestable.
One store, one truth.

**Reading intent.** Emotion is carried by the **pixel face**, not by any HUD: the
villain schemes (sly `idle`), grins while tampering (`mischief`), gloats
(`cackle`), panics (`panic`), botches (`fumble`); the hero is `curious` spotting a
fault, `sync` (scanning) while it works, `excited` on a fix, `angry` at the imp.
What each is doing reads from the face plus the physical action and the station's
own state FX (below) — no thought bubbles.

**The cast dynamic.**

- *Villain* (`villainBehaviors`, its own director, sharing one `mind` object):
  - `sabotage` — pick a working station in view, dart over, `tamper` (~0.8s), then
    break it (cackle face + spark burst, arms a ~20s cooldown so ≤1 per ~20s) or
    fumble (~35%: panic face, nothing breaks, retries sooner). A successful break
    asks exit-return to slink it off (`mind.wantsExit`).
  - `flee` — graded so the imp is bold but jumpy: a **wary** reaction inside ~230px
    (a nervous sideways look, does **not** claim the slot, so it will still sneak a
    sabotage under the hero's nose) escalating to a **bolt** inside ~140px
    (startle-hop then sprint for the reachable platform farthest from the hero, on
    the side **away** from it: up, down, or off sideways, never a fixed downward
    drain). Routes with the imp's own agile caps, so it slips through gaps the hero
    cannot follow.
  - `exit-return` — after a successful break, leave the scene offscreen on foot,
    wait a short beat (8–16s, holding the slot above catch-up so it stays gone),
    then walk back in on the side farthest from the hero. Re-entry from below the
    fold rides the ghost-rect rule.
  - `villain-prowl` — between errands it paces and shoots scheming glances at
    stations/the hero, so it never stalls.
- *Hero* gains `repair` (walk to a broken station in the current section, work it
  ~1.5s = busy, reset it = ok, pleased bounce; wakes a sleeping hero; while
  restoring a `card` it takes on that service's accent so the fix reads as
  re-flashing THAT device) and `chase` (a one-shot double-take + step toward the
  imp on a long cooldown; it always loses the footrace and the imp flees).

## One fiction (Part 4): the rivalry IS the systems

The sabotage/repair game and the page's live systems are the same thing, not two
layers sharing a box.

- **Hero deploy pipeline** (`src/components/Bench.jsx`): while a stage runs, that
  stage's box is a station. Red darts to the **live stage** (sabotage prefers a
  box tagged `data-bench`) and its jab sets the store to `broken`, which Bench
  reads and turns into a real `fail` at that stage. Blue's `repair` clears it
  (`ok`), which Bench reads as recovery and resumes the run. Failure has no blind
  `Math.random()` anymore: red causes it, blue fixes it. An auto-run keeps the
  pipeline alive on screen, and an auto-rollback backstops a jam nobody repairs.
  With no overlay there is no red, so every deploy just passes.
- **Featured services** (`src/components/ProjectCard.jsx`): every card is a
  `svc-N` station. Red corrupts one (the whole faceplate glitches: dead static
  screen, chromatic-split title, dead-red tags) and sparks in the card's own
  accent; blue restores it.

## Movement asymmetry (Part 4)

The two robots are genuinely different movers, not one puppet in two paints.

- **Heavy hero:** bigger monitor, slower `walkSpeed`/`accel`, softer body/rot
  springs, and a strong `P.headMass` so the head lags back on starts and pitches
  forward on hard stops (the head-inertia spring in `robot.js`). It plans with the
  **base NAV** caps.
- **Nimble imp:** small, fast, twitchy, stiff springs, near-zero head mass. It
  plans with **`P.nav`** caps up to `NAV_AGILE`, so it leaps wider gaps, scrambles
  taller walls, and drops farther than the hero's planner allows: real sneak
  routes the hero cannot follow (see the NAV contract below).

## Hard constraints (violating any is a regression)

- **Data layer is untouchable:** `src/hooks/useProjects`, `src/lib/`,
  `src/data/projects.js` logic, `templates/`.
- **Site imports only `facade.js`** from this directory (plus the neutral
  `src/stations/store.js`, which is a site module, not part of the robot engine).
- **NAV terrain constants are absolute px** and never scale with `P.scale`.
- **No hover transforms on terrain rects**; any layout change re-runs
  `scripts/check-terrain.mjs` at 1280/768/390/320.
- **Ghost-rect rule** (above) must hold.
- **Stumble outcomes stay DISABLED** in `executor.js` (SPEC 4.2b STATUS): every
  transition executes clean until authored recoveries are re-approved one by one.
- **Purely additive:** under `prefers-reduced-motion` or missing WebGL the canvas
  is never created and the DOM site is complete on its own (with no robot there is
  no villain, so stations stay online).
