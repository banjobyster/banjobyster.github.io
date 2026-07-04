import { useEffect, useSyncExternalStore } from "react";
import { stationStore } from "../stations/store";

// Task stations (Part 3): DOM elements the robot cast fights over. A station
// is any element tagged data-station="<name>" with data-state="ok" | "broken"
// | "busy", styled per state in App.css (LED colors and a glow; never a
// transform, so the robot's terrain rects stay put).
//
// State is owned by the shared stationStore (a synchronous observable). Robot
// behaviors read and write it directly through the overlay facade; this hook
// just mirrors a station's state into React so the DOM data-state attribute
// (and its CSS) follows along. That keeps the robot stack decoupled from React
// while removing the old event-and-async-commit round trip.
export function useStation(name) {
  useEffect(() => {
    if (name) stationStore.register(name);
  }, [name]);
  return useSyncExternalStore(
    stationStore.subscribe,
    () => (name ? stationStore.get(name) : "ok"),
  );
}
