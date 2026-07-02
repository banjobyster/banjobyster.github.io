// Portfolio configuration + offline fallback.
//
// The site is now REPO-DRIVEN: at load it lists the GitHub repos and reads each
// one's `portfolio/project.json` (see useProjects). A repo that has that folder
// becomes a featured card (ordered by its `order`); every other repo shows up in
// the "More on GitHub" section. Nothing here needs editing to add a project —
// you add a portfolio/ folder to the repo instead.
//
// FALLBACK below is only used if the GitHub API can't be reached (e.g. the
// unauthenticated 60-req/hour limit on a shared IP), so the page is never empty.
// Its images live in /public. It can drift from the repos — it's just a safety net.

export const GITHUB_USER = "banjobyster";

// Repos never shown in "More on GitHub" (the site itself + the profile-readme repo).
export const EXCLUDE_REPOS = ["banjobyster.github.io", "banjobyster"];

export const FALLBACK = [
  {
    title: "PicoGPT Web",
    tagline: "GPT-2 running in your browser",
    description:
      "A **GPT-2** decoder stack built from scratch and run in-browser with **WebGPU**.",
    image: "picogptweb.png",
    link: "https://github.com/banjobyster/PicoGPTWeb",
    accent: "rgba(120, 210, 180, 0.9)",
    order: 10,
  },
  {
    title: "Internal Transfers Service",
    tagline: "Concurrent money transfers in Go",
    description:
      "A **Go** HTTP API for financial transfers between accounts, built on **Postgres**.",
    image: "internal-transfers.png",
    link: "https://github.com/banjobyster/internal-transfers-service",
    accent: "rgba(96, 165, 250, 0.9)",
    order: 20,
  },
  {
    title: "Two-Way Integration",
    tagline: "Catalog and Stripe, kept in sync over Kafka",
    description:
      "A **Flask** service syncing a catalog with **Stripe** in both directions via **Kafka**.",
    image: "two-way-integration.png",
    link: "https://github.com/banjobyster/two-way-integration",
    accent: "rgba(167, 139, 250, 0.9)",
    order: 30,
  },
  {
    title: "Ray Tracer",
    tagline: "Path-traced renderer in C++",
    description:
      "Ray **tracer** made with C++ and SDL2 which uses the path tracing technique.",
    image: "RayTracerImage100Sampling.png",
    link: "https://github.com/banjobyster/Ray-Tracer",
    accent: "rgba(131, 216, 255, 0.9)",
    order: 40,
  },
  {
    title: "Digit Recognizer",
    tagline: "Handwritten digit classifier",
    description:
      "A simple **neural** network built from scratch in C++ that recognizes handwritten digits.",
    image: "DigitRecognizer.png",
    link: "https://github.com/banjobyster/DigitRecognizer",
    accent: "rgba(164, 131, 255, 0.9)",
    order: 50,
  },
  {
    title: "Multiplayer Drawing & Chat",
    tagline: "Real-time drawing board with chat",
    description:
      "Multiplayer drawing app with chat functionality and **customised** avatars.",
    image: "MultiplayerDrawingChat.png",
    link: "https://multiplayerdrawingandchatwebsite.onrender.com/",
    accent: "rgba(255, 195, 131, 0.9)",
    order: 60,
  },
  {
    title: "PathFinder Simulation",
    tagline: "Visualise shortest paths in a grid",
    description:
      "A **web** based simulation made with Godot Engine to find the shortest path in a graph.",
    image: "pathFinder.png",
    link: "https://banjobyster.itch.io/pathfindersimulation",
    accent: "rgba(172, 255, 47, 0.9)",
    order: 70,
  },
  {
    title: "ASCII Snake",
    tagline: "The retro snake game in your console",
    description:
      "The **retro** snake game in ASCII, playable on the Windows console, made with C++.",
    image: "asciiSnake.png",
    link: "https://banjobyster.itch.io/ascii-snake-game",
    accent: "rgba(230, 230, 250, 0.9)",
    order: 80,
  },
  {
    title: "BlockForge VR",
    tagline: "A voxel sandbox for Meta Quest 3",
    description:
      "A **WebXR** voxel sandbox playable on **Quest 3** that also runs flat on desktop.",
    image: "blockforgevr.png",
    link: "https://github.com/banjobyster/BlockForgeVR",
    accent: "rgba(216, 122, 106, 0.9)",
    order: 90,
  },
];
