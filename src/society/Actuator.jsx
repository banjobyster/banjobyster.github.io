import { ACTUATORS, fixtureAttrs } from "./actuators";

// Renders one actuator as a value-neutral Fixture root. The framework mirrors
// the fixture's store state onto data-state; we pass only the INITIAL state via
// React, and because that prop never changes, React never re-writes the
// attribute, so the framework owns data-state after mount (a byster that breaks
// a device stays broken across the site's data-driven re-renders).
//
// `inner` is stamped with dangerouslySetInnerHTML from the shared registry, so
// the site and the standalone gallery render byte-identical guts.
export default function Actuator({ type, id, className = "", style, state }) {
  const entry = ACTUATORS[type];
  if (!entry) return null;
  return (
    <div
      className={`act act-${type}${className ? ` ${className}` : ""}`}
      style={style}
      role="img"
      aria-label={entry.label}
      {...fixtureAttrs(entry, id, state)}
      dangerouslySetInnerHTML={{ __html: entry.inner }}
    />
  );
}
