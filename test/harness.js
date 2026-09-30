// Loads the app's script out of public/index.html into Node with a stub DOM, and
// exposes every top-level function plus the mutable state, so the calculations can be
// tested without a browser. Nothing here is shipped.
const fs = require("node:fs");
const path = require("node:path");

const CONSTS = ["APP_VERSION", "RELEASES", "PLYO_UPPER", "PLIB", "WARMUP", "MOB", "PLYO", "HIC", "MOD", "IV", "DELOAD_OPTS", "L3K", "LK"];
const STATE = ["plan", "logs", "programs", "sel", "planV", "viewing", "stash", "guide", "rest", "iv", "ls", "loaded", "me", "calMove", "calRe", "planMode", "calMonth", "newProg", "wz", "moveOpen", "popKey"];

function stubDom() {
  const made = {};
  const el = (id) => ({
    id, textContent: "", className: "", innerHTML: "", hidden: true, value: "", style: {},
    dataset: {}, files: null,
    addEventListener() {}, removeEventListener() {}, remove() {}, appendChild() {}, focus() {},
    scrollTo() {}, setAttribute() {}, removeAttribute() {}, getAttribute() { return null },
    click() {}, querySelector() { return null }, querySelectorAll() { return [] },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
  });
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  };
  global.window = {
    addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    AudioContext: undefined, Notification: undefined,
  };
  global.matchMedia = window.matchMedia;
  global.navigator = { onLine: true, userAgent: "node", serviceWorker: undefined };
  global.document = {
    getElementById: (id) => made[id] || (made[id] = el(id)),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el("new"), addEventListener() {},
    head: { appendChild() {} }, documentElement: el("html"),
    body: { classList: { add() {}, remove() {}, toggle() {} }, style: {}, appendChild() {} },
    activeElement: null,
  };
  global.fetch = () => new Promise(() => {});          // never resolves: no network in tests
  global.setInterval = () => 0;
  global.clearInterval = () => {};
  return { store, made };
}

/** Load the app. `now` fixes "today" (YYYY-MM-DD). Returns every function plus live state. */
function loadApp({ now = "2026-10-19" } = {}) {
  const dom = stubDom();
  // public/app.js is built from src/app/*.js by build.js; npm test builds first.
  const bundlePath = path.join(__dirname, "..", "public", "app.js");
  if (!fs.existsSync(bundlePath)) throw new Error("public/app.js is missing — run `node build.js`");
  let src = fs.readFileSync(bundlePath, "utf8");

  // releases.js is a separate script the page loads first; evaluate it into the same
  // realm so RELEASES is in scope for the app.
  // a top-level const in an eval does not persist the way a <script> one does, so pin it
  (0, eval)(fs.readFileSync(path.join(__dirname, "..", "public", "releases.js"), "utf8") +
    ";globalThis.RELEASES=RELEASES;");

  const fns = [...src.matchAll(/^function\s+\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);
  const accessors = STATE.map((v) => `get ${v}(){return ${v}},set ${v}(x){${v}=x}`).join(",")
    + "," + CONSTS.map((c) => `get ${c}(){return ${c}}`).join(",");
  const tail = `globalThis.__app={${fns.join(",")},${accessors},
    bump(){planV++},
    setToday(d){realToday=()=>d;sel=d},
    seed(o){for(const [k,v] of Object.entries(o||{})) logs[k]=v; planV++},
  };})();`;
  // replace the boot sequence at the end of the IIFE
  src = src.replace(/applyTheme\(\);\r?\nloadLocal\(\);[\s\S]*$/, tail);
  if (!src.includes("globalThis.__app")) throw new Error("could not replace the boot block");

  (0, eval)(src);
  const app = globalThis.__app;
  app.setToday(now);
  app.loaded = true;
  app.dom = dom;
  return app;
}

module.exports = { loadApp };
