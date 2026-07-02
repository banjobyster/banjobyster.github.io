import React, { useEffect, useState } from "react";
import "./App.css";
import { useProjects } from "./hooks/useProjects";
import ProjectCard from "./components/ProjectCard";
import RepoCard from "./components/RepoCard";

function App() {
  const { featured, repos, state } = useProjects();

  const words = [
    " am a CS Undergrad",
    " love problem solving",
    " am a competitive programmer",
    " am a developer",
    " love learning new skills",
    " wanna be everything at once!",
  ];

  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [blink, setBlink] = useState(true);
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    if (index === words.length - 1 && subIndex === words[index].length) {
      return;
    }

    if (
      subIndex === words[index].length + 1 &&
      index !== words.length - 1 &&
      !reverse
    ) {
      setReverse(true);
      return;
    }

    if (subIndex === 0 && reverse) {
      setReverse(false);
      setIndex((prev) => prev + 1);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1));
    }, Math.max(reverse ? 75 : subIndex === words[index].length ? 1000 : 150, parseInt(Math.random() * 350)));

    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse]);

  useEffect(() => {
    const timeout2 = setTimeout(() => {
      setBlink((prev) => !prev);
    }, 500);
    return () => clearTimeout(timeout2);
  }, [blink]);

  return (
    <div>
      <div id="cont">
        <div id="desc">
          <h1>
            <span className="hoverText">H</span>
            <span className="hoverText">e</span>
            <span className="hoverText">l</span>
            <span className="hoverText">l</span>
            <span className="hoverText">o</span>
            <span className="hoverText">! </span>
            <span className="hoverText">M</span>
            <span className="hoverText">y </span>
            <span className="hoverText">N</span>
            <span className="hoverText">a</span>
            <span className="hoverText">m</span>
            <span className="hoverText">e </span>
            <span className="hoverText">i</span>
            <span className="hoverText">s </span>
            <span className="name">Sayan Bakshi</span>
            <span className="hoverText">. </span>
            <br />
          </h1>
          <h1 id="changingText" style={{ padding: "0px 80px 80px 80px" }}>
            I {`${words[index].substring(0, subIndex)}${blink ? "|" : " "}`}
          </h1>
          <div id="test">
            <div id="test2">
              <img src="avatarFace.png" alt="avt" id="avatar" />
            </div>
          </div>
        </div>
        <div id="welcomeMessage">Welcome to my Portfolio</div>
      </div>

      <div id="project">
        <h1>
          ꧁ <sub>Projects</sub> ꧂
        </h1>
        {featured.map((p) => (
          <ProjectCard key={p.id ?? p.title} {...p} />
        ))}
      </div>

      <div id="moreProjects">
        <h1>
          ꧁ <sub>More on GitHub</sub> ꧂
        </h1>
        {state === "loading" && (
          <div className="repoNote">Loading repositories…</div>
        )}
        {state === "error" && (
          <div className="repoNote">
            Couldn’t reach GitHub right now — check out the rest on{" "}
            <a
              href="https://github.com/banjobyster"
              target="_blank"
              rel="noreferrer"
            >
              my profile
            </a>
            .
          </div>
        )}
        {state === "ready" && repos.length === 0 && (
          <div className="repoNote">No other public repositories yet.</div>
        )}
        <div className="repoGrid">
          {repos.map((r) => (
            <RepoCard key={r.id} repo={r} />
          ))}
        </div>
      </div>

      <div id="About_Me">
        <h1>About Me</h1>
        Hi folks, Sayan here. I'm a software engineer with full-stack experience,
        focused on backend systems, infrastructure, and platform tooling. I enjoy
        competitive programming and building things from scratch - whether it's a
        ray tracer in C++ or running GPT-2 in the browser.
      </div>

      <div id="footer">
        <div style={{ marginTop: "30px" }}>
          <a
            id="link"
            href="mailto:sayanbakshi2002@gmail.com"
            title="Contact me"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa fa-envelope"> </i> sayanbakshi2002@gmail.com
          </a>
        </div>
        <div id="holder_contact_links">
          <a
            href="https://www.linkedin.com/in/sayan-bakshi-103546204/"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa fa-linkedin"></i>
          </a>
          <a
            href="https://github.com/banjobyster"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa fa-github"></i>
          </a>
          <a
            href="https://www.instagram.com/bakshi_sayan/"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa fa-instagram"></i>
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
