import { useEffect, useRef } from "react";
import { mountRobot } from "../robot/facade.js";
import { stationStore } from "../stations/store.js";

// Mounts the robot overlay. Purely additive: under prefers-reduced-motion or
// missing WebGL no canvas is created at all, and the DOM site is complete
// without it. This is the only site file that touches src/robot/, and it
// imports nothing but the facade.

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function RobotOverlay({ fetchState, repoCount, featuredCount }) {
  const pageRef = useRef(null);
  pageRef.current = { fetch: fetchState, repoCount, featuredCount };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let alive = true;
    let handle = null;
    let mounting = false;

    const start = () => {
      if (!alive || handle || mounting || mq.matches || !webglAvailable()) return;
      mounting = true;
      mountRobot({ getPageState: () => pageRef.current, stations: stationStore })
        .then((h) => {
          mounting = false;
          if (!alive || mq.matches) h.unmount();
          else handle = h;
        })
        .catch(() => {
          mounting = false; // WebGL init failed late: stay a plain DOM site
        });
    };
    const stop = () => {
      if (handle) handle.unmount();
      handle = null;
    };
    const onChange = () => (mq.matches ? stop() : start());

    mq.addEventListener("change", onChange);
    start();
    return () => {
      alive = false;
      mq.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  return null;
}
