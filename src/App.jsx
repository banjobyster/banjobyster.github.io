import React, { useRef, useEffect, useState } from "react";
import "./App.css";

function App() {
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
            <span class="hoverText">H</span>
            <span class="hoverText">e</span>
            <span class="hoverText">l</span>
            <span class="hoverText">l</span>
            <span class="hoverText">o</span>
            <span class="hoverText">! </span>
            <span class="hoverText">M</span>
            <span class="hoverText">y </span>
            <span class="hoverText">N</span>
            <span class="hoverText">a</span>
            <span class="hoverText">m</span>
            <span class="hoverText">e </span>
            <span class="hoverText">i</span>
            <span class="hoverText">s </span>
            <span class="name">Sayan Bakshi</span>
            <span class="hoverText">. </span>
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
        <div class="tabs">
          <a
            href="https://multiplayerdrawingandchatwebsite.onrender.com/"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img
                src="MultiplayerDrawingChat.png"
                alt="Multiplayer drawing and chat website"
              />
            </div>
          </a>
          <div class="c_button"></div>
          Multiplayer drawing app with chat functionality and{" "}
          <span style={{ color: "rgba(255, 195, 131, 0.788)" }}>
            Customised
          </span>{" "}
          avatar.
        </div>
        <div class="tabs">
          <a
            href="https://connectin-rumd.onrender.com/"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img src="SocialMediaClone.png" alt="Social Media Clone" />
            </div>
          </a>
          <div class="c_button"></div>
          <span style={{ color: "rgba(73, 172, 233, 0.788)" }}>
            Social
          </span>{" "}
          Media Clone.
        </div>
        <div class="tabs">
          <a
            href="https://github.com/banjobyster/Ray-Tracer"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img src="RayTracerImage100Sampling.png" alt="Ray Tracer" />
            </div>
          </a>
          <div class="c_button"></div>
          Ray{" "}
          <span style={{ color: "rgba(131, 216, 255, 0.788)" }}>
            Tracer
          </span>{" "}
          made with C++ and SDL2 which uses path tracing technique to render
          frames.
        </div>
        <div class="tabs">
          <a
            href="https://github.com/banjobyster/DigitRecognizer"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img src="DigitRecognizer.png" alt="Digit Recognizer" />
            </div>
          </a>
          <div class="c_button"></div>A simple{" "}
          <span style={{ color: "rgba(164, 131, 255, 0.788)" }}>neural</span>{" "}
          network that can recognize handwritten digits.
        </div>
        <div class="tabs">
          <a
            href="https://banjobyster.itch.io/pathfindersimulation"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img src="pathFinder.png" alt="pathfindersimulation" />
            </div>
          </a>
          <div class="c_button"></div>A{" "}
          <span style={{ color: "rgba(172, 255, 47, 0.788)" }}>web</span> based
          simulation made with GodotEngine where you can find the shortest path
          in an unweighted path.
        </div>
        <div class="tabs">
          <a
            href="https://banjobyster.itch.io/asteroids3d"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img src="asteroidsGame.png" alt="Asteroids Game" />
            </div>
          </a>
          <div class="c_button"></div>
          The <span style={{ color: "goldenrod" }}> classic</span> asteroids
          game redesigned in{" "}
          <span
            style={{
              textShadow:
                "-0.35px -0.35px 1px #a9a9e0, 0.35px 0.35px 1px #000000",
            }}
          >
            {" "}
            3D
          </span>
          . Created during my first hackathon, Hack-cade, 2021 in 48 hours.
        </div>
        <div class="tabs">
          <a
            href="https://banjobyster.itch.io/ascii-snake-game"
            target="_blank"
            rel="noreferrer"
          >
            <div class="image">
              <img src="asciiSnake.png" alt="ascii snake game" />
            </div>
          </a>
          <div class="c_button"></div>
          The <span style={{ color: "rgba(230, 230, 250, 0.829)" }}>
            retro
          </span>{" "}
          snake game in ascii playable on the windows console made with C++.
        </div>
      </div>

      <div id="About_Me">
        <h1>About Me</h1>
        <img src="linkedin.png" alt="my photo" />
        Hello everyone. I am Sayan Bakshi, a computer science graduate with experience in full stack development. I have worked across various steps of the software development lifecycle as part of my internships, with exposure to documentation, testing and deployment as well.
        <br />
        <br />
        I enjoy learning new things, and the process of building things ground up. I also find delight participating in competitive coding contests and building games. I would love to connect and chat with amazing individuals like you.
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
            <i class="fa fa-envelope"> </i> sayanbakshi2002@gmail.com
          </a>
        </div>
        <div id="holder_contact_links">
          <a
            href="https://www.linkedin.com/in/sayan-bakshi-103546204/"
            target="_blank"
            rel="noreferrer"
          >
            <i class="fa fa-linkedin"></i>
          </a>
          <a
            href="https://github.com/banjobyster"
            target="_blank"
            rel="noreferrer"
          >
            <i class="fa fa-github"></i>
          </a>
          <a
            href="https://www.instagram.com/bakshi_sayan/"
            target="_blank"
            rel="noreferrer"
          >
            <i class="fa fa-instagram"></i>
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
