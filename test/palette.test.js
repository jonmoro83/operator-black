// The foundation of the redesign (3.72): seven palettes as token blocks, the picker in
// Setup → Appearance, the new typefaces, and the tab bar moved to the bottom.
const { test } = require("node:test");
const a = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadDom } = require("./dom.js");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public", "app.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const IDS = ["graphite", "phosphor", "olive", "night", "navy", "steel", "blackout"];

test("every palette has its three token blocks: light, dark by preference, dark by choice", () => {
  for (const id of IDS.filter((x) => x !== "graphite")) {
    a.ok(css.includes(`:root[data-palette="${id}"]{`), `${id}: light block`);
    a.ok(css.includes(`:root[data-palette="${id}"]:not([data-theme="light"]){`), `${id}: dark under the system preference, unless light was chosen`);
    a.ok(css.includes(`:root[data-palette="${id}"][data-theme="dark"]{`), `${id}: dark by explicit choice`);
  }
  // Graphite is the default: its tokens sit on :root, so an unknown or missing palette falls back to it.
  a.match(css, /^:root\{[\s\S]*?--bg:#e7e9ec;[\s\S]*?\}/m, "graphite light on :root");
  a.ok(!css.includes('data-palette="graphite"'), "and it needs no block of its own");
  // The new tokens the redesign's components will read exist in the base set.
  for (const t of ["--line-2", "--inv", "--inv-ink", "--accent-ink"]) a.ok(new RegExp(`^:root\\{[\\s\\S]*?${t}:`, "m").test(css), `${t} is defined on :root`);
  // The tints derive from the palette rather than being seven more hand-picked colors.
  a.match(css, /--green-bg:color-mix\(in srgb, var\(--green\)/);
});

test("the typefaces are the instrument panel's: B612 for text and readouts, a condensed face for numerals", () => {
  a.match(html, /fonts\.googleapis\.com\/css2\?family=B612:[^"]*B612\+Mono[^"]*Barlow\+Condensed/, "the page asks Google Fonts for all three");
  a.match(css, /--f-body:"B612"/);
  a.match(css, /--f-mono:"B612 Mono"/);
  a.match(css, /--f-display:"Barlow Condensed"/);
  a.doesNotMatch(css, /Archivo|IBM Plex/, "nothing of the old faces remains");
});

test("the picker in Setup lists all seven, and choosing one sets the root attribute, the store and the status bar color", () => {
  const x = loadDom({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.onboarded = true; x.bump();
  const rootEl = x.document.documentElement;
  a.equal(rootEl.getAttribute("data-palette"), "graphite", "graphite until told otherwise");

  x.view = "setup"; x.render();
  const swatches = x.$$('#main [data-act="palette"]');
  a.deepEqual(swatches.map((b) => b.dataset.v), IDS.slice().sort((p, q) => x.PALETTES.findIndex((e) => e.id === p) - x.PALETTES.findIndex((e) => e.id === q)), "one swatch per palette, in the table's order");
  a.equal(swatches.length, 7);
  a.equal(swatches.find((b) => b.dataset.v === "graphite").getAttribute("aria-pressed"), "true");
  for (const b of swatches) a.match(b.querySelector("i").getAttribute("style"), /linear-gradient\(135deg,#[0-9a-f]{6} 55%,#[0-9a-f]{6} 55%\)/, `${b.dataset.v} shows its ground and live color`);

  x.fire(swatches.find((b) => b.dataset.v === "olive"), "click");
  a.equal(rootEl.getAttribute("data-palette"), "olive", "the root carries the choice");
  a.equal(JSON.parse(x.store["ob.palette"]), "olive", "and it is remembered on this device");
  a.equal(x.$('#main [data-act="palette"][data-v="olive"]').getAttribute("aria-pressed"), "true");
  a.equal(x.$('#main [data-act="palette"][data-v="graphite"]').getAttribute("aria-pressed"), "false");
  // The harness's matchMedia says light, so the status bar takes olive's light ground.
  a.equal(x.$('meta[name="theme-color"]').getAttribute("content") || x.$('meta[name="theme-color"]').content, "#e3e2d4");

  // A value that is not a palette falls back to graphite rather than leaving the root unstyled.
  x.store["ob.palette"] = JSON.stringify("tartan"); x.applyTheme();
  a.equal(rootEl.getAttribute("data-palette"), "graphite");
});

test("the tab bar sits at the bottom of the page, out of the header, with an icon on every tab", () => {
  const x = loadDom();
  a.equal(x.$("header #nav"), null, "not in the header any more");
  const nav = x.$("#nav");
  a.ok(nav && nav.parentElement === x.document.body, "a direct child of the body, fixed by CSS");
  a.match(css, /#nav\{position:fixed;left:0;right:0;bottom:0;/, "fixed to the bottom");
  const tabs = x.$$("#nav button");
  a.deepEqual(tabs.map((b) => b.dataset.view), ["today", "status", "plan", "history", "setup", "guide", "admin"]);
  for (const b of tabs) a.ok(b.querySelector("svg"), `${b.dataset.view} has an icon`);
  a.equal(tabs.filter((b) => !b.hidden).length, 6);
  // Things that used to sit on the bottom edge now sit above the bar.
  a.match(css, /#bars\{position:fixed;left:0;right:0;bottom:calc\(58px \+ env\(safe-area-inset-bottom,0px\)\)/, "the rest and timer bars");
  a.match(css, /\.wrap\{[^}]*padding-block:0 calc\(84px \+ env\(safe-area-inset-bottom,0px\)\)/, "the page leaves room for it");
  a.ok(html.includes('<button id="tmr-b"') && html.indexOf('<button id="tmr-b"') < html.indexOf('<button id="acct"'), "the timer button moved up beside the initials");
});
