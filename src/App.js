import { useRef } from "react";
import "./App.css";

function App() {
  const changingText = useRef(null);

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
          <h1 ref={changingText} id="changingText" style={{padding: "0px 80px 80px 80px"}}>
            I
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
          <span style={{color: "rgba(255, 195, 131, 0.788)"}}>
            Customised
          </span>{" "}
          avatar.
        </div>
        <div class="tabs">
          <a href="https://connectin-rumd.onrender.com/" target="_blank" rel="noreferrer">
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
          <a href="https://github.com/banjobyster/Ray-Tracer" target="_blank" rel="noreferrer">
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
          <a href="https://banjobyster.itch.io/asteroids3d" target="_blank" rel="noreferrer">
            <div class="image">
              <img src="asteroidsGame.png" alt="Asteroids Game" />
            </div>
          </a>
          <div class="c_button"></div>
          The <span style={{ color: "goldenrod" }}> classic</span> asteroids
          game redesigned in{" "}
          <span style={{textShadow: "-0.35px -0.35px 1px #a9a9e0, 0.35px 0.35px 1px #000000"}}>
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
        Hello! My name is Sayan Bakshi and I am currently an undergraduate
        student pursuing a Bachelor's degree in Computer Science and Engineering
        from Panjab University.
        <br />
        <br />
        I have a strong passion for technology and programming, and have honed
        my skills in several programming languages, including C/C++, HTML, CSS,
        JavaScript, and SQL. Additionally, I have hands-on experience with the
        MERN stack. I am also just starting out in the world of cloud computing
        and have a beginner's understanding of AWS, demonstrating my versatility
        and commitment to staying up-to-date with industry advancements. I also
        have a strong foundation in data structures and algorithms along with
        understanding of OOPS, OS and DBMS.
        <br />
        <br />
        I have practical experience working in a startup, where I was
        responsible for building the first version of their web application and
        deploying it over the cloud. This hands-on experience has taught me the
        importance of teamwork, attention to detail, and efficient
        problem-solving.
        <br />
        <br />
        Aside from my professional work, I am also an avid lover of competitive
        programming. The thrill of racing against the clock to solve a problem
        continues to drive me every day. Competitive programming and development
        both, got the curious little kid inside me awake again, experimenting
        with things knowing no bounds.
        <br />
        <br />
        Thank you for visiting my portfolio. I am excited to continue my
        education and professional development as I work towards my goal of
        becoming a skilled software engineer.
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
          <a href="https://github.com/banjobyster" target="_blank" rel="noreferrer">
            <i class="fa fa-github"></i>
          </a>
          <a href="https://www.instagram.com/bakshi_sayan/" target="_blank" rel="noreferrer">
            <i class="fa fa-instagram"></i>
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
