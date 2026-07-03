import { useEffect, useState } from "react";

// Task stations (Part 3c): DOM elements the robot cast fights over. A station
// is any element tagged data-station="<name>" with data-state="ok" | "broken"
// | "busy", styled per state in App.css (LED colors and a glow; never a
// transform, so the robot's terrain rects stay put).
//
// React owns the state. Robot behaviors REQUEST a change by dispatching a
// window CustomEvent (the villain sets "broken", the hero sets "busy" then
// "ok") and READ the current state straight off the data-state attribute.
// That keeps the robot stack decoupled from React: it only ever touches the
// DOM, never imports a component. The event name is duplicated in
// src/robot/behaviors/util.js on purpose (the robot side must not import site
// code); the two strings must stay in sync.
export const STATION_EVENT = "robot:station";

const VALID = new Set(["ok", "broken", "busy"]);

// Reflect a station's state. Pass name=null for elements that are not a
// station (e.g. non-first cards) so the hook stays unconditional but inert.
export function useStation(name, initial = "ok") {
  const [state, setState] = useState(initial);
  useEffect(() => {
    if (!name) return undefined;
    const onSet = (e) => {
      const d = e.detail;
      if (!d || (d.name !== name && d.name !== "*")) return;
      if (VALID.has(d.state)) setState(d.state);
    };
    window.addEventListener(STATION_EVENT, onSet);
    return () => window.removeEventListener(STATION_EVENT, onSet);
  }, [name]);
  return state;
}
