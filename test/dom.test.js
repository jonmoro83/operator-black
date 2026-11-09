// Flows through the real DOM: the boot, a tap on the nav, an input that changes the
// plan, a tick that logs a set, and morph() keeping the nodes it should. The stub-DOM
// suite cannot see any of this; it tests what a view renders, not what a tap does.
const { test } = require("node:test");
const a = require("node:assert");
const { loadDom } = require("./dom.js");

function ready(opts) {
  const x = loadDom(opts);
  // A plan past its bridge, so Monday 2026-10-19 is an ordinary lifting day.
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.onboarded = true; x.bump();
  x.render();
  return x;
}

test("the app boots into a real DOM and draws Today", () => {
  const x = ready();
  a.equal(x.view, "today");
  const main = x.$("#main");
  a.ok(main.children.length > 0, "something was drawn");
  a.ok(main.innerHTML.length > 500, `Today is a real screen, not a stub: ${main.innerHTML.length} chars`);
  a.equal(x.$('#nav button[data-view="today"]').getAttribute("aria-current"), "page");
  a.equal(x.$('#nav button[data-view="setup"]').getAttribute("aria-current"), "false");
  a.ok(x.$('#nav button[data-view="admin"]').hidden, "the Admin tab is hidden until the server says otherwise");
});

test("six tabs show on the bar; Coach is in the account menu, and Guide is in both", () => {
  const x = ready();
  const shown = x.$$("#nav button").filter((b) => !b.hidden).map((b) => b.dataset.view);
  a.deepEqual(shown, ["today", "status", "plan", "history", "setup", "guide"]);
  const menu = x.$$('#acct-m [role="menuitem"]').map((b) => b.dataset.view || b.id);
  a.deepEqual(menu, ["setup", "coach", "guide", "releases", "acct-out"]);
});

test("a tap on a nav button changes the view, and the view's content follows", () => {
  const x = ready();
  x.fire(x.$('#nav button[data-view="setup"]'), "click");
  a.equal(x.view, "setup");
  a.equal(x.$('#nav button[data-view="setup"]').getAttribute("aria-current"), "page");
  a.match(x.$("#main").textContent, /About this app/, "Setup is on screen");
  a.equal(x.store["ob.view"], "setup", "and remembered for the next open");

  x.fire(x.$('#acct-m [data-view="coach"]'), "click");
  a.equal(x.view, "coach", "a menu item routes the same way");
  a.ok(x.$("#acct-m").hidden, "and the menu closes");
});

test("typing in a bound field changes the plan through the delegated input handler", () => {
  const x = ready();
  x.view = "setup"; x.render();
  const bw = x.$("#p-bodyweight");
  a.ok(bw, "the bodyweight field is in Setup");
  bw.value = "187.5";
  x.fire(bw, "input");
  a.equal(x.plan.bodyweight, 187.5, "the number landed in the plan");
});

test("ticking a box in Today writes that path into the day's log", () => {
  const x = ready();
  const box = x.$('#main input[type="checkbox"][data-bind]');
  a.ok(box, "Today has something to tick");
  a.equal(x.logs["2026-10-19"], undefined, "nothing logged yet");
  box.checked = true;
  x.fire(box, "input");
  const L = x.logs["2026-10-19"];
  a.ok(L, "the tick created the day's log");
  const at = box.dataset.bind.split(".").reduce((o, k) => (o == null ? o : o[k]), L);
  a.equal(at, true, `${box.dataset.bind} is ticked in the log`);
  // And the screen agrees with the log on the next draw.
  x.render();
  a.equal(x.$(`#main input[data-bind="${box.dataset.bind}"]`).checked, true);
});

test("tapping a set button logs that set, and the button shows it pressed on the next draw", () => {
  const x = ready();
  const btn = x.$('#main button[data-act="set"]');
  a.ok(btn, "a lifting day has set buttons");
  const k = btn.dataset.lift, i = +btn.dataset.i;
  a.equal(btn.getAttribute("aria-pressed"), "false");
  x.fire(btn, "click");
  const L = x.logs["2026-10-19"];
  a.ok(L && L.lifts && L.lifts[k], `the tap created the day's log for ${k}`);
  a.equal(L.lifts[k].sets[i], true, `set ${i + 1} is done`);
  a.equal(x.$(`#main button[data-act="set"][data-lift="${k}"][data-i="${i}"]`).getAttribute("aria-pressed"), "true", "the render after the tap shows it");
  x.fire(x.$(`#main button[data-act="set"][data-lift="${k}"][data-i="${i}"]`), "click");
  a.ok(!x.logs["2026-10-19"].lifts[k].sets[i], "a second tap undoes it");
});

test("morph keeps the nodes that did not change, instead of rebuilding the screen", () => {
  const x = ready();
  x.view = "setup"; x.render();
  const bw = x.$("#p-bodyweight");
  bw.__kept = true;
  const cardCount = x.$$("#main .card").length;
  x.plan.sleepTarget = 7.5; x.bump();   // a change elsewhere in Setup
  x.render();
  a.equal(x.$("#p-bodyweight").__kept, true, "the same input element is still on the page");
  a.ok(x.$$("#main .card").length >= cardCount, "and the screen is intact");

  // A value changed in state is written to the field when nobody is typing in it.
  x.plan.bodyweight = 190; x.bump(); x.render();
  a.equal(x.$("#p-bodyweight").value, "190");
});

test("a thrown error while drawing leaves a banner, not a blank screen", () => {
  const x = ready();
  // A view that throws: the crash path is what the gym gets instead of nothing.
  x.view = "setup"; x.render();
  const was = x.$("#main").innerHTML;
  // Setup reads the bar weight for the plate math; make that read throw. The crash
  // handler also reports to the console, which is noise here.
  const plan = x.plan; x.plan = new Proxy(plan, { get: (t, k) => { if (k === "bar") throw new Error("boom in a getter"); return t[k] } });
  const err = console.error; console.error = () => {};
  try { x.render() } finally { console.error = err }
  a.match(x.$("#main").textContent, /Something went wrong drawing this screen/);
  a.notEqual(x.$("#main").innerHTML, was);
  x.plan = plan; x.render();
  a.doesNotMatch(x.$("#main").textContent, /Something went wrong/, "and it recovers on the next render");
});
