# Bysters: a framework for living robots on any web page

Technical Design Document. Status: v1.0 for owner review (owner decisions of
2026-07-04 folded in). Package name `bysters`, shipped as a single package with
subpath exports (`bysters`, `bysters/behaviors`, `bysters/pixi`, `bysters/react`).
This document is the contract the sandbox implementation is built against.
Section 13 is a test-first acceptance spec: an implementing agent should turn
those Given/When/Then blocks into failing tests and build until they pass.

Central principle (owner-directed): **the framework is value-neutral.** It has no
concept of good/bad, fix/fail, hero/villain. There are only stateful elements
("Fixtures") and agents that transition their state; all meaning lives in the
consumer's config and CSS. The red-vs-blue rivalry is two bysters running the same
behavior with mirrored config, not two special types.

**Naming.** The animated creatures are **bysters** (the framework is named after
its inhabitants). One creature is *a byster*; the cast is *bysters*; a `Character`
defines a byster's body/look/tuning and its behaviors are its mind. "Robot" in
this doc is just the flagship look; a byster can be any creature, since Characters
are creature-agnostic. `Bysters` (capitalized) is the package/framework, `bysters`
(lowercase) are the creatures it brings to life.

This TDD is grounded in a full audit of the existing `src/robot/` overlay (see
Appendix A). The short version: the locomotion/animation core is already
site-agnostic and transfers almost as-is; the work is generalizing the three
integration layers (terrain discovery, the behavior host, the mount surface) and
formalizing two systems that exist today only in bespoke form (per-actuator
behavior arbitration, and interactables).

---

## 1. Vision and goals

Ship a reusable library that drops procedurally-animated robots onto any web page
with minimal hardcoding. A site author marks up their DOM to say what is walkable
and what is interactable, composes robots out of small overridable behaviors, and
calls `mount()`. In small steps they get living agents that treat the layout as
physical terrain, react to the cursor and to each other, and act on the page's
real controls.

Goals:

1. **Minimal hardcoding.** The world is declared in the DOM (`data-walk`,
   `data-fixture`); robots and behaviors are declared in a few lines of JS.
   No framework file should know anything about a specific site.
2. **Incremental adoption.** Three lines gets you one robot wandering the page.
   Each further capability (more robots, interactables, custom behaviors) is
   additive.
3. **Composition, not inheritance.** A robot HAS a bag of behaviors, each a small
   single-responsibility unit that can be added, replaced, or overridden per
   instance. No central coordinator hardcodes how two robots interact.
4. **Emergent, smooth behavior.** Multiple behaviors coexist by driving different
   actuators (legs, eyes, face, effects) at once, and transitions blend rather
   than cut, so the agent never reads as "switching modes."
5. **Additive and degradable.** Under `prefers-reduced-motion` or without WebGL,
   nothing is created and the host page is untouched. The framework is decoration
   that the page never depends on.
6. **Testable core.** All game logic (pathfinding, arbitration, kinematics) is
   pure and runs headless with no DOM and no Pixi, so it is unit-testable and
   deterministic.

Non-goals (v1): not a general game engine or physics simulator; not a sprite/2D
animation toolkit; not an accessibility or input framework. Rendering stays
PixiJS (a normal dependency) behind a thin interface so it *could* be swapped, but
we ship only the Pixi adapter.

---

## 2. Design principles

- **Pure core, effects at the edge.** `core/` has zero imports of `document`,
  `window`, or `pixi`. The DOM lives only in `dom/`, Pixi only in `render/pixi/`.
- **Sense, then Arbitrate, then Act.** Every frame: read a snapshot of the world,
  let behaviors bid, resolve who drives each actuator, apply intents through the
  motor. Decision is decoupled from execution.
- **Behaviors are strategies, ranked by priority.** Coexistence comes from
  ordering plus per-channel arbitration, not from a hand-written `if/else`.
- **Interaction is decentralized.** A robot reacts to other robots and the world
  from its OWN behavior code, through a read-only sensing API. Adding a robot
  never edits another robot.
- **Value-neutral substrate.** The framework never encodes domain meaning. A
  Fixture has opaque string states; an agent transitions them; the framework only
  records "who moved what, when." Whether that reads as "sabotage" or "repair" is
  the consumer's CSS and behavior config. This keeps two robots symmetric in code
  (mirror-config rivalry, Section 9) and lets any site invent its own semantics.
- **Declarative world, imperative agents.** The DOM says what exists (walls,
  buttons); JS says who the bysters are and how they think.
- **Dependency injection over global lookup.** Scroll state, terrain sources,
  interactable sources, and event streams are injected, so the same core runs in
  a page, an iframe, a headless test, or a canvas-in-canvas.
- **SOLID.** One responsibility per behavior/module (SRP); add robots, behaviors,
  interactables, strategies, renderers without editing existing code (OCP);
  behaviors and renderers are interchangeable behind interfaces (LSP/ISP);
  everything depends on abstractions, not concretes (DIP).

---

## 3. Glossary

- **Byster:** one animated creature instance (the framework's word for an agent).
  Plural bysters. "Robot" is just the flagship look.
- **Character:** the definition of a robot's body, proportions, palette, face
  table, and motion tuning (weight, speed, springs, nav caps). Reused across
  instances.
- **Behavior:** a small strategy object that senses the world and emits intents.
- **Channel / actuator:** an independently-arbitrated output: `locomotion`,
  `gaze`, `face`, `fx`, `interact`. Different behaviors can own different
  channels in the same frame.
- **Intent:** a declarative request for a channel this frame (e.g. `goto(target)`,
  `look(point)`, `express('curious')`).
- **Path engine:** compiles walkable DOM surfaces into a nav graph and plans
  routes over it.
- **Fixture:** a marked DOM element with a finite set of opaque states that both
  humans and agents can transition; state drives its presentation and can cascade
  to other Fixtures. The framework never interprets the states (value-neutral).
- **Actuate:** an agent transitioning a Fixture to a target state via the physical
  handshake (route to it, wire in, dwell, commit).
- **World:** the read-only per-frame snapshot behaviors sense.
- **Space:** the coordinate/scroll provider mapping DOM rects into the agent's
  world coordinates.

---

## 4. Architecture overview

```
bysters/
  core/                       pure logic; no document, no window, no pixi
    math.js                   clamp/lerp/spring/qbez/easing/rot2d/random      [as-is]
    kinematics/
      gait.js  ik.js  maneuvers.js  executor.js                              [as-is]
    face.js                   low-res expression buffer                       [as-is]
    robot.js                  body state + motor + FSM (channel-aware)        [near-as-is]
    path/
      caps.js                 NAV presets + edgeAllowed()                     [from terrain.js]
      graph.js                nav-graph model + A* planRoute()                [from terrain.js]
      compile.js              (rects + walkable sides) -> graph               [generalized terrain.js]
      strategies.js           connection strategies (neighbour / N-hop / ...)  [new]
    behavior/
      world.js                read-only sensing snapshot + queries            [new, generalizes ctx]
      channels.js             channel ids + intent types                      [new]
      arbiter.js              per-channel Sense->Arbitrate->Act loop          [generalized director.js]
      behavior.js             the Behavior interface + helpers                [generalizes plugin contract]
      library/                built-in reusable behaviors                     [generalized from behaviors/]
    fixtures/
      store.js                synchronous observable state store (opaque states) [from stations/store.js, as-is]
      fixture.js              multi-state element model + transition guards     [generalized from stations]
      actuate.js              agent actuate handshake (route/wire/dwell/commit) [generalized from hover-card]
  dom/                        the ONLY place that touches document/window
    space.js                  ScrollState / coordinate provider (pluggable)   [extracted from facade]
    collect.js                DOM -> {rects, walkable sides, fixtures}        [generalized collectRects]
    input.js                  pointer/scroll/resize/visibility -> events      [extracted from facade]
    mount-dom.js              wire core to a live page                        [generalized facade]
  render/
    renderer.js               the Renderer interface (contract)               [new]
    pixi/
      overlay.js  robot-renderer.js  effects.js  fixture-fx.js               [from render edge, as-is-ish]
  index.js                    mount() public entry
```

The frame loop (in `arbiter.js`, driven by `mount-dom.js`'s rAF):

```
each frame(dt):
  space  = Space.read()                       // scroll/viewport snapshot (injected)
  world  = World.build(space, robots, cursor, // read-only sensing
                       graph, fixtures, page)
  for each robot:
    intents = {}                              // channel -> best intent so far
    for behavior in robot.behaviors (priority desc):
      bid = behavior.update(world, robot.self) // PURE: returns per-channel intents
      for channel, intent in bid:
        if channel not owned yet (with hysteresis): intents[channel] = (behavior, intent)
    motor.apply(robot, intents, dt)           // execute: locomotion eases, gaze/face/fx set
  renderer.draw(robots, effects, dt)
```

---

## 5. Coordinate and scroll model (Space)

Today everything reads `window.scrollX/scrollY` directly in ~10 files (Appendix A).
That is the single biggest portability blocker. Replace it with an injected
**Space** provider:

```js
interface Space {
  read(): {
    scrollX, scrollY, viewportW, viewportH, dpr,
    docToWorld(x, y), worldToDoc(x, y),   // identity for the default page space
    rectOf(el): { x, y, w, h }            // element rect in WORLD coordinates
  }
}
```

- Default implementation `DocumentSpace` = today's behavior (document space, one
  window scroll, `getBoundingClientRect + scroll`).
- The core NEVER calls `window`/`getBoundingClientRect`; it consumes `space` from
  the world snapshot. This unlocks iframes, nested scrollers (a future
  `ScrollerSpace`), and headless tests (a `FixedSpace` with scripted scroll).

Acceptance-relevant invariant: given a `FixedSpace`, the whole simulation is
deterministic and runs with no real DOM.

---

## 6. The Path Engine (generalized terrain)

Today's compiler (`terrain.js`) is **top-edge-only**: one walkable segment per
rect at its top, connected by three hardcoded transition types (climb/hop/drop)
with global px limits, planned with A*, filtered per-character by `caps`
(`edgeAllowed`). That A* + typed-transition + per-character-caps model is good
and stays. What changes is *how surfaces and edges are discovered*.

### 6.1 Walkable-side declaration

Any element can declare which of its sides are walkable, on the outward normal:

```html
<div data-walk="top left right">...</div>   <!-- walk the top and both walls -->
<div data-walk="top">...</div>              <!-- default; same as today -->
<div data-walk>...</div>                     <!-- shorthand for "top" -->
```

`collect.js` reads `data-walk` and produces, per element, a set of **surface
segments**, each an oriented line with a tangent and an outward **normal**:

```js
Surface = { el, side, a:{x,y}, b:{x,y}, normal:{x,y}, meta }
// top:    a=(x1,y), b=(x2,y), normal=(0,-1)   (gravity pulls the agent onto it)
// left:   a=(x,y1), b=(x,y2), normal=(-1,0)
// right / bottom analogous
```

The core stays gravity-agnostic by working in **surface-local space**: "down" is
`-normal`, "along" is the tangent. The Robot motor already tracks a body height
above a surface and a lean; generalize those scalars to surface-local so the same
gait draws a wall-walker rotated 90 degrees.

Phasing note (important, honest): full non-top orientation (walls/ceilings) is a
real motor generalization, not just a graph change. Recommendation: build the
graph model orientation-aware from day one (so it is not a rewrite later), but
gate the *rendered* motor support by milestone: M-path ships robust `top`
(and `bottom`/underside, which the current design already gestures at), and
`left`/`right` wall-walking lands in a later milestone. The graph, strategies,
and A* are fully general immediately; only the leg/body draw for rotated gravity
is deferred.

### 6.2 Graph model

Move from "nodes implicitly created where edges need them" to an explicit
vertex/edge model that supports arbitrary sides and later irregular shapes:

```js
Vertex = { id, x, y, surface }                 // corners + junction points on a surface
Edge   = { from, to, type, cost, req? }        // req gates per-character caps
Graph  = { surfaces, vertices, edges, adj:Map, index }  // index = spatial accel (6.5)
```

- **Walk edges** run bidirectionally along a surface between its vertices.
- **Transition edges** (hop / climb / drop / and custom types) leap between
  surfaces across space, tagged with `req` geometry (`{hopX, hopY}`, `{climb}`,
  `{drop}`) exactly as today.
- Endpoint and junction vertices are precomputed per surface; A* still splices
  temporary start/goal vertices at query time (as `planRoute` does now).

### 6.3 Connection strategies (the new, pluggable part)

Edge discovery becomes a **strategy**: given all surfaces/vertices and the rect
set, decide which pairs connect and with what transition. This is where the
owner's "direct neighbour / one hop / two hops / three hops" lives.

```js
interface Strategy {
  // Return candidate edges for this vertex (or null). Pure, local where possible.
  edgesFrom(vertex, ctx: { surfaces, rects, vertices, limits, index }): Edge[]
}
```

Built-in strategies (composable via a fallback chain, e.g.
`[directNeighbour, oneHop, climb, drop]`):

- `directNeighbour` — connect surfaces whose walkable edges touch or nearly touch
  (shared corners, tiny gaps). The cheapest, safest graph.
- `hop({ reach })` — connect facing edges across a gap up to `reach` px, with
  rise limit; `oneHop` / `twoHop` / `threeHop` are presets (`reach` ~120 / 250 /
  400). Higher reach = denser graph, more route options, more risk (6.6).
- `climb({ maxWall })` and `drop({ maxDrop })` — vertical transitions, as today.
- Custom strategies can encode directional rules ("only hop downward",
  "climb left walls only").

`compile.js` = `for each vertex: gather edges from the strategy chain; dedupe;
build adj`. The result is a `Graph` the existing A* consumes unchanged.

### 6.4 Caps and typed transitions (kept)

`caps.js` keeps `NAV` (the base contract, absolute px) and `NAV_AGILE`
(the permissive compile ceiling), plus `edgeAllowed(edge, caps)`. The graph is
compiled to the permissive ceiling and each robot's `caps` filter edges at query
time (`planRoute(graph, start, goal, caps)`). This per-character nimbleness
(a light imp routing through moves a heavy hero cannot) is a framework primitive,
not site logic. Strategies and caps are orthogonal: strategies decide which edges
*exist*; caps decide which a given robot *may use*.

### 6.5 Performance

Edge build is O(n^2) today (fine at ~100 surfaces, risky on large/dynamic DOMs).
Add a spatial index (uniform grid or R-tree) in `graph.index` so strategies query
only nearby surfaces. Keep the debounced rebuild (150 ms) and the viewport-band
corridor windowing (only compile surfaces near the visible band). Cap the surface
count per band with a logged warning if exceeded (never silently truncate).

### 6.6 Guardrails (this is where arbitrary layouts bite)

- **Occlusion:** a permissive hop can connect two surfaces with a solid box
  between them, producing a route that clips through a wall. `drop` already checks
  `nearestBelow`; hops need an analogous occlusion test against the rect set (or a
  visibility pre-pass). Strategies must be occlusion-aware.
- **Reachability report:** `compile.js` exposes `graph.reachabilityFrom(seed)`
  (BFS) and a debug mode that flags surfaces unreachable from the ground so a site
  author sees dead zones instead of a stuck robot. This generalizes today's
  `scripts/check-terrain.mjs`.
- **Route failure recovery:** when `planRoute` returns null, the motor falls back
  to idle/replan (as the current director does), never throws.
- **Transforms / nested scroll:** v1 constraint is document-space rects
  (transforms and nested scrollers are out of scope, flagged as a `Space`
  extension point). Document the constraint; do not silently misbehave.

---

## 7. The Robot model

A **Character** (unchanged in spirit from today) defines a robot's look and feel:

```js
Character = {
  name,
  params,        // proportions + motion tuning; per-character knobs:
                 //   scale, walkSpeed, wanderSpeed, accel, stepThresholdBase,
                 //   bodySpring/bodyDamp, rotSpring/rotDamp, leanGain/leanMax,
                 //   headMass (head inertia), nav (per-character caps <= NAV_AGILE)
  palette,       // colors incl. pix:[off,dim,main,hot] face palette
  legs,          // accordion leg style per depth layer
  face,          // { w, h, animated:[...], exprs:{ name(buffer){} } }
  buildBody(g), buildHead(g)->faceBox, buildHeadGloss?(g, box)   // render hooks
}
```

The **Robot** (the motor) is the current `robot.js` almost verbatim: body height
spring, pitch/lean, head inertia, the FSM, gait integration, and the command
surface (`commandGoto`, `commandGotoSeg`, `startle`, `wakeIfSleeping`). Two
changes: (1) it consumes `space`/`caps` from the world rather than reading
`window`; (2) its command surface is driven by the **motor** applying arbitrated
intents, not by behaviors calling it directly (Section 8.3). The Character is
creature-agnostic: nothing says it must be a CRT robot, so consumers can define
their own bodies.

---

## 8. The Behavior system (the heart)

This section answers the owner's questions directly: how coexistence works, why
inheritance is the wrong tool, and how two robots interact without a third-party
coordinator.

### 8.1 The Behavior interface

A behavior is a small object (composition, not a subclass) with one
responsibility. It is **pure**: given the world and its own robot's view, it
returns per-channel intents. It does not mutate the robot.

```js
interface Behavior {
  id: string
  priority: number                 // higher bids first
  channels: Channel[]              // which actuators it may drive (for arbitration)
  init?(world, self): void         // once
  update(world, self): Bid | null  // per frame: { [channel]: Intent }, or null
  // optional lifecycle:
  onEvent?(world, self, event): void   // pokes, clicks, arrival, terrain-rebuilt
}
```

`self` is the robot's own read/write-through-intents view; `world` is read-only
(Section 8.4). A consumer defines a robot as a Character plus a composed list of
behaviors, and overrides by swapping/adding entries. No inheritance tree.

### 8.2 Arbitration: how behaviors coexist (Sense, Arbitrate, Act)

This formalizes what the current `Director` already does, and fixes the audited
**single-channel bottleneck** (all 13 behaviors fight over one `ctx.owner` slot
even though gaze/face/fx never conflict).

- Behaviors are ranked by `priority`. Each frame every behavior's `update` runs
  (so lower-priority ones keep their own state), highest first.
- Arbitration is **per channel**. For each of `locomotion`, `gaze`, `face`, `fx`,
  `interact`, the highest-priority behavior that emitted an intent for that
  channel wins THAT channel. So `flee` can own the legs while `curiosity` owns the
  eyes and `reactions` owns the face, in the same frame. That layered simultaneity
  is what makes the agent feel alive instead of modal.
- **Hysteresis / min-hold** per channel: the current owner keeps a small priority
  bump and a minimum hold time, so behaviors never flip-flop at a boundary (this
  is the "no abrupt changes, considering what it was already doing" the owner
  asked for, expressed at the arbitration layer).

Worked example (the villain), showing coexistence emerging from priority:
`flee(90) > exitReturn(70) > catchUp(60) > sabotage(50) > prowl(10)`. When the
hero is far, `sabotage` wins `locomotion` and darts to a station. The hero closes
in: `flee` now bids for `locomotion` and, being higher, takes it; `sabotage` sees
it did not win the channel and holds its state. "Fleeing beats sabotaging" is
never written anywhere; it falls out of the ordering.

### 8.3 Intents and the motor (smoothness)

Behaviors emit **intents**, not side effects. The motor executes them and owns
the smoothing:

```js
Intent (locomotion): { kind:'goto', target, speed?, noise? }
                   | { kind:'face', dir } | { kind:'startle', dir } | { kind:'stop' }
Intent (gaze):  { kind:'look', point, dur? }
Intent (face):  { kind:'express', name, hold? } | { kind:'palette', pix, hold? }
Intent (fx):    { kind:'plug', el, color? } | { kind:'burst', point, color? } | ...
Intent (interact): { kind:'actuate', fixture, to } | { kind:'release' }
```

Why this is smoother than today: the motor accepts a new `goto` only at safe
points (it finishes an in-flight maneuver first, as `pendingGoal` does now) and
eases velocity toward the target, so a decision that changes every frame still
produces continuous motion. Route lifecycle (arrival, failure, cancel-on-rebuild)
becomes world events (`arrived`, `routeFailed`, `terrainRebuilt`) that behaviors
observe via `onEvent`, instead of callbacks each behavior must remember to hook.
This also fixes the audited fragility where a new behavior forgetting
`onTerrainRebuilt` strands itself.

Pragmatic fallback (if full purity is too much for v1): keep behaviors
semi-imperative but pass them a **channel-gated `self`** whose movement methods
no-op unless the arbiter granted that channel this frame. Same coexistence
guarantees, less refactor, slightly less testable. Recommend the pure-intent model
as the target; allow the gated-self model as a stepping stone.

### 8.4 The World (sensing) and decentralized interaction

Behaviors depend only on a read-only `world`, never on concrete robots or the DOM.
This is the Dependency-Inversion boundary and the key to decentralized
interaction:

```js
world = {
  space,                                  // Section 5 snapshot
  cursor: { x, y, vx, vy, speed, idleT },
  page,                                   // arbitrary host state (fetch status, etc.)
  regions: { current(pointOrSelf), inRegion(name, point) },  // generalizes "sections"
  graph, planRoute,                       // path queries with self.caps
  fixtures: { all(), near(point,r), byState(s), byType(t), canTransition(fx,to) },
  bysters: {                              // the OTHER bysters, sensed not commanded
    all(), named(name), nearest(self), nearestUnknown(self), within(self, r)
  },
}
```

Two bysters interacting is entirely each byster's own code reacting to
`world.bysters`:

```js
// in the imp's flee behavior (imp's file only)
const hero = world.bysters.named('hero') ?? world.bysters.nearest(self)
if (hero && dist(self, hero) < BOLT) return { locomotion: fleeAwayFrom(hero) }

// in the hero's chase behavior (hero's file only)
const imp = world.bysters.nearest(self)
if (imp && dist(self, imp) < NOTICE) return { gaze: look(imp), face: express('angry'),
                                              locomotion: stepToward(imp) }
```

Neither edits the other, and there is no third place. Named lookup
(`bysters.named('hero')`) lets a behavior react specifically to a known byster;
`nearestUnknown` handles strangers. Add a third byster and nothing else changes
(Open/Closed). This is exactly the shape the current `nearestOther()` already
takes; the framework just makes it first-class and named.

### 8.5 Built-in behavior library and overrides

`core/behavior/library/` ships reusable, site-agnostic behaviors the current
bespoke ones generalize into:

- `idle`, `wander` (bounded to visible surfaces), `followCursor`,
  `startleFromCursor`, `curiosityApproach`, `catchUp` (return when offscreen),
  `sleep`, `wakeOnActivity`.
- `reactToRobots` scaffolding (flee / approach / watch) parameterized by predicate
  and thresholds, so "flee the hero" and "chase the imp" are configurations, not
  new code.
- `operateFixtures({ match, drive })` — the general actuate handshake (Section 9).
  Value-neutral: `repair`, `sabotage`, and `hover-card` all collapse into this one
  behavior with different `match`/`drive` config.

A consumer composes these and overrides by: replacing an entry, tuning its config,
subclass-free wrapping, or adding a new behavior object. The site's specific
theater (boot plug-in, deploy-pipeline supervision) lives in the CONSUMER as
custom behaviors built on the library, never in the framework.

---

## 9. The Fixture system (value-neutral stateful elements)

Owner-directed model: not "buttons" (a button implies one click-action), but
**Fixtures**: custom elements with a *set* of states that agents and humans
transition. The framework never interprets the states, so nothing in it (or even
in a robot's definition) is "good" or "bad". Today's bespoke stations
(`data-station` + `stationStore` + the plug cable + sabotage/repair) collapse into
this one general primitive; the audit confirms the store and the plug-cable
handshake are already the right building blocks.

### 9.1 Declaration and state

```html
<div data-fixture="rack"
     data-states="neutral failed fixed"
     data-state="neutral"
     data-transitions="neutral>failed failed>fixed fixed>neutral">
  ...
</div>
```

- `data-fixture="<type>"` marks it; `<type>` is a consumer label (for defaults,
  9.4), not a meaning the framework knows.
- `data-states` declares the finite state set (opaque strings). Truth lives in the
  framework `Store` (today's synchronous observable, reused as-is:
  `store.get/set/subscribe`, synchronous, no async commit). `data-state` is a
  mirror for CSS, not the source of truth.
- `data-transitions` (optional) are **guards**: allowed `from>to` moves. Omitted =
  any state to any state. A Fixture that only allows `failed>fixed` cannot be
  re-failed once fixed, and the framework enforces this without knowing what
  "failed" or "fixed" mean.

The Fixture model in `core/fixtures/`:

```js
Fixture = { id, el, type, states:[...], state, guards:[[from,to],...] }
world.fixtures = {
  all(), byType(t), byState(s), near(point, r),
  canTransition(fx, to): bool,           // checks guards only
}
store.transition(fxId, to, byAgent?): bool   // guarded write; records who/when
store.subscribe(cb)                          // (fx, from, to, byAgent) => void
```

### 9.2 Two actuators, one store

- **Human:** a normal DOM listener the site wires (click/key) that calls
  `store.transition(id, to)`. The framework does not even need to know about it.
- **Agent:** the actuate handshake (`core/fixtures/actuate.js`), as an intent
  sequence: route to the Fixture, on `arrived` emit an `fx.plug` intent (the wire
  connects, reusing the existing bezier cable), dwell (a work animation), then
  `store.transition(id, targetState, self)`, then `fx.release`. The **target
  state is a parameter**, so the same handshake drives any transition.

Both paths funnel to one guarded store write. The only fact the framework records
is "agent (or human) moved Fixture F from A to B at time T".

### 9.3 The rivalry is mirror config, not two robot types

There is no good/bad anywhere. Both robots run the SAME library behavior with
opposite parameters:

```js
// robot we happen to render red: push healthy fixtures to 'failed'
behaviors.operateFixtures({ match: fx => fx.state !== 'failed', drive: 'failed' })
// robot we happen to render blue: push failed fixtures back to 'fixed'
behaviors.operateFixtures({ match: fx => fx.state === 'failed', drive: 'fixed'  })
```

`operateFixtures({ match, drive, dwell?, speed? })` picks the nearest reachable
Fixture where `match(fx)` and `canTransition(fx, drive)`, actuates it toward
`drive`. Two mirrored configs produce the tug-of-war; a third robot driving to
`neutral` makes it three-way; none of them edits the others (Open/Closed). The
"story" is 100% the consumer's CSS keyed on `data-state` plus which `drive` each
robot was given.

### 9.4 Cascade (states affecting other elements)

A state change can drive other Fixtures or arbitrary page behavior. The framework
provides the subscription and a structured `onTransition` hook; the *policy* is
consumer code (or a small declarative rule map), so cascades stay value-neutral:

```js
world.fixtures.onTransition((fx, from, to, byAgent) => {
  // consumer policy, e.g.: a failed live pipeline stage fails the deploy node
  if (fx.type === 'stage' && to === 'failed') store.transition('deploy', 'error')
})
```

This is exactly how `Bench.jsx` reads the store and reacts today; it becomes a
consumer reaction rule rather than framework logic.

### 9.5 Default vs override

- Each Fixture **type** may register a default agent reaction (e.g. type `port` ->
  plug-and-read). This is how a site says "robots know what to do with this kind
  of thing" without per-element wiring.
- Override per element via `data-byster-behavior="<id>"` (a registered behavior),
  or globally in the registry. Adding a new Fixture type = register the type and
  an optional default; existing agents pick it up with zero edits. This is the
  owner's "every time we add something, define a default or override it."

---

## 10. Rendering

Keep Pixi, isolate it. Define a `Renderer` interface the core draws through:

```js
interface Renderer {
  mount(): Promise<void>                 // create the overlay surface
  addRobot(character): RobotRenderHandle  // draw hooks read robot state each frame
  drawFrame(robots, effects, dt): void
  unmount(): void
}
```

Ship `render/pixi/` implementing it from the current `overlay.js` +
`renderer.js` + `effects.js` + `station-fx.js` (the audit marks these
reuse-as-is once they take `scrollOffset`/element lists as inputs instead of
reading `window`/querying the DOM). The core emits pure state; the renderer only
draws. Because the boundary is an interface, a DOM/SVG renderer is possible later
without touching the core, but we do not build it now.

Degradation: `mount()` checks `prefers-reduced-motion` and WebGL; if either is
unavailable it returns a no-op handle and the page is untouched (as today).

---

## 11. Public API: three lines to a living byster

```js
import { mount, characters, behaviors } from 'bysters'

// 1. Minimal: one built-in byster wandering everything marked data-walk="top"
const stage = await mount()

// 2. A named cast with composed behaviors
const stage = await mount({
  bysters: [
    { name: 'hero', character: characters.crtToddler,
      behaviors: [behaviors.followCursor(), behaviors.wander(), behaviors.catchUp()] },
    { name: 'imp', character: myImp,
      behaviors: [behaviors.fleeFrom(b => b.name === 'hero'), behaviors.wander()] },
  ],
})

// 3. Full control (all optional, all injectable)
const stage = await mount({
  space:        new DocumentSpace(),          // or a custom Space
  terrain:      { source: '[data-walk]', strategy: ['directNeighbour','oneHop','climb','drop'] },
  fixtures:     { source: '[data-fixture]', store: myStore },   // value-neutral state elements
  renderer:     new PixiRenderer(),
  page:         () => ({ fetch: state }),     // arbitrary host state for behaviors
  bysters:      [...],
})

stage.rebuild()          // force a terrain recompile (e.g. after your own layout change)
stage.goto('hero', el)   // imperative nudge
stage.on('arrive', cb)
stage.unmount()
```

Declarative-only bootstrap (no JS cast) is also supported: mark up `data-walk`
and `data-byster="crt-toddler"` and a bare `mount()` reads them.

---

## 12. Extensibility model

Every new thing is "register a default, or override":

- New **byster**: add to `bysters`. Others unaffected.
- New **behavior**: a plain object; add to a robot's list, or publish for reuse.
- New **Fixture type**: register the type and (optionally) a default robot
  behavior; override per element with `data-byster-behavior`.
- New **connection strategy**: implement `Strategy`, add to the chain.
- New **renderer**: implement `Renderer`.

None of these require editing framework internals. That is the OCP payoff and the
owner's stated goal ("every time we add something new, define default or override").

---

## 13. Testing strategy (test-first acceptance spec)

The core is pure, so most of this runs headless (no DOM, no Pixi) under a fast
unit runner (vitest). The implementing agent should write these as failing tests
first. `Given` sets up a `FixedSpace` + rect fixtures + behaviors; `Then` asserts
on returned intents / graph / positions.

### 13.1 Path engine

- **PE-1 walkable sides.** Given a rect with `data-walk="top left right"`, compile
  yields three surfaces with correct normals; `data-walk="top"` yields one;
  omitted defaults to `top`.
- **PE-2 strategy density.** Given three surfaces with an 80 px and a 200 px gap:
  with `[directNeighbour]` only the touching pair connects; with `oneHop` the
  80 px gap connects; with `twoHop` both connect. Assert edge count/types.
- **PE-3 caps filtering.** Given an edge `{req:{climb:120}}`: `planRoute` with base
  caps (`climbMax 95`) excludes it; with agile caps (`155`) includes it. Same graph,
  different route per robot.
- **PE-4 occlusion.** Given A and C with B solid between them, a hop strategy does
  NOT emit an A->C edge that crosses B. Assert no route clips a solid rect.
- **PE-5 connectivity/regression.** Given the current portfolio's captured rects at
  1280/768/390/320, every visible surface is reachable from ground at every scroll
  (the generalized `check-terrain`), for base caps. This is the migration safety net.
- **PE-6 determinism.** Given a `FixedSpace`, two compiles of the same rects are
  identical; a full sim of N steps is reproducible.

### 13.2 Behavior arbitration

- **BA-1 per-channel coexistence.** Given `flee(90)` bidding `{locomotion}` and
  `curiosity(30)` bidding `{gaze}`, the frame's resolution grants locomotion to
  flee AND gaze to curiosity simultaneously.
- **BA-2 priority on a contested channel.** Given two behaviors bidding
  `{locomotion}`, the higher priority wins; the lower keeps running (its `update`
  is still called) and its state advances.
- **BA-3 hysteresis.** Given a behavior that wins a channel at t0 and a rival that
  crosses the threshold by 1 px at t1, the channel does not flip until the rival
  clears the hysteresis margin / min-hold. Assert no per-frame ownership churn.
- **BA-4 smoothness.** Given a `goto` intent that changes target every frame while
  a maneuver is mid-flight, the motor finishes the maneuver before retargeting
  (assert no position discontinuity > threshold).

### 13.3 Decentralized interaction

- **DI-1 emergent chase/flee.** Given a `hero` with `chase` and an `imp` with
  `fleeFrom(name==='hero')`, and the hero within NOTICE: the imp emits a
  locomotion intent away from the hero and the hero emits one toward the imp,
  purely from their own behavior code. No coordinator module is referenced.
- **DI-2 add-a-robot is inert.** Adding a third robot with its own behaviors does
  not change the intents produced by the existing two given identical world state.
- **DI-3 named vs unknown.** `world.bysters.named('hero')` returns that byster;
  `nearestUnknown(self)` skips named-and-known ones per the behavior's predicate.

### 13.4 Fixtures (value-neutral)

- **FX-1 opaque states + parity.** Given a Fixture with states
  `[neutral, failed, fixed]`, a human `store.transition('f','failed')` and a robot
  actuate to `failed` produce identical store state; the framework asserts nothing
  about what `failed` means.
- **FX-2 guards.** Given `data-transitions="failed>fixed"`, `canTransition(fx,
  'failed')` is false from `fixed`; a robot configured to `drive:'failed'` skips
  that Fixture (its `operateFixtures` match excludes non-transitionable targets).
- **FX-3 actuate handshake.** `operateFixtures` produces, in order: a locomotion
  intent to the Fixture, on `arrived` an `fx.plug` intent, a dwell, a guarded
  `store.transition(id, drive, self)`, then `fx.release`. Assert the sequence and
  that the store records `byAgent === self`.
- **FX-4 mirror-config rivalry (the headline test).** Given robot A
  `operateFixtures({match: fx=>fx.state!=='failed', drive:'failed'})` and robot B
  `operateFixtures({match: fx=>fx.state==='failed', drive:'fixed'})` on a field of
  Fixtures: over time both act, states oscillate, and NEITHER robot's code nor the
  framework references "good", "bad", or the other robot's role. The rivalry is
  purely the two symmetric configs. Assert both drive transitions and that
  swapping their `drive` values swaps their apparent roles with no other change.
- **FX-5 cascade.** Given an `onTransition` rule "stage->failed implies deploy->
  error", transitioning a stage Fixture to `failed` drives the deploy Fixture to
  `error` in the same synchronous tick. Assert the cascade and that it lives in
  consumer policy, not framework code.
- **FX-6 default vs override.** A Fixture of a registered type with no
  `data-byster-behavior` gets the type default reaction; one with the attribute
  gets the named override.

### 13.5 Integration / visual (sandbox)

- A sandbox page (`sandbox.html`) with a hand-marked `data-walk` layout, a debug
  flag exposing `window.__bysters` (robots, graph, step(dt), space), deterministic
  `step()` for occluded tabs, and a reachability overlay. Manual + screenshot
  checks for gait quality, wall-walk (when that milestone lands), and interactable
  wiring.

---

## 14. Migration plan (this site becomes the first consumer)

Grounded in Appendix A. The site keeps working at every step.

1. **Extract the pure core unchanged.** Move `math, ik, gait, maneuvers, executor,
   face, renderer, robot` into `bysters/core` and `bysters/render/pixi` verbatim
   (audit: reuse-as-is). Wrap the current facade to import from the new locations.
   No behavior change; build + terrain check still green.
2. **Introduce Space.** Replace every `window.scroll*` read (Appendix A lists them
   all) with a `DocumentSpace` injected through the world. Behaviorally identical.
3. **Generalize terrain discovery.** `collect.js` reads `data-walk` (defaulting to
   `top` so current `data-terrain` tops still work) and interactables; the graph
   model and strategies land behind the existing A*. Re-run PE-5 at all breakpoints.
4. **Per-channel arbiter.** Replace the single-`ctx.owner` director with the
   channel arbiter; port the 13 behaviors to emit intents (or channel-gated self
   as the fallback). Verify parity with the current runtime (the red/blue theater
   still plays).
5. **Fixture system.** Reframe stations as value-neutral Fixtures; the deploy
   pipeline and cards become consumer-side Fixture configs + `operateFixtures`
   behaviors with mirrored `drive` values.
6. **Delete the old paths in one sweep.** Once the site runs entirely on `bysters`,
   remove the superseded `src/robot/*` shims and any dead code (the owner's
   "clear all unused code in one sweep").

The site-specific pieces (SECTIONS, `.bench`, `.devicePort`, CSS vars `--led`/
`--accent`, station names, the boot/pipeline/repair/sabotage theater) all move OUT
of the framework into the portfolio's own `bysters` config and custom behaviors.

---

## 15. Milestones (small steps)

- **M0 Extraction.** Core moved, Space injected, site unchanged, tests green.
- **M-path Path engine.** `data-walk` sides (top + bottom), strategies, occlusion,
  reachability report, perf index. Wall/ceiling motor deferred.
- **M-arb Behavior system.** Per-channel arbiter, intents/motor, world sensing,
  built-in library, decentralized interaction. Ports the current cast.
- **M-fix Fixtures.** Value-neutral multi-state Fixtures + guards + actuate
  handshake + cascade + default/override. Ports the station rivalry as mirror config.
- **M-cast Multi-byster polish.** Named bysters, stranger handling, spacing.
- **M-inject.** The portfolio runs fully on `bysters` (still a local package dir);
  the old inline `src/robot/*` is deleted. This is the proving ground.
- **M-publish (distribution, after M-inject is reviewed and stable).** Extract the
  `bysters/` package into its OWN repo under the owner's GitHub profile with a full
  README (concept, quickstart, API, examples, live demo), a license, and a
  published artifact (npm package or a git dependency). The portfolio then consumes
  `bysters` as a normal external dependency instead of a local dir, and any
  remaining inline copy is removed. Add a dedicated **bysters showcase page** to the
  portfolio, linked from the top nav beside the dark/light toggle, that presents the
  framework (what it is, a playground, a link to the repo). Sequencing rule: do NOT
  split the repo until the framework has been proven and tested inside the portfolio;
  the portfolio is the first consumer and the test bed.
- **M-walls (stretch).** Rotated-gravity motor for `left`/`right`/ceiling walking.
- **M-render (stretch).** A non-Pixi renderer to prove the boundary.

Each milestone is independently reviewable and leaves a running site + a green
sandbox.

---

## 16. Risks and mitigations (from the audit)

- **Arbitrary-layout pathfinding** (occlusion, dead zones, nonsense routes): the
  biggest risk. Mitigate with occlusion-aware strategies, a compile-time
  reachability report, conservative default strategy chain, and route-failure
  fallback to idle.
- **Perf on large/dynamic DOMs** (O(n^2) build): spatial index, corridor
  windowing, surface-count cap with a logged warning.
- **Nested scroll / transforms:** out of scope in v1 behind the `Space` seam;
  documented constraint, not silent breakage.
- **Behavior migration fragility** (route cancel on rebuild): the event-based
  motor (Section 8.3) removes the per-behavior callback bookkeeping that is fragile
  today.
- **Motor generalization for walls:** deferred by milestone; the graph is general
  from day one so it is not a later rewrite.
- **Scope creep:** the framework ships primitives + a built-in library; all site
  theater stays in the consumer.

---

## 17. Resolved decisions (owner, 2026-07-04)

1. **Name and packaging:** `bysters`, a single package with subpath exports
   (`bysters`, `bysters/behaviors`, `bysters/pixi`, `bysters/react`).
2. **Value-neutral Fixtures over "buttons":** the interactable primitive is a
   multi-state Fixture (Section 9); the framework encodes no meaning; the rivalry
   is mirror-config. This was the owner's core steer and reshapes Section 9.
3. **Behavior model:** pure-intent (Section 8.3), with the channel-gated
   semi-imperative model documented as an implementer fallback only.
4. **Wall/ceiling walking:** deferred to M-walls; v1 ships top + undersides. The
   graph/strategies are general from day one (Section 6.1).
5. **Strategy defaults:** conservative and safe out of the box (sparse, occlusion-
   checked); density is opt-in (Section 6.3/6.6). Owner accepted the calmer default
   over a lively-but-riskier one.
6. **State adapters and degradation:** framework ships the framework-agnostic store
   plus a vanilla `data-state` mirror; a thin `bysters/react` adapter is an optional
   subpath export. Reduced-motion / no-WebGL degrades to a no-op (Section 10).

Nothing is currently blocking implementation. Remaining judgment calls (leg-draw
tuning for undersides, exact default strategy thresholds, the Fixture noun if
"Fixture" grates) are left to the sandbox phase and are cheap to change.

---

## Appendix A: current-code reuse and coupling map (from the audit)

Reuse as-is (pure, transfers unchanged): `math.js`, `ik.js`, `executor.js`,
`gait.js`, `maneuvers.js`, `face.js`, `renderer.js`, `robot.js`, `overlay.js`.

Reuse with light generalization: `terrain.js` (expose NAV as config; already
generic given rects), `effects.js` and `station-fx.js` (inject `scrollOffset` and
an element/station list instead of reading `window` / querying the DOM).

Site-couplings to cut (move into consumer config): `director.js` hardcoded
`SECTIONS` + `document.querySelector` + `window.scrollY` (lines 15-21, 30,
88/139/146); `facade.js` `window.scroll*` throughout, `collectRects` querying
`[data-terrain]` (157/162), hardcoded ghost/corridor/shortcut constants
(38/43-44/164-174), `ResizeObserver` on body (404-405), window/document event
listeners (398-405); behaviors hardcoding selectors and names
(`boot`->`'port'`/`--led`, `hover-card`->`.devicePort`/`--accent`,
`pipeline`->`.bench`/`data-bench`, `ambience` section names, `[data-station]`
queries in several files); every-behavior `window.scroll*` reads.

Key design findings: (1) the single-`ctx.owner` locomotion slot conflates
actuators that never conflict (gaze/face/fx) - fixed by per-channel arbitration;
(2) terrain rebuild cancels routes without firing callbacks - fixed by the
event-based motor; (3) `stationStore` + the plug-cable handshake are already the
right Fixture primitives (opaque states + a target-state-parameterized handshake).

## Appendix B: current API -> framework API mapping

| Today | Framework |
| --- | --- |
| `mountRobot(opts)` handle | `mount(config)` handle |
| character def `{params, palette, legs, face, buildBody/Head}` | unchanged (`Character`) |
| behavior `{priority, update(ctx)->bool, on*}` | `Behavior {priority, channels, update(world,self)->Bid, onEvent}` |
| `ctx` (Director, Robot, api, page, section, sensors, owner) | `world` (read-only) + `self` (intent-scoped) |
| single `ctx.owner` job slot | per-channel arbitration + hysteresis |
| `api.graph/segFor/segsByTag` | `world.graph` + `world.planRoute` + region queries |
| `api.stationState/setStation`, `data-station` | `world.fixtures` + guarded `Store`, `data-fixture` (opaque multi-state) |
| `robot.commandGoto*` (imperative + onDone) | locomotion `Intent` + world events (`arrived`/`routeFailed`) |
| `director.lookAt / shrug`, `face.set`, `fx.*` | gaze / face / fx `Intent`s |
| `nearestOther(api, R)` | `world.bysters.named/nearest/nearestUnknown` |
| `NAV`/`NAV_AGILE`/`edgeAllowed`/`planRoute(caps)` | unchanged (`core/path/caps.js`) |
| `window.scroll*` reads (~10 files) | injected `Space` |
| `document.querySelectorAll('[data-terrain]')` | injected terrain source (`data-walk`) |
