// The app in a real DOM. harness.js stubs the document, which is enough for the
// calculations and the strings a view renders, and nothing else: morph() falls back to
// innerHTML there, no event ever bubbles, no tap reaches a delegated handler. This loads
// public/index.html into linkedom, lets the app boot against it the way a browser would
// (minus the service worker and the update check), and exposes the same __app surface.
// Nothing here is shipped.
const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");
const { exposeTail } = require("./harness.js");

const root = path.join(__dirname, "..");

function loadDom({ now = "2026-10-19" } = {}) {
  // The page without its <script> tags: the app is evaluated by hand below.
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8").replace(/<script[^>]*><\/script>\s*/g, "");
  const { window, document } = parseHTML(html);

  global.window = window;
  global.document = document;
  for (const k of ["Event", "CustomEvent", "HTMLElement", "Element", "Node", "HTMLInputElement", "KeyboardEvent", "MouseEvent"]) {
    if (window[k]) global[k] = window[k];
  }
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] } };
  global.localStorage = window.localStorage = localStorage;
  const matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  global.matchMedia = window.matchMedia = matchMedia;
  global.scrollTo = window.scrollTo = () => {};
  // Audio and speech exist but do nothing: the sounds have their own tests in harness.js.
  class AudioContext {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {} }
    resume() { this.state = "running"; return Promise.resolve() }
    close() { this.state = "closed"; return Promise.resolve() }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
    createOscillator() { return { frequency: { value: 0 }, connect() {}, start() {}, stop() {}, setPeriodicWave() {} } }
    createPeriodicWave() { return {} }
    createBuffer() { return {} }
    createBufferSource() { return { connect() {}, start() {} } }
  }
  global.AudioContext = window.AudioContext = AudioContext;
  const speech = { speaking: false, speak() {}, cancel() {} };
  global.speechSynthesis = window.speechSynthesis = speech;
  global.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } };
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "node", serviceWorker: undefined, audioSession: { type: "auto" }, vibrate: () => true },
    configurable: true, writable: true,
  });
  global.location = { reload() {}, replace() {}, href: "https://operatorblack.com/" };
  global.fetch = () => new Promise(() => {});   // no network: the page runs off its local copy
  global.setInterval = () => 0;
  global.clearInterval = () => {};

  (0, eval)(fs.readFileSync(path.join(root, "public", "releases.js"), "utf8") + ";globalThis.RELEASES=RELEASES;");

  let src = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const m = src.match(/applyTheme\(\);\r?\nloadLocal\(\);([\s\S]*?)\}\)\(\);\s*$/);
  if (!m) throw new Error("could not find the boot block at the end of public/app.js");
  // The real boot, minus the two lines that reach outside the page.
  const boot = ("applyTheme();\nloadLocal();" + m[1]).split("\n")
    .filter((l) => !/serviceWorker|checkUpdate/.test(l)).join("\n");
  src = src.slice(0, m.index) + boot + "\n" + exposeTail(src) + "})();";
  (0, eval)(src);

  const app = globalThis.__app;
  app.setToday(now);
  app.loaded = true;
  app.window = window;
  app.document = document;
  app.store = store;
  /** Dispatch a bubbling event of `type` on `el`, as a tap or a keystroke would. */
  app.fire = (el, type, init) => el.dispatchEvent(new window.Event(type, Object.assign({ bubbles: true, cancelable: true }, init)));
  app.$ = (sel) => document.querySelector(sel);
  app.$$ = (sel) => [...document.querySelectorAll(sel)];
  return app;
}

module.exports = { loadDom };
