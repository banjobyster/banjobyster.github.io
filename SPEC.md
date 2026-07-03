# Portfolio v3 spec: the runtime crawler

Status: DRAFT for owner review. Nothing gets built until this document is signed off.
This replaces the dead v2 spec entirely; do not reference archived branches for direction.

## 1. Concept

A single-page minimal portfolio with one procedurally animated robot crawler living on a
canvas overlay. The robot is not decoration: it personifies the site's actual runtime.
Its face and behavior are driven by the real `useProjects` fetch lifecycle (loading,
ready, error), it treats the DOM layout as physical terrain, and it reacts to the
visitor's cursor, scroll, and clicks.

Two lessons from the failed attempts, encoded as rules:

1. v1 failed because the renderer was hand-rolled. Rule: PixiJS 8 renders everything
   robot-related. No custom engine code beyond game logic (IK, FSM, sensors).
2. v2 failed because there was no technical direction and polish never landed. Rule:
   this spec defines the implementation approach per system, and milestone M0 is a
   motion-quality gate the owner must pass before any site integration happens.

## 2. Hard constraints

- The data layer is untouched: `useProjects`, `src/lib/github.js`, `src/data/projects.js`,
  and the `templates/portfolio/` manifest system stay the single source of truth.
- The DOM page is a complete, sharp, minimal portfolio on its own. The robot overlay is
  purely additive. `prefers-reduced-motion` or missing WebGL means no canvas at all.
- Native scrolling only. No scroll-jacking, no snap, no virtual scroll.
- Mobile-first responsive. Touch devices get a simplified robot (scroll/tap reactive).
- No em dashes anywhere in site copy.

## 3. Page structure (the minimal fallback site)

Single page, five sections, one diegetic motif: a thin dashed vertical "data cable"
running from a port in the hero down to the footer. Pure CSS, present with or without
the robot, and it doubles as the scroll progress indicator (fills with accent color).

1. Hero. Name, one-line role statement (software engineer: backend, infra, platform
   tooling), social links, scroll cue. The typewriter and "CS Undergrad" copy are gone.
2. Featured projects. Single-column large cards (they are the robot's platforms), driven
   by manifests exactly as today: title, tagline, description with **accent** words,
   cover, tags, accent color, order. Each card has a small port and an LED strip in its
   accent color; hover powers the card on (glow, tags light sequentially). Hover effects
   work without the robot.
3. More on GitHub. Compact repo grid as today (name, description, language, stars) with
   a small hatch element at the top of the grid. Cards stagger in as data resolves.
4. About. Two or three sentences, current role, a few skill chips. The professional
   anchor; kept clean.
5. Contact. Email, GitHub, LinkedIn, Instagram. End of the cable.

Loading contract (unchanged in spirit from today): first paint is instant with FALLBACK
featured cards; live data replaces it when ready; `state === "error"` shows the fallback
plus an "offline mode" stamp near the hero port instead of an apology string.

## 4. The robot

### 4.1 Body plan: Pixar CRT toddler (revised 2026-07-03 per owner reference image;
### final look signed off 2026-07-03, second review session)

- A small Pixar-styled machine: a big oversized CRT monitor head (green pixel face on
  a dark screen with glass shine, beige-gray bezel, glowing power light), a small blue
  chest, and 4 accordion legs with NO joints. No antennae (cut by owner).
- Accordion legs (the signed-off design): each leg is a dark near-black stretchy inner
  core under 4 hard light-gray rings. The rings never deform; they sit flush at rest,
  spread apart when the leg reaches (climbs, big steps), and stack when compressed
  (sleep, crouch). Legs are deliberately in the gray bezel material family, NOT body
  blue, so the stretchy part reads as a different material from the solid body.
  Rejected on review: straight blue capsules, telescoping tubes.
- Overall size runs 1.4x the first build via `P.scale` in DEFAULT_PARAMS. Every
  authored pixel offset in gait.js and maneuvers.js multiplies by `P.scale`; keep that
  invariant when adding motion.
- Walks on card edges, headings, and viewport edges; nervous and quick.
- All geometry is flat vector shapes drawn in Pixi (Graphics/simple meshes), a flat
  cartoon read of the reference render. No sprite art, no textures. Visual quality
  comes from motion plus simple two-tone shading and a soft ground shadow.

### 4.2 Locomotion (the make-or-break system)

- Legs: single-segment accordion capsules (see 4.1), no joints, no IK. Character comes
  from the step scheduler, body springs, ring spread/stack, and squash on landing, not
  from limb articulation.
- Gait: step scheduler. A foot steps when its anchor drifts past a threshold from its
  rest pose; diagonal pairs alternate; a step is a parabolic swing of 80-120 ms.
  Threshold and swing time scale with body speed so idling looks calm and fleeing looks
  frantic.
- Body: height is a spring toward the average of planted feet plus a subtle bob; pitch
  and lean derive from acceleration; landing after a fall compresses then recovers.
- Terrain: axis-aligned surfaces from live DOM bounding rects (card tops/sides, section
  headings, viewport edges), cached and refreshed on scroll/resize via
  IntersectionObserver plus a measure pass. The robot can walk, climb an edge, hang
  from an underside briefly, hop gaps, and tumble on fast scroll.
- The robot is a viewport companion: it exists in viewport space and stays near the
  visible content rather than being pinned to a document position.

### 4.2b Navigation: plan smart, execute clumsy

The Rain World split: intelligence in the route, charm in the execution.

- Terrain compiler: DOM rects are compiled into walkable edge segments, linked into a
  nav graph with typed transitions (walk-along, corner-climb, gap-hop up to a max
  distance, drop-down). The graph is invalidated and rebuilt when scroll or resize
  moves the layout.
- Planner: A* over the nav graph. The robot always has a real route to its goal and
  never wanders into an unreachable state.
- Executor with authored noise: each transition has a small set of scripted outcomes
  (clean landing, scramble, missed hop that becomes a ledge grab and pull-up, tumble
  ending in a shake-off), chosen by weighted random. Stumbles are ALWAYS authored
  recovery moves that end back on the planned route. Genuine emergent physics failure
  is forbidden: it reads as a bug, not a personality.
- STATUS 2026-07-03: stumble outcomes are DISABLED (first pass looked bad). All
  transitions execute clean. Stumbles return only when individually re-authored and
  approved; they are no longer an M0 gate requirement.
- Noise scales inversely with stakes. Idle wandering runs high noise (distraction,
  overshooting corners, abandoning a route because the cursor moved, sitting down in
  odd spots). Purposeful jobs (fetch theater, reaching a hovered card) run near-zero
  noise so functional beats never stall. The contrast between goofing off and snapping
  into competence IS the toddler personality.
- If terrain vanishes mid-route (scrolled away), the robot replans; if stranded, it
  plays a viewport-edge grab or tumbles out and re-enters from offscreen.

### 4.2c Level design contract (BINDING for M1 layout, desktop and mobile)

The robot can only traverse what the nav graph allows. These are the numbers in
`src/robot/terrain.js` (NAV constants); they are absolute CSS pixels and deliberately
do NOT scale with the robot's `P.scale` (layouts are authored in px, so the traversal
rules must be stable px values too). M1 must design so that every platform the robot
is expected to reach satisfies them at EVERY breakpoint:

- Gap-hop: horizontal gap between facing edges of 6 to 120px, vertical difference
  between the two tops at most 80px.
- Corner-climb: wall height (difference between the two surface tops) at most 95px,
  and the lower surface must extend at least ~12px past the upper surface's corner
  (the robot needs standable approach space beside the wall).
- Drop: at most 320px down, again with ~12px of clear space beside the corner.
- Standing: a surface needs roughly 40px of width to be worth standing on (stance is
  ~26px wide at rest, and segments are inset 2px from rect corners).
- Reachability rule: the page ground (viewport bottom edge or an equivalent baseline
  surface) plus the platforms must form a CONNECTED graph via the moves above. Nothing
  the robot has a job on may be reachable only by teleport.
- Mobile consequence (the binding one): stacked single-column cards are traversed by
  climbing, so consecutive card TOPS must be at most 95px apart (card height + gap),
  and consecutive cards need alternating horizontal offsets so each upper corner has
  approach space on the card below. The sandbox mobile preset
  (`/sandbox.html?debug=1&layout=mobile`) is the living proof of this pattern: 390px
  frame, 64px cards, 24px gaps, alternating 98px offsets. If a mobile design cannot
  meet this, it must provide intermediate steps (ports, chips, decorative ledges) or
  accept the robot only descending through that section.

### 4.2d M1 level design as built (STATUS 2026-07-03, M1 build session; the
### terrain handoff M2 integrates against)

The M1 layout implements 4.2c with a "cable ladder" pattern. Everything below
is measured behavior, verified by `scripts/check-terrain.mjs` feeding real DOM
rects into `compileTerrain` at 1280/768/390/320 widths: every visible platform
is reachable from the viewport-bottom ground at every scroll position.

- Geometry: a fixed 76px left gutter at every breakpoint holds the dashed
  cable; content starts at page x=76. The cable's clips are 44x10px rungs at
  gutter x 6..50 and 22..66 (alternating), spaced uniformly at most 80px apart
  (the hop rise limit, deliberately tighter than the 95px climb limit, so a
  rung scrolled off the top can always be replaced by a hop from the rung
  below). The hero port jack (gutter x 22..66) is rung zero; the footer socket
  is the rail end, with the last clip 44px above it. Clip generation lives in
  `clipPositions()` in `src/components/Cable.jsx`; anything in the content
  column is hoppable from the rail (10px or 26px gap).
- Hero staircase: name, role line (indented 16px), socials row, and port row
  stack with tops at most 95px apart and staggered widths for corner approach,
  so the robot can climb from the port row up to the name.
- `data-terrain` inventory (value = semantic role for M2 jobs): `clip` (rail
  rungs), `hero` (name, role, socials), `port` (hero jack, boot plug-in
  target), `port-row` (the stamp bar; the fetch stamp lives here), `heading`
  (section header rows, full column width), `card` (featured devices; each has
  a `.devicePort` visual for the hover plug-in), `hatch` (repo bay above the
  grid), `repo` (compact repo plates), `about` (portrait sit spot), `contact`
  (sleep spot), `socket` (cable end), `bench` (hero test-bench hardware, added
  in the M2 feedback pass: crate/scope/tower staircase in the hero's lower
  band, decorative playground platforms).
- M2 obligations implied by this build: synthesize the ground as a full-width
  rect at the viewport bottom edge (as the sandbox does with #ground); rebuild
  terrain on scroll/resize AND on ResizeObserver of the body, since the rail
  re-measures itself the same way (live data swap, fonts, and images all move
  the layout); ignore rects mid-animation (repo cards translate 10px while
  staggering in; a 150ms debounce after `state === "ready"` is enough). The
  loading/ready/error stamp near the hero port is rendered by the DOM site
  (SYNCING / LINK OK / OFFLINE MODE); the robot's fetch theater attaches to
  the same `useProjects` state without touching the stamp.
- Regression rule: any layout change to terrain-tagged elements must re-run
  `scripts/check-terrain.mjs` (capture snippet in the file header). Hover
  states on terrain elements must never transform their rects.

### 4.3 Face

- Offscreen low-res pixel buffer (around 16x12), upscaled nearest-neighbor onto the head
  screen for an LED-matrix look.
- Expression states: idle, blink, curious, sync (while fetching), happy (fetch success),
  glitch (fetch error), sleepy, portrait (a tiny pixel portrait of Sayan, used once in
  the About section).
- Eyes track the cursor whenever no stronger expression is active.

### 4.4 Behavior

- Personality principle: a toddler with a job. Clumsy, distractible, and nosy while
  idle; focused and quick when it has a task. All goofiness comes from the executor
  noise layer (4.2b) and idle goal selection, never from the planner or the FSM.
- Plain finite state machine, no learned anything. States: wake, idle, wander, follow,
  inspect (hovered card), work (fetch theater), error, startled, sleep.
- Sensors: cursor position/velocity, scroll velocity, hovered card, `useProjects` state,
  idle timer, section currently in view.
- Boot: subtle wake. The robot is already on the hero when the page loads; its eyes
  flick on, it looks around, walks to the hero port and plugs in while the real fetch
  runs. On ready: happy blink plus a "N repos synced" mono stamp. On error: spark,
  glitch face, shrug, "offline mode" stamp.
- Section jobs (triggered when a section crosses mid-viewport):
  - Hero: idle-follow the cursor; click reactions that escalate on repeat clicks.
  - Featured: walk along card tops; on card hover, scuttle over, plug into the card's
    port, face tints to the card accent while it "reads".
  - More on GitHub: if fetch is still in flight, reel repo cards out of the hatch as
    each resolves; otherwise wander the grid, peek under a card, polish a star.
  - About: sit beside the text, show the pixel portrait.
  - Contact: unplug from the cable, wave; on idle, curl up and sleep with pixel Zzz.
- Cursor interplay everywhere: startle-dodge if the cursor rushes it, cautious approach
  if the cursor sits still near it.

### 4.5 Mobile (touch) profile

- No cursor sensors. Inputs: scroll velocity, taps on the robot, section changes.
- Smaller robot, fewer simultaneous behaviors, same face states.

## 5. Architecture

- React DOM app (existing stack, React 19 + Vite 7) renders the fallback site.
- One `<RobotOverlay>` component mounts a full-page transparent PixiJS 8 canvas,
  `position: fixed; inset: 0; pointer-events: none; z-index` above content.
- Robot code lives in `src/robot/` as plain modules (ik.ts-style pure functions, fsm,
  sensors, face, terrain), Pixi only at the render edge. React communicates page state
  (fetch state, hovered card, section in view) through a small event bus or context.
- Integration surface (build in M2, respect in M1): site code never touches robot
  internals. A single facade module will expose roughly: mount/unmount the overlay,
  set terrain from `[data-terrain]`-tagged elements, goto(element), set expression,
  and arrive/sleep events. M1's only obligations are tagging terrain elements with
  `data-terrain` and honoring the level design contract (4.2c). Terrain rebuilds are
  debounced (the sandbox already does 150ms on scroll/resize); real pages also reflow
  on image/font load, so M2 should rebuild on ResizeObserver too.
- Interaction with the robot itself (clicks) uses hit-testing on the canvas via a
  document-level listener, since the canvas ignores pointer events.
- Performance budget: 60 fps on a mid laptop, DPR capped at 2, rAF paused when the tab
  is hidden, robot sleeps (near-zero work) after long inactivity.

## 6. Milestones and review gates

- M0 robot sandbox. The robot alone on a blank test page with a few dummy boxes as
  terrain: nav graph + A* route to a clicked target, gait on flat ground and ledges,
  gap-hop and corner-climb (clean, no stumbles), cursor tracking, 3 face expressions.
  GATE: owner judges whether the motion feels alive and the art style matches the
  agreed reference. Iterate or kill here; no site work before sign-off.
  - STATUS: GATE CLOSED 2026-07-03. Owner signed off on look and motion (accordion
    legs, no antennae, 1.4x scale, lean fix, climb re-grab fix). Committed on main.
    Stumbles remain disabled and re-enter one-by-one with owner approval only.
- M1 fallback site. The redesigned minimal DOM page, no robot: all five sections, cable
  motif, responsive, reduced-motion clean, data layer wired as today. The layout MUST
  satisfy the level design contract (4.2c) at every breakpoint, because M2 will not
  get to change the layout to fix traversal. GATE: owner signs off that the site
  stands alone.
  - STATUS 2026-07-03: built, pending owner review. Visual direction picked by
    owner: "beige lab hardware" (light-first warm beige, device-faceplate
    cards, silkscreen mono labels) with a manual theme toggle defaulting to
    system dark/light. Layout verified against 4.2c via
    `scripts/check-terrain.mjs` at 1280/768/390/320 (see 4.2d for the as-built
    terrain handoff). Data layer untouched; old typewriter/neumorphic site and
    the font-awesome CDN removed; fonts self-hosted (Space Grotesk + JetBrains
    Mono via fontsource).
- M2 integration. DOM-rect terrain, viewport companionship, section jobs, fetch-state
  theater, error path. GATE: full walkthrough on desktop.
  - STATUS 2026-07-03 (M2 build session): BUILT, pending owner desktop walkthrough.
    As built: facade at `src/robot/facade.js` (mountRobot -> handle with unmount,
    goto, setExpression, on; page state read through a getPageState callback so
    React never pushes into robot internals); behavior brain at
    `src/robot/director.js` (boot plug-in theater, hovered-card plug with accent
    face tint, hero follow + escalating click reactions, hatch reel-in, About
    portrait sit, contact wave/sleep, cursor curiosity, poke escalation);
    `src/robot/effects.js` (plug cable to live DOM ports, sparks, Zzz).
    Coordinate model: robot logic runs in DOCUMENT space and the Pixi world is
    offset by -scroll each frame, so routes and in-flight maneuvers survive
    scrolling; the synthesized ground rides the viewport bottom edge; terrain
    rebuilds rebind the robot to the element it stood on (no teleports) and a
    stranded robot re-enters with a drop from offscreen. `?robot=debug` exposes
    window.__robot plus a director event trail. Verified: live-DOM terrain
    connectivity PASS at 1280/768/390/383 widths with live repo data, sandbox
    desktop + mobile regression OK, production build OK, no console errors.
- M3 polish. Mobile profile, easter eggs, timing passes, performance validation, QA
  against the fallback ladder.

## 7. Open items (decide before or during M1)

- Visual language of the minimal site: palette, typography, dark/light. The old
  neumorphic look is retired; the new look is undecided.
- Whether the robot has a name (shown subtly, e.g. in the footer or a console log).
- Exact hero role line and About copy.
- Whether featured card hover glow uses the manifest accent as-is or a normalized
  palette.
