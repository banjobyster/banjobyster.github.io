import "./App.css";
import { useProjects } from "./hooks/useProjects";
import ProjectCard from "./components/ProjectCard";
import RepoCard from "./components/RepoCard";
import Cable from "./components/Cable";
import ThemeToggle from "./components/ThemeToggle";
import {
  IconGitHub,
  IconLinkedIn,
  IconInstagram,
  IconMail,
  IconArrowDown,
} from "./components/Icons";
import { GITHUB_USER } from "./data/projects";

const EMAIL = "sayanbakshi2002@gmail.com";
const LINKS = {
  github: `https://github.com/${GITHUB_USER}`,
  linkedin: "https://www.linkedin.com/in/sayan-bakshi-103546204/",
  instagram: "https://www.instagram.com/bakshi_sayan/",
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
      <ThemeToggle />
      <Cable />

      <header className="hero">
        <p className="eyebrow mono">SAYAN BAKSHI · PORTFOLIO</p>
        <h1 className="heroName" data-terrain="hero">
          Sayan Bakshi
        </h1>
        <p className="heroRole" data-terrain="hero">
          Software engineer: backend systems, infra, and platform tooling.
        </p>
        <div className="heroSocials" data-terrain="hero">
          <a href={LINKS.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            <IconGitHub />
          </a>
          <a href={LINKS.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <IconLinkedIn />
          </a>
          <a href={LINKS.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
            <IconInstagram />
          </a>
          <a href={`mailto:${EMAIL}`} aria-label="Email">
            <IconMail />
          </a>
        </div>
        <div className="portRow" data-terrain="port-row">
          <span className="portJack" id="port" data-terrain="port" aria-hidden="true">
            <i />
          </span>
          <span className="portLabel mono">PORT DATA-01</span>
          <span className="portRule" aria-hidden="true" />
          <span className={`stamp mono stamp-${state}`} role="status">
            <i className="stampLed" aria-hidden="true" />
            {portStamp(state, featured.length + repos.length)}
          </span>
        </div>
        <a className="scrollCue mono" href="#featured">
          SCROLL
          <IconArrowDown />
        </a>
      </header>

      <section className="section" id="featured">
        <h2 className="sectionHead" data-terrain="heading">
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
        <h2 className="sectionHead" data-terrain="heading">
          <span className="headIndex mono">02</span>
          More on GitHub
          <span className="headRule" aria-hidden="true" />
          <a className="headLink mono" href={LINKS.github} target="_blank" rel="noreferrer">
            github.com/{GITHUB_USER} ↗
          </a>
        </h2>
        <div className="hatch" data-terrain="hatch">
          <span className="hatchGrille" aria-hidden="true" />
          <span className="hatchLabel mono">EXT STORAGE</span>
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
        <h2 className="sectionHead" data-terrain="heading">
          <span className="headIndex mono">03</span>
          About
          <span className="headRule" aria-hidden="true" />
        </h2>
        <div className="aboutBody" data-terrain="about">
          <p>
            Sayan here. I am a software engineer with full-stack experience,
            focused on backend systems, infrastructure, and platform tooling.
            Away from work I enjoy competitive programming and building things
            from scratch, whether that is a ray tracer in C++ or GPT-2 running
            in the browser.
          </p>
          <ul className="chips mono">
            {SKILLS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="section" id="contact">
        <h2 className="sectionHead" data-terrain="heading">
          <span className="headIndex mono">04</span>
          Contact
          <span className="headRule" aria-hidden="true" />
        </h2>
        <div className="contactBody" data-terrain="contact">
          <a className="contactMail" href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
          <div className="contactLinks">
            <a href={LINKS.github} target="_blank" rel="noreferrer">
              <IconGitHub /> GITHUB
            </a>
            <a href={LINKS.linkedin} target="_blank" rel="noreferrer">
              <IconLinkedIn /> LINKEDIN
            </a>
            <a href={LINKS.instagram} target="_blank" rel="noreferrer">
              <IconInstagram /> INSTAGRAM
            </a>
          </div>
        </div>
        <div className="footerBar">
          <span className="cableEndSocket" id="cableEnd" data-terrain="socket" aria-hidden="true" />
          <span className="mono">© 2026 SAYAN BAKSHI</span>
          <span className="mono">EOF</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
