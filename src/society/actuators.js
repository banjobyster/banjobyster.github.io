// The actuator registry: the single source of truth for every crafted device
// the bysters operate. Both the live site (via <Actuator/>) and the standalone
// gallery generator read this, so the two never drift.
//
// Each entry is a value-neutral Fixture description:
//   fixture   - the data-fixture type label (opaque to the framework)
//   states    - the ordered state set; states[0] reads "healthy", states[1]
//               reads "degraded" (see actuators.css)
//   transitions - guard pairs "a>b" as an array (both directions, so either a
//               fixer or a gremlin can drive it)
//   label / blurb - human copy for the gallery
//   theme     - which layer it belongs to (backend | tooling | platform)
//   inner     - the inner HTML (guts) rendered inside the .act root
//
// The root element (with data-fixture / data-states / data-state /
// data-transitions) is built by whoever renders it, so `inner` stays pure
// markup with no wiring.

export const ACTUATORS = {
  rack: {
    fixture: "rack",
    states: ["online", "degraded"],
    transitions: ["online>degraded", "degraded>online"],
    label: "Server rack",
    blurb: "Blinking units with cooling fans; degrades to a red fault.",
    theme: "platform",
    inner: `
      <span class="rk-body">
        <span class="rk-unit"><span class="rk-leds"><i></i><i></i><i></i></span><span class="rk-fan"></span></span>
        <span class="rk-unit"><span class="rk-leds"><i></i><i></i><i></i></span><span class="rk-fan"></span></span>
        <span class="rk-unit"><span class="rk-leds"><i></i><i></i><i></i></span><span class="rk-fan"></span></span>
      </span>`,
  },
};

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
