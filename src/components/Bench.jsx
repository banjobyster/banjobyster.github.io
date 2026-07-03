import { useEffect, useRef, useState } from "react";
import { useStation } from "./stations";

// The hero test bench, now a working toy: a tiny deploy pipeline. Clicking
// the intake crate runs BUILD on the crate, TEST on the monitor, then SHIP
// onto the rack, which lights a service slot and bumps the version stamp.
// Runs can flake (backend life); clicking again retries. Everything works
// as a pure DOM toy; the robot's supervision theater is additive (the
// director reads data-pipeline / data-failed off the container).
//
// TERRAIN CONTRACT (SPEC 4.2c): the three .benchItem boxes are robot
// platforms. Their sizes, gaps, and bottom alignment are the verified
// staircase; pipeline visuals only recolor LEDs and screen content and must
// never move the rects.

const STAGES = ["build", "test", "ship"];
const STAGE_MS = { build: 1500, test: 1900, ship: 1100 };
const FAIL_CHANCE = 0.18; // build/test only; shipping never flakes

const STATUS = {
  idle: "STBY",
  build: "BUILD",
  test: "TEST",
  ship: "SHIP",
  done: "PASS",
  fail: "ERR",
};

export default function Bench() {
  const [phase, setPhase] = useState("idle");
  const [failedStage, setFailedStage] = useState(null);
  const [builds, setBuilds] = useState(0);
  const timer = useRef(0);
  // The rack is a task station: the villain can knock it offline, the hero
  // resets it. The pipeline toy stays fully usable regardless of the station
  // state; the two only share the box.
  const rackState = useStation("rack");

  useEffect(() => () => clearTimeout(timer.current), []);

  const advance = (ix) => {
    if (ix >= STAGES.length) {
      setPhase("done");
      setBuilds((b) => b + 1);
      timer.current = setTimeout(() => setPhase("idle"), 4000);
      return;
    }
    const stage = STAGES[ix];
    setPhase(stage);
    const flakes = stage !== "ship" && Math.random() < FAIL_CHANCE;
    timer.current = setTimeout(() => {
      if (flakes) {
        setPhase("fail");
        setFailedStage(stage);
        timer.current = setTimeout(() => setPhase("idle"), 6000);
      } else {
        advance(ix + 1);
      }
    }, STAGE_MS[stage]);
  };

  const run = () => {
    if (phase === "build" || phase === "test" || phase === "ship") return;
    clearTimeout(timer.current);
    setFailedStage(null);
    advance(0);
  };

  const litSlots = Math.min(1 + builds, 3);

  return (
    <div
      className="bench"
      data-pipeline={phase}
      data-failed={phase === "fail" ? failedStage : undefined}
    >
      <button
        type="button"
        className="benchItem crate"
        data-terrain="bench"
        data-bench="intake"
        onClick={run}
        aria-label="Run the deploy pipeline"
      >
        <span className="crateGrille" aria-hidden="true" />
        <i className="benchLed" aria-hidden="true" />
        <span className="benchLabel mono">{phase === "fail" ? "RETRY" : "RUN JOB"}</span>
      </button>
      <div className="benchItem scope" data-terrain="bench" data-bench="mon" aria-hidden="true">
        <span className="scopeScreen">
          <span className="scopeStatus mono">
            {phase === "fail" ? `ERR·${(failedStage || "").toUpperCase()}` : STATUS[phase]}
          </span>
          <span className="scopeBars">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="benchLabel mono">TEST MON</span>
      </div>
      <div
        className="benchItem tower"
        data-terrain="bench"
        data-bench="rack"
        data-station="rack"
        data-state={rackState}
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={`towerSlot${i < litSlots ? " lit" : ""}`}>
            <i />
          </span>
        ))}
        <span className="benchLabel mono">RK-01 · V1.0.{builds}</span>
      </div>
    </div>
  );
}
