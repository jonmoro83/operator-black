#!/usr/bin/env node
// Renders every brand asset from one definition of the mark, so changing the logo is a
// single edit here: favicon, manifest icons, the Apple touch icon inlined into
// index.html, the Access login logo, and the ten iPhone launch screens.
//
//   node tools/brand.js
//
// Needs Google Chrome (the mark is set in Archivo, pulled from Google Fonts) and a
// network connection. Nothing else in the build depends on it.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = path.join(__dirname, "..");
const INK = "#131916", CHALK = "#e5ebe7", BLUE = "#7d9cff", BLUE_DK = "#1b45c2";

/** The mark, on a 64x64 grid: OB over a loaded bar. */
const mark = (fg, accent) => `
  <text x="32" y="30" text-anchor="middle" font-family="Archivo" font-size="26"
        font-weight="900" font-stretch="112%" fill="${fg}" dominant-baseline="middle"
        letter-spacing="-.5">OB</text>
  <rect x="10" y="42" width="44" height="6.5" rx="3.2" fill="${accent}"/>
  <rect x="5" y="38" width="5.5" height="14.5" rx="2" fill="${fg}"/>
  <rect x="53.5" y="38" width="5.5" height="14.5" rx="2" fill="${fg}"/>`;

const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap">';

function shoot(html, w, h, out, dpr = 1) {
  const tmp = path.join(os.tmpdir(), `ob-brand-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // the mark is set in a webfont: give Chrome time to fetch it before the shot, or it
  // silently falls back to a serif
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--virtual-time-budget=5000",
    `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`,
    `--screenshot=${out}`, "file://" + tmp], { stdio: "ignore" });
  fs.unlinkSync(tmp);
  return fs.statSync(out).size;
}

/**
 * A square icon, full bleed: the launcher applies its own mask, so leave a safe margin.
 * Always rendered at 1024 and scaled down — headless Chrome has a minimum window size,
 * and asking it for a 192px window silently crops instead of scaling.
 */
const MASTER = 1024;
function icon(px, out) {
  const html = `<!doctype html><meta charset=utf8>${FONT}<style>
    html,body{margin:0;height:100%;background:${INK}}svg{display:block;width:100%;height:100%}</style>
    <svg viewBox="0 0 64 64"><g transform="translate(32,32) scale(.8) translate(-32,-32)">${mark(CHALK, BLUE)}</g></svg>`;
  shoot(html, MASTER, MASTER, out);
  if (px !== MASTER) execFileSync("sips", ["-z", String(px), String(px), out, "--out", out], { stdio: "ignore" });
  return fs.statSync(out).size;
}

/** iPhone launch screen: the mark plus the wordmark, centred on ink. */
function splash(w, h, dpr, out) {
  const icon = Math.round(w * 0.34), fs_ = Math.max(11, Math.round(w * 0.042)), gap = Math.round(w * 0.05);
  const html = `<!doctype html><meta charset=utf8>${FONT}<style>
    html,body{margin:0;height:100%;background:${INK}}
    .w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${gap}px;
       font-family:Archivo,system-ui,sans-serif}
    svg{width:${icon}px;height:${icon}px}
    .t{color:${CHALK};font-size:${fs_}px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    .t b{color:${BLUE}}</style>
    <div class="w"><svg viewBox="0 0 64 64">${mark(CHALK, BLUE)}</svg>
    <div class="t">Operator <b>+</b> Black</div></div>`;
  return shoot(html, w, h, out, dpr);
}

const SPLASHES = [[440,956,3],[430,932,3],[402,874,3],[393,852,3],[390,844,3],
                  [375,812,3],[414,896,3],[414,896,2],[375,667,2],[414,736,3]];

console.log("icons");
for (const [px, out] of [[32,"public/icon-32.png"],[180,"public/icon-180.png"],
                         [192,"public/icon-192.png"],[512,"public/icon-512.png"]]) {
  console.log(`  ${out} — ${(icon(px, path.join(root, out)) / 1024).toFixed(0)} KB`);
}
// the login page needs the mark on ink with a little breathing room
console.log("  public/brand/logo.png");
icon(256, path.join(root, "public/brand/logo.png"));

console.log("launch screens");
for (const [w, h, dpr] of SPLASHES) {
  const out = `public/brand/splash/${w}x${h}-${dpr}x.png`;
  console.log(`  ${out} — ${(splash(w, h, dpr, path.join(root, out)) / 1024).toFixed(0)} KB`);
}

// iOS reads the touch icon before there is an Access session, so it is inlined
const b64 = fs.readFileSync(path.join(root, "public/icon-180.png")).toString("base64");
const indexPath = path.join(root, "public/index.html");
let html = fs.readFileSync(indexPath, "utf8");
const re = /<link rel="apple-touch-icon" href="data:image\/png;base64,[^"]*">/;
if (!re.test(html)) throw new Error("no apple-touch-icon link in index.html to update");
const next = html.replace(re, `<link rel="apple-touch-icon" href="data:image/png;base64,${b64}">`);
if (next !== html) fs.writeFileSync(indexPath, next);
console.log(next === html ? "Apple touch icon already current" : "inlined the Apple touch icon into index.html");
