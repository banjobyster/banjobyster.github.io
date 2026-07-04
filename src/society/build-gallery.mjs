// Generate the standalone actuator gallery: public/actuators-preview.html.
//
// Reads the single-source registry (actuators.data.json) and the device CSS
// (actuators.css) and emits a self-contained page showing every actuator in
// every one of its states, in both light and dark themes. No build step and no
// site dependency: open the file directly, or visit /actuators-preview.html.
//
// Run:  node src/society/build-gallery.mjs
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("./actuators.data.json", import.meta.url), "utf8"));
const actuatorCss = readFileSync(new URL("./actuators.css", import.meta.url), "utf8");
const out = new URL("../../public/actuators-preview.html", import.meta.url);

// Theme tokens, kept in step with src/index.css (the actuators only ever use
// these, so the gallery renders them exactly as the site does).
const TOKENS = `
:root { --font-sans: "Space Grotesk", system-ui, "Segoe UI", sans-serif; --font-mono: "JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace; }
:root[data-theme="light"] { color-scheme: light; --bg:#e9e5da; --panel:#f4f1e9; --panel-2:#ddd7c7; --screen:#23211b; --ink:#26231b; --ink-soft:#43402f; --muted:#6f6959; --line:#c6bfac; --line-soft:#d8d2c1; --accent:#1e7a3f; --led:#2fc064; --led-warn:#d9a13b; --led-err:#d96f4a; --led-off:#b5ae9c; --shadow:0 1px 2px rgba(38,35,27,.07),0 8px 20px -10px rgba(38,35,27,.16); }
:root[data-theme="dark"] { color-scheme: dark; --bg:#191612; --panel:#292419; --panel-2:#110f0a; --screen:#0d0b07; --ink:#f2ecdc; --ink-soft:#d9d1bc; --muted:#aaa089; --line:#4e4732; --line-soft:#393221; --accent:#56d989; --led:#47e381; --led-warn:#e6ac45; --led-err:#ea8058; --led-off:#544c38; --shadow:0 1px 2px rgba(0,0,0,.45),0 12px 28px -12px rgba(0,0,0,.62); }`;

const CHROME = `
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--font-sans); -webkit-font-smoothing:antialiased; }
.top { position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 28px; background:color-mix(in srgb,var(--bg) 88%,transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--line-soft); }
.top h1 { font-size:18px; margin:0; letter-spacing:-.01em; }
.top p { margin:2px 0 0; font-size:12.5px; color:var(--muted); }
.toggle { font-family:var(--font-mono); font-size:11px; letter-spacing:.12em; padding:8px 13px; border:1px solid var(--line); border-radius:7px; background:var(--panel); color:var(--muted); cursor:pointer; }
.toggle:hover { color:var(--ink); border-color:var(--muted); }
main { max-width:1100px; margin:0 auto; padding:26px 28px 80px; }
.group-title { font-family:var(--font-mono); font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin:34px 0 14px; padding-bottom:8px; border-bottom:1px solid var(--line-soft); }
.dev { display:grid; grid-template-columns:220px 1fr; gap:20px; padding:20px 0; border-bottom:1px solid var(--line-soft); }
.dev-meta h3 { margin:0 0 6px; font-size:16px; }
.dev-meta .theme { display:inline-block; font-family:var(--font-mono); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; padding:2px 7px; border-radius:20px; border:1px solid var(--line); color:var(--muted); margin-bottom:8px; }
.dev-meta p { margin:0; font-size:12.5px; line-height:1.55; color:var(--ink-soft); }
.states { display:flex; flex-wrap:wrap; gap:16px; }
.cell { display:flex; flex-direction:column; align-items:center; gap:8px; }
.stage { display:grid; place-items:center; width:190px; height:150px; border:1px solid var(--line-soft); border-radius:12px; background:radial-gradient(120% 120% at 50% 0%, color-mix(in srgb,var(--panel) 60%, var(--bg)) 0%, var(--bg) 80%); box-shadow:var(--shadow); }
.state-name { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.1em; color:var(--muted); }
.state-name b { color:var(--ink); }
@media (max-width:720px){ .dev{ grid-template-columns:1fr; } }`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const THEME_ORDER = ["backend", "tooling", "platform"];
const entries = Object.entries(data);
const byTheme = THEME_ORDER.map((t) => ({ theme: t, items: entries.filter(([, e]) => e.theme === t) }))
  .filter((g) => g.items.length);

const groupsHtml = byTheme
  .map(
    (g) => `
      <h2 class="group-title">${esc(g.theme)}</h2>
      ${g.items
        .map(
          ([type, e]) => `
        <article class="dev">
          <div class="dev-meta">
            <span class="theme">${esc(e.theme)}</span>
            <h3>${esc(e.label)}</h3>
            <p>${esc(e.blurb)}</p>
          </div>
          <div class="states">
            ${e.states
              .map(
                (st, i) => `
              <div class="cell">
                <div class="stage"><div class="act act-${type}" data-state="${st}">${e.inner}</div></div>
                <div class="state-name"><b>${esc(st)}</b> ${i === 0 ? "(healthy)" : "(degraded)"}</div>
              </div>`,
              )
              .join("")}
          </div>
        </article>`,
        )
        .join("")}`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Actuators preview — bysters</title>
<style>
${TOKENS}
${CHROME}
/* ============================ device css (from actuators.css) ============================ */
${actuatorCss}
</style>
</head>
<body>
<div class="top">
  <div>
    <h1>Actuator gallery</h1>
    <p>Every device the bysters operate, in each of its states. Toggle the theme; both must look right.</p>
  </div>
  <button class="toggle" id="tg" type="button">THEME</button>
</div>
<main>
${groupsHtml}
</main>
<script>
  var r = document.documentElement;
  document.getElementById('tg').addEventListener('click', function () {
    r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
  });
</script>
</body>
</html>
`;

writeFileSync(out, html);
console.log("wrote", out.pathname, `(${entries.length} actuators, ${html.length} bytes)`);
