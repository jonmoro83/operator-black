// Loads the app's script out of public/index.html into Node with a stub DOM, and
// exposes every top-level function plus the mutable state, so the calculations can be
// tested without a browser. Nothing here is shipped.
const fs = require("node:fs");
const path = require("node:path");

const CONSTS = ["coach", "MACRO", "KCAL_G", "MACRO_STEP", "ADJACENT_BAN", "ADJACENT_SOFT", "APP_VERSION", "RELEASES", "PLYO_UPPER", "EFFORT", "SUPP", "SUPP_LVL", "SFX", "PLIB", "VARS", "VAR_OF", "openPx", "MLIB", "ASLOT", "ALIB", "ACC_DAYS", "ACC_DEF", "PULLUP", "WARMUP", "MOB", "PLYO", "HIC", "MOD", "FOBBIT", "FOB_SRC", "IV", "DELOAD_OPTS", "AIMS_LIFT", "AIMS_COND", "AIM_MAX", "SCHEMA", "MIGRATIONS", "CRASH_KEEP", "CONFLICT_KEEP", "TLOG_MAX", "WARM_RESTS", "WARM_CORE", "AGILE8", "WARM_ROUTINES", "BB_MASS", "BB_LEN", "OW_BLOCKS", "BB_TOP", "SE_CLUSTERS", "BAND_PRESETS", "WZ_STEPS", "STEMPL", "CPROTO", "LIFTSET", "GT_PRESETS", "L3K", "LK"];
const STATE = ["view", "plan", "logs", "programs", "sel", "planV", "viewing", "stash", "guide", "rest", "iv", "ls", "loaded", "me", "calMove", "undoItem", "gt", "HIC", "DEF", "D", "planMode", "calMonth", "newProg", "wz", "moveOpen", "popKey", "schemaAhead", "sfxUntil", "wakeState", "outbox", "calFeed", "amAdmin", "admin", "catalog", "beepSeen", "pushLast", "pushStat", "copyFallback"];

function stubDom() {
  const made = {};
  const el = (id) => ({
    id, textContent: "", className: "", innerHTML: "", hidden: true, value: "", style: {},
    dataset: {}, files: null,
    addEventListener() {}, removeEventListener() {}, remove() {}, appendChild() {}, focus() {},
    scrollTo() {}, setAttribute() {}, removeAttribute() {}, getAttribute() { return null },
    click() {}, querySelector() { return null }, querySelectorAll() { return [] },
    // An <audio> element: the beep's second route out, which iOS does not silence.
    play() { audio.plays.push(this.src ? this.src.slice(0, 22) : ""); return Promise.resolve() },
    pause() {}, load() {}, currentTime: 0, src: "", preload: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
  });
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  };
  // A recording AudioContext. Without one, `audioCtx` stayed undefined and every beep
  // was a no-op, so nothing about the alert sounds was testable — which is how the rest
  // beep got "fixed" twice without anybody being able to check it.
  // `refuse` makes resume() reject, which is what iOS does to a resume it will not honour
  // outside a tap. `interrupt()` is what speech, a call or another app does to a running
  // context on iOS: it parks it at WebKit's non-standard 'interrupted' and fires
  // statechange. Both exist because those are the two ways the beep went missing.
  const audio = { tones: [], plays: [], ctxs: 0, resumes: 0, ctx: null, refuse: false, stuck: false, waves: 0,
    interrupt() { const c = audio.ctx; if (!c) return; c.state = "interrupted"; if (c.onstatechange) c.onstatechange() } };
  class StubAudioContext {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = { kind: "out" }; this.onstatechange = null; audio.ctxs++; audio.ctx = this }
    // A suspended context's clock is frozen, and resume() is async. Jumping the clock on
    // resume is what makes "scheduled before the resume settled" visible to a test.
    resume() {
      audio.resumes++;
      if (audio.refuse) return Promise.reject(Object.assign(new Error("not allowed"), { name: "NotAllowedError" }));
      // The case the research describes: resume() resolves, and the context is still parked.
      if (audio.stuck) return Promise.resolve();
      return Promise.resolve().then(() => {
        const was = this.state; this.state = "running"; this.currentTime += 5;
        if (was !== "running" && this.onstatechange) this.onstatechange();
      });
    }
    createBuffer() { return { kind: "buffer" } }
    createBufferSource() { return { buffer: null, connect() {}, start() {} } }
    createPeriodicWave(real, imag) { audio.waves++; return { kind: "wave", real: Array.from(real), imag: Array.from(imag) } }
    // The gain records its envelope, so a test can read how loud and how long a note is
    // rather than only that one was started.
    createGain() {
      const pts = [];
      const g = { pts, gain: {
        setValueAtTime(v, t) { pts.push({ v, t, k: "set" }) },
        linearRampToValueAtTime(v, t) { pts.push({ v, t, k: "lin" }) },
        exponentialRampToValueAtTime(v, t) { pts.push({ v, t, k: "exp" }) } }, connect() {} };
      return g;
    }
    createOscillator() {
      const o = { type: "sine", wave: null, frequency: { value: 0 }, gainNode: null, stop() {},
        setPeriodicWave(w) { o.wave = w; o.type = "custom" },
        connect(n) { if (n && n.pts) o.gainNode = n },
        start: (t) => audio.tones.push({ hz: o.frequency.value, at: t, type: o.type, wave: o.wave,
          env: o.gainNode ? o.gainNode.pts : [] }) };
      return o;
    }
  }
  // Speech, recorded. Present so a test can see what was said and when relative to the
  // tones -- the order matters on iOS, where speech can interrupt Web Audio.
  audio.said = [];
  class StubUtterance { constructor(t) { this.text = t; this.volume = 1 } }
  const speech = { speaking: false, speak(u) { audio.said.push({ text: u.text, at: Date.now(), volume: u.volume }) }, cancel() {} };
  global.window = {
    addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    AudioContext: StubAudioContext, Notification: undefined,
    speechSynthesis: speech, SpeechSynthesisUtterance: StubUtterance,
  };
  global.speechSynthesis = speech; global.SpeechSynthesisUtterance = StubUtterance;
  global.AudioContext = StubAudioContext;
  global.matchMedia = window.matchMedia;
  // Node defines `navigator` as a read-only getter, so `global.navigator = {...}` was
  // silently doing nothing and every test has been reading Node's own navigator. The
  // descriptor is configurable, so define over it instead. Without this, nothing that
  // the app reads off navigator can be stubbed at all.
  const buzzes = [];
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "node", serviceWorker: undefined,
      audioSession: { type: "auto" },
      vibrate: (p) => (buzzes.push(p), true), __buzzes: buzzes },
    configurable: true, writable: true,
  });
  const docListeners = {};
  audio.fire = (ev) => (docListeners[ev] || []).forEach((f) => f({ type: ev, target: {} }));
  global.document = {
    getElementById: (id) => made[id] || (made[id] = el(id)),
    // Enough of a selector engine for the few places the app reaches into the header.
    // Without this, code that shows or hides a nav tab is unreachable from a test.
    querySelector: (sel) => (/data-view="admin"/.test(sel) ? (made["nav-admin"] || (made["nav-admin"] = el("nav-admin"))) : null),
    querySelectorAll: () => [],
    createElement: () => el("new"),
    // Listeners are kept so a test can fire a tap. The gesture that wakes the audio is
    // a document listener, and it is untestable if registering one does nothing.
    addEventListener(ev, fn) { (docListeners[ev] || (docListeners[ev] = [])).push(fn) },
    visibilityState: "visible",
    head: { appendChild() {} }, documentElement: el("html"),
    body: { classList: { add() {}, remove() {}, toggle() {} }, style: {}, appendChild() {} },
    activeElement: null,
  };
  global.fetch = () => new Promise(() => {});          // never resolves: no network in tests
  global.setInterval = () => 0;
  global.clearInterval = () => {};
  return { store, made, audio };
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

  // `async function` was not matched, so every async top-level function in the app --
  // enableAlerts, healAlerts, testAlert, holdScreen and the rest -- was invisible to
  // every test. That is most of the alert path, which is the part that broke.
  const fns = [...new Set([...src.matchAll(/^(?:async\s+)?function\s+\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]))];
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
  app.audio = dom.audio;
  app.buzzes = navigator.__buzzes;
  return app;
}

module.exports = { loadApp };
