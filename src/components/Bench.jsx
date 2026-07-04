import { useEffect, useRef, useState, useCallback } from "react";
import { useStation } from "./stations";
import { stationStore } from "../stations/store";

// The hero deploy pipeline. Clicking the intake crate (or the ambient
// auto-run) sends a job down BUILD -> TEST -> SHIP across the three bench
// devices. A clean run goes green all the way and lights a service slot on the
// rack.
//
// The twist (Part 4, the "one fiction" rework): failure is no longer a blind
// coin flip. While a stage runs, THAT stage's box is a live task station the
// villain can reach. If red jams it (store state -> 'broken') the deploy fails
// AT that stage and stays down until the hero repairs it (store -> 'ok'), which
// resumes the run. So red causing the failure and blue rescuing it ARE the
// pipeline's fail/recover transitions, not a separate cosmetic game. With no
// robot overlay (reduced motion / no WebGL) there is no villain, so every
// deploy simply passes: the toy still works as pure DOM.
//
// TERRAIN CONTRACT (SPEC 4.2c): the three .benchItem boxes are robot
// platforms. Their sizes, gaps, and bottom alignment are the verified
// staircase; damage visuals only recolor/overlay inside the boxes and must
// never move the rects.

const STAGES = ["build", "test", "ship"];
const STAGE_MS = { build: 2400, test: 2600, ship: 1800 };
// Each stage box becomes this station while it is the live (running or jammed)
// stage. Distinct names so they never collide with other sections' stations.
const STATION = { build: "pl-build", test: "pl-test", ship: "pl-ship" };
// If a jam is never repaired (hero scrolled away, tab hidden), auto-rollback so
// the pipeline never dead-ends.
const FAIL_SAFETY_MS = 22000;

const STATUS = {
  idle: "STBY",
  build: "BUILD",
  test: "TEST",
  ship: "SHIP",
  done: "PASS",
  fail: "ERR",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Bench() {
  const [phase, setPhase] = useState("idle");
  const [failedStage, setFailedStage] = useState(null);
  const [builds, setBuilds] = useState(0);
  const benchRef = useRef(null);

  const running = phase === "build" || phase === "test" || phase === "ship";
  // The live stage: the one running now, or the one a jam is parked on. Only
  // this box carries data-station, so red can only ever touch the active
  // deploy, never an idle box.
  const liveStage = running ? phase : phase === "fail" ? failedStage : null;
  const liveState = useStation(liveStage ? STATION[liveStage] : null);

  // Start / retry: wipe any lingering jams and send a fresh job from the top.
  const run = useCallback(() => {
    if (phase === "build" || phase === "test" || phase === "ship") return;
    for (const s of STAGES) stationStore.set(STATION[s], "ok");
    setFailedStage(null);
    setPhase("build");
  }, [phase]);

  // Stage clock: a running stage advances after its duration; done and fail are
  // terminal-ish (done auto-returns to idle; fail waits for a repair, with an
  // auto-rollback backstop).
  useEffect(() => {
    if (running) {
      const id = setTimeout(() => {
        const ix = STAGES.indexOf(phase);
        if (ix + 1 >= STAGES.length) {
          setPhase("done");
          setBuilds((b) => b + 1);
        } else {
          setPhase(STAGES[ix + 1]);
        }
      }, STAGE_MS[phase]);
      return () => clearTimeout(id);
    }
    if (phase === "done") {
      const id = setTimeout(() => setPhase("idle"), 3600);
      return () => clearTimeout(id);
    }
    if (phase === "fail") {
      const id = setTimeout(() => {
        // Nobody came: roll the stage back to healthy and let it resume.
        if (failedStage) stationStore.set(STATION[failedStage], "ok");
      }, FAIL_SAFETY_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase, running, failedStage]);

  // Coupling to the rivalry: red breaking the live stage fails it; the live
  // stage returning to healthy (hero repair or auto-rollback) resumes it.
  useEffect(() => {
    if (running && liveState === "broken") {
      setFailedStage(phase);
      setPhase("fail");
    } else if (phase === "fail" && liveState === "ok") {
      const resume = failedStage;
      setFailedStage(null);
      setPhase(resume || "build");
    }
  }, [phase, running, liveState, failedStage]);

  // Ambient auto-run so the landing is a living pipeline, not a dormant button.
  // Only while the bench is on screen and the tab is visible, and never under
  // reduced motion (there the toy stays click-only).
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const el = benchRef.current;
    if (!el) return undefined;
    let onScreen = false;
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      if (!onScreen || document.hidden || phase !== "idle") return;
      timer = setTimeout(run, 2600 + Math.random() * 4200);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        schedule();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      clearTimeout(timer);
      io.disconnect();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [phase, run]);

  const litSlots = Math.min(1 + builds, 3);
  const crateLabel =
    phase === "fail" && failedStage === "build"
      ? "JAMMED"
      : phase === "fail"
        ? "RETRY"
        : "RUN JOB";

  return (
    <div
      className="bench"
      ref={benchRef}
      data-pipeline={phase}
      data-failed={phase === "fail" ? failedStage : undefined}
    >
      <button
        type="button"
        className="benchItem crate"
        data-terrain="bench"
        data-bench="intake"
        data-station={liveStage === "build" ? STATION.build : undefined}
        data-state={liveStage === "build" ? liveState : undefined}
        onClick={run}
        aria-label="Run the deploy pipeline"
      >
        <span className="crateGrille" aria-hidden="true" />
        <i className="benchLed" aria-hidden="true" />
        <span className="benchFault" aria-hidden="true" />
        <span className="benchLabel mono">{crateLabel}</span>
      </button>
      <div
        className="benchItem scope"
        data-terrain="bench"
        data-bench="mon"
        data-station={liveStage === "test" ? STATION.test : undefined}
        data-state={liveStage === "test" ? liveState : undefined}
        aria-hidden="true"
      >
        <span className="scopeScreen">
          <span className="scopeStatus mono">
            {phase === "fail"
              ? `ERR·${(failedStage || "").toUpperCase()}`
              : STATUS[phase]}
          </span>
          <span className="scopeBars">
            <i />
            <i />
            <i />
          </span>
          <span className="benchFault" aria-hidden="true" />
        </span>
        <span className="benchLabel mono">TEST MON</span>
      </div>
      <div
        className="benchItem tower"
        data-terrain="bench"
        data-bench="rack"
        data-station={liveStage === "ship" ? STATION.ship : undefined}
        data-state={liveStage === "ship" ? liveState : undefined}
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={`towerSlot${i < litSlots ? " lit" : ""}`}>
            <i />
          </span>
        ))}
        <span className="benchFault" aria-hidden="true" />
        <span className="benchLabel mono">RK-01 · V1.0.{builds}</span>
      </div>
    </div>
  );
}
