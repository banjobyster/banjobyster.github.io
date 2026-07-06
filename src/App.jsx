import "./App.css";
import { useProjects } from "./hooks/useProjects";
import ProjectCard from "./components/ProjectCard";
import RepoCard from "./components/RepoCard";
import Cable from "./components/Cable";
import ThemeToggle from "./components/ThemeToggle";
import BystersOverlay from "./components/BystersOverlay";
import {
  IconGitHub,
  IconLinkedIn,
  IconMail,
  IconArrowDown,
} from "./components/Icons";
import { GITHUB_USER } from "./data/projects";

const EMAIL = "sayanbakshi2002@gmail.com";
const LINKS = {
  github: `https://github.com/${GITHUB_USER}`,
  linkedin: "https://www.linkedin.com/in/sayan-bakshi-103546204/",
};

const SKILLS = ["Go", "C++", "JavaScript", "React", "Postgres", "Kafka", "Python"];

function portStamp(state, count) {
  if (state === "error") return "OFFLINE MODE";
  if (state === "ready") return `LINK OK · ${count} REPOS`;
  return "SYNCING";
}

function App() {
  const { featured, repos, state } = useProjects();

  return (
    <div id="page">
      <div className="topNav">
        <a
          className="navLink mono"
          href="https://banjobyster.github.io/bysters/"
          target="_blank"
          rel="noreferrer"
          aria-label="bysters: the open-source framework these creatures run on"
        >
          BYSTERS
          <span className="navArrow" aria-hidden="true">↗</span>
        </a>
        <ThemeToggle />
      </div>
      <Cable />
      <BystersOverlay dataReady={state === "ready"} />

      <header className="hero region">
        <h1 className="heroName" data-walk>Sayan Bakshi</h1>
        <p className="heroRole" data-walk>
          Software engineer: backend systems, platform tooling, and competitive programming.
        </p>
        <div className="heroSocials" data-walk>
          <a href={LINKS.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            <IconGitHub />
          </a>
          <a href={LINKS.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <IconLinkedIn />
          </a>
          <a href={`mailto:${EMAIL}`} aria-label="Email">
            <IconMail />
          </a>
        </div>
        <div className="portRow" data-walk>
          <span className="portJack" id="port" aria-hidden="true">
            <i />
          </span>
          <span className="portLabel mono">PORT DATA-01</span>
          {/* The intake valve: the head of the whole machine. Close it and
              the feed dies page-wide (pipeline starves, ports dim, the neon
              browns out) until the operator, or you, reopens it. */}
          <span
            className="fx fxIntake"
            data-fixture="intake"
            data-fixture-id="intake-main"
            data-states="open closed"
            data-state="open"
            data-transitions="open>closed closed>open"
            role="button"
            tabIndex={0}
            aria-label="data intake: click to close or open the feed"
            style={{ "--pulse": 0 }}
          />
          <i className="fxTag mono" aria-hidden="true" />
          <span className="portRule" aria-hidden="true" />
          <span className={`stamp mono stamp-${state}`} role="status">
            <i className="stampLed" aria-hidden="true" />
            {portStamp(state, featured.length + repos.length)}
          </span>
        </div>

        {/* The deploy pipeline: a wall console in the hero's landing space.
            Otto keeps it flowing; the twins (and you) can jam it. Its top is
            terrain, so its operator patrols the console itself. */}
        <div className="ciConsole" id="ci-console" data-walk>
          <div className="ciHead mono">
            <span>DEPLOY PIPELINE</span>
            <span className="ciId">CI-01</span>
          </div>
          <div className="ciStages" aria-hidden="true">
            <span className="ciStage" data-stage="build">
              <i className="ciDot" />
              BUILD
            </span>
            <span className="ciTrack t1">
              <i className="ciPacket" />
            </span>
            <span className="ciStage" data-stage="test">
              <i className="ciDot" />
              TEST
            </span>
            <span className="ciTrack t2">
              <i className="ciPacket" />
            </span>
            <span className="ciStage" data-stage="deploy">
              <i className="ciDot" />
              DEPLOY
            </span>
          </div>
          <span
            className="fx fxPipeline"
            data-fixture="pipeline"
            data-fixture-id="ci-main"
            data-states="flowing jammed"
            data-state="flowing"
            data-transitions="flowing>jammed jammed>flowing"
            role="button"
            tabIndex={0}
            aria-label="deploy pipeline: flip the lever to halt or run"
            style={{ "--pulse": 1 }}
          />
          <i className="fxTag mono" aria-hidden="true" />
        </div>

        {/* The system log: the machine narrating itself. The overlay writes
            the last few fixture-store transitions here (who broke what, who
            fixed it), so the story is readable even before you spot a
            byster. Static boot line when the society cannot mount. */}
        <div className="sysLog" id="sys-log" aria-hidden="true">
          <span className="sysHead mono">SYS LOG</span>
          <span className="sysLine mono" data-slot="0">BOOT OK · ALL STATIONS NOMINAL</span>
          <span className="sysLine mono" data-slot="1">INTAKE OPEN · FEED LIVE</span>
          <span className="sysLine mono" data-slot="2">PIPELINE RUN · ARCHIVE SYNC · NEON ON</span>
          <span className="sysLine mono" data-slot="3" />
          <span className="sysLine mono" data-slot="4" />
          <span className="sysLine mono" data-slot="5" />
          <span className="sysLine mono" data-slot="6" />
          <span className="sysLine mono" data-slot="7" />
        </div>

        <a className="scrollCue mono" href="#featured">
          SCROLL
          <IconArrowDown />
        </a>
      </header>

      <section className="section" id="featured">
        <h2 className="sectionHead">
          <span className="headIndex mono">01</span>
          Featured projects
          <span className="headRule" aria-hidden="true" />
        </h2>
        <div className="cards">
          {featured.map((p, i) => (
            <ProjectCard key={p.id ?? p.title} {...p} index={i} />
          ))}
        </div>
      </section>

      <section className="section" id="more">
        <h2 className="sectionHead">
          <span className="headIndex mono">02</span>
          More on GitHub
          <span className="headRule" aria-hidden="true" />
          <a className="headLink mono" href={LINKS.github} target="_blank" rel="noreferrer">
            github.com/{GITHUB_USER} ↗
          </a>
        </h2>
        <div className="hatch">
          <span className="hatchGrille" aria-hidden="true" />
          <span className="hatchLabel mono">EXT STORAGE</span>
          {/* The archive datastore: every repo syncs to this node. Push the
              button to knock it offline; the engineer brings it back. */}
          <span
            className="fx fxArchive"
            data-fixture="archive"
            data-fixture-id="archive-main"
            data-states="syncing offline"
            data-state="syncing"
            data-transitions="syncing>offline offline>syncing"
            role="button"
            tabIndex={0}
            aria-label="archive datastore: push to knock offline or resync"
            style={{ "--pulse": 12 }}
          />
          <i className="fxTag mono" aria-hidden="true" />
        </div>
        <div className="repoGrid" data-state={state}>
          {state === "loading" &&
            [0, 1, 2, 3].map((i) => (
              <div className="repoCard skel" key={i} aria-hidden="true">
                <span className="skelBar w40" />
                <span className="skelBar w80" />
                <span className="skelBar w25" />
              </div>
            ))}
          {repos.map((r, i) => (
            <RepoCard key={r.id} repo={r} index={i} />
          ))}
        </div>
        {state === "ready" && repos.length === 0 && (
          <p className="note mono">NO OTHER PUBLIC REPOS YET</p>
        )}
        {state === "error" && (
          <p className="note mono">
            REPO LIST UNAVAILABLE ·{" "}
            <a href={LINKS.github} target="_blank" rel="noreferrer">
              BROWSE THE PROFILE
            </a>
          </p>
        )}
      </section>

      <section className="section" id="about">
        <h2 className="sectionHead">
          <span className="headIndex mono">03</span>
          About
          <span className="headRule" aria-hidden="true" />
        </h2>
        <div className="aboutBody" data-walk>
          <p>
            Sayan here. I like taking systems apart to see what makes them
            tick, then building my own from scratch; most of the projects
            above started exactly that way. Day to day that curiosity goes
            into the server side of products: services, data flows, and the
            internal tooling other engineers build on.
          </p>
          <ul className="chips mono">
            {SKILLS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="section region" id="contact">
        <h2 className="sectionHead">
          <span className="headIndex mono">04</span>
          Contact
          <span className="headRule" aria-hidden="true" />
        </h2>
        <div className="contactBody" data-walk>
          {/* The contact neon: the email IS the sign, lit by the last of the
              feed. The pull lever douses it; Nib (or you) relights it. */}
          <div className="neonWrap">
            <a className="contactMail" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            <span
              className="fx fxNeon"
              data-fixture="neon"
              data-fixture-id="contact-neon"
              data-states="on off"
              data-state="on"
              data-transitions="on>off off>on"
              role="button"
              tabIndex={0}
              aria-label="contact sign: pull the lever to douse or relight"
              style={{ "--pulse": 13 }}
            />
            <i className="fxTag mono" aria-hidden="true" />
          </div>
          <div className="contactLinks">
            <a href={LINKS.github} target="_blank" rel="noreferrer">
              <IconGitHub /> GITHUB
            </a>
            <a href={LINKS.linkedin} target="_blank" rel="noreferrer">
              <IconLinkedIn /> LINKEDIN
            </a>
          </div>
        </div>

        <div className="footerBar" data-walk>
          <span className="cableEndSocket" id="cableEnd" aria-hidden="true" />
          <span className="mono">© 2026 SAYAN BAKSHI</span>
          <span className="mono">EOF</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
