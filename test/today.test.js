// Today as the session first (3.73): the brief, the lift switcher and the single pane,
// through the real DOM. The lift card's own behavior has its tests in app.test.js; this
// file is about the shape around it.
const { test } = require("node:test");
const a = require("node:assert");
const { loadDom } = require("./dom.js");

function ready(now = "2026-10-19") {
  const x = loadDom({ now });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.onboarded = true;
  Object.assign(x.plan.maxes, { squat: 300, bench: 200, pull: 180, ohp: 135, dead: 400 });
  x.bump(); x.render();
  return x;
}
const visiblePanes = (x) => x.$$("#main .lift-pane").filter((p) => !p.hidden);

test("a lifting day opens on the session brief: one row per lift with its prescription, weight and lamps, then conditioning", () => {
  const x = ready();
  const brief = x.$("#main .brief");
  a.ok(brief, "the brief is drawn");
  const main = x.$("#main");
  a.ok(main.innerHTML.indexOf('class="brief"') < main.innerHTML.indexOf('class="lift-pane"'), "before the lifts");
  const rows = [...brief.querySelectorAll("tr")];
  const lifts = x.dayPlan(x.sel).lifts;
  a.equal(rows.length, lifts.length + 1, "a row per lift and one for conditioning");
  const first = rows[0];
  a.match(first.querySelector(".l").textContent, /Squat/);
  a.match(first.querySelector(".rx").textContent, /^3 × 5 @ 70%$/, "the prescription as the wave gives it");
  a.match(first.querySelector(".w").textContent, /^\d+LB$/i, "the working weight with its unit");
  a.equal(first.querySelectorAll(".lamp").length, 3, "one lamp per prescribed set");
  a.equal(first.querySelectorAll(".lamp.ok").length, 0, "none lit yet");
  a.match(rows[rows.length - 1].textContent, /Conditioning/);
  a.match(brief.querySelector(".ft").textContent, /Warm-up\s*00 \/ \d+/, "the warm-up count");
  a.match(brief.querySelector(".ft").textContent, /Estimate\s*\d+ MIN/, "and a length");
  a.equal(brief.querySelectorAll(".segbar i").length, 9, "nine segments for nine prescribed sets");
  a.ok(brief.querySelector('[data-act="lsstart"]'), "Start session lives on the brief");
  a.equal(x.$("#main .wkline [data-act='lsstart']"), null, "and no longer on the week line");
});

test("one lift pane shows at a time, the first with sets still to do; the others are in the page but hidden", () => {
  const x = ready();
  const lifts = x.dayPlan(x.sel).lifts;
  a.equal(x.$$("#main .lift-pane").length, lifts.length, "every lift's card is rendered");
  a.equal(visiblePanes(x).length, 1, "one is shown");
  a.equal(x.$("#main .sw.on").dataset.lift, lifts[0], "the first lift is in focus");
  a.match(visiblePanes(x)[0].textContent, new RegExp(x.liftName(lifts[0])));
  a.equal(x.$$("#main .sw").length, lifts.length, "a switcher tab per lift");
  for (const b of x.$$("#main .sw")) a.equal(b.querySelectorAll(".lamp").length, 3);
});

test("the switcher changes the pane, and the choice is kept for the day", () => {
  const x = ready();
  const lifts = x.dayPlan(x.sel).lifts;
  x.fire(x.$(`#main .sw[data-lift="${lifts[1]}"]`), "click");
  a.equal(x.liftSel.k, lifts[1]);
  a.equal(visiblePanes(x).length, 1);
  a.match(visiblePanes(x)[0].textContent, new RegExp(x.liftName(lifts[1])));
  a.equal(x.$("#main .sw.on").dataset.lift, lifts[1]);
  a.equal(x.$(`#main .sw[data-lift="${lifts[1]}"]`).getAttribute("aria-selected"), "true");
  x.render();
  a.equal(x.$("#main .sw.on").dataset.lift, lifts[1], "a re-render keeps it");
  // Another day starts from the default again.
  x.sel = x.addDays(x.sel, 2); x.render();
  a.equal(x.$("#main .sw.on").dataset.lift, x.dayPlan(x.sel).lifts[0]);
});

test("ticking a set in the pane lights the lamp on the brief and on the switcher", () => {
  const x = ready();
  const k = x.dayPlan(x.sel).lifts[0];
  const btn = x.$(`#main .lift-pane:not([hidden]) button[data-act="set"][data-lift="${k}"][data-i="0"]`);
  a.ok(btn, "the focused pane has the set buttons");
  x.fire(btn, "click");
  a.equal(x.$("#main .brief tr:first-child .lamp.ok") && 1, 1, "the brief's first lamp lit");
  a.equal(x.$("#main .brief tr:first-child").querySelectorAll(".lamp.ok").length, 1);
  a.equal(x.$(`#main .sw[data-lift="${k}"] .lamp.ok`) && 1, 1, "and the switcher's");
  a.equal(x.$$("#main .brief .segbar i.on").length, 1, "one segment of nine");
  a.equal(x.$("#main .sw.on").dataset.lift, k, "focus stays on the lift being worked");
});

test("when every prescribed set of the first lift is done, the next lift is the default focus", () => {
  const x = ready();
  const lifts = x.dayPlan(x.sel).lifts;
  x.setLog(x.sel, "lifts." + lifts[0] + ".sets", [true, true, true]); x.render();
  a.equal(x.$("#main .sw.on").dataset.lift, lifts[1], "the first is finished, so the second is up");
  a.equal(x.$(`#main .sw[data-lift="${lifts[0]}"]`).querySelectorAll(".lamp.ok").length, 3);
  a.equal(x.$$("#main .brief .segbar i.on").length, 3);
});

test("the brief's estimate adds the warm-up, the ramps and the working sets at their rest", () => {
  const x = ready();
  const wk = x.weekOf(x.sel), dp = x.dayPlan(x.sel);
  const est = x.sessionEstimate(wk, dp);
  a.ok(est >= 35 && est <= 80, `a plausible length for three lifts of three sets: ${est}`);
  a.equal(est % 5, 0, "rounded to five minutes");
  x.setLog(x.sel, "lifts.squat.rest", 5);
  a.ok(x.sessionEstimate(wk, dp) >= est, "longer rests make it longer, never shorter");
});

test("a rest day has no brief, no switcher and no pane", () => {
  const x = ready("2026-10-25");   // Sunday
  a.equal(x.$("#main .brief"), null);
  a.equal(x.$("#main .switch"), null);
  a.equal(x.$$("#main .lift-pane").length, 0);
});

test("on a day that is not today the brief says so instead of offering to start", () => {
  const x = ready("2026-10-19");
  x.sel = "2026-10-21"; x.render();   // Wednesday, looked at from Monday
  const brief = x.$("#main .brief");
  a.ok(brief);
  a.equal(brief.querySelector('[data-act="lsstart"]'), null);
  a.match(brief.querySelector(".cta").textContent, /Not today/);
  x.sel = "2026-10-16"; x.render();   // last Friday
  a.match(x.$("#main .brief .cta").textContent, /A logged day/);
});
