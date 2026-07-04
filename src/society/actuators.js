// The actuator registry: the single source of truth for every crafted device
// the bysters operate. The data lives in actuators.data.json so both the live
// site (via <Actuator/>) and the standalone gallery generator
// (build-gallery.mjs) read exactly the same definitions and never drift.
//
// Each entry is a value-neutral Fixture description:
//   fixture   - the data-fixture type label (opaque to the framework)
//   states    - the ordered state set; states[0] reads "healthy", states[1]
//               reads "degraded" (all meaning lives in actuators.css)
//   transitions - guard pairs "a>b" as an array (both directions, so either a
//               fixer or a gremlin can drive it)
//   label / blurb - human copy for the gallery
//   theme     - which layer it belongs to (backend | tooling | platform)
//   inner     - the inner HTML (guts) rendered inside the .act root
//
// The root element (with data-fixture / data-states / data-state /
// data-transitions) is built by whoever renders it, so `inner` stays pure
// markup with no wiring.

import data from "./actuators.data.json";

export const ACTUATORS = data;

// Build the full attribute set for a fixture root, given a registry entry and an
// id. Returns a plain object of DOM attributes (data-*). Shared so the site and
// the gallery stamp identical markup.
export function fixtureAttrs(entry, id, stateOverride) {
  return {
    "data-fixture": entry.fixture,
    "data-fixture-id": id,
    "data-states": entry.states.join(" "),
    "data-state": stateOverride || entry.states[0],
    "data-transitions": entry.transitions.join(" "),
  };
}
