const { test } = require("node:test");
const a = require("node:assert");
const { loadApp } = require("./harness.js");

const maxes = { squat: 300, bench: 200, pull: 180, ohp: 135, dead: 400 };
function app(o) { const x = loadApp(o); Object.assign(x.plan.maxes, maxes); x.bump(); return x }
const monOf = { 1: "2026-10-05", 2: "2026-10-12", 3: "2026-10-19", 4: "2026-10-26", 5: "2026-11-02", 6: "2026-11-09" };

test("working weights follow the wave and round to the lift's increment", () => {
  const x = app();
  const got = [1, 2, 3, 4, 5, 6].map((w) => x.rx(x.weekOf(monOf[w]), "squat").w);
  a.deepEqual(got, [210, 240, 270, 225, 255, 285]);          // 300 × 70/80/90/75/85/95
  a.equal(x.rx(x.weekOf(monOf[1]), "bench").w, 140);
  a.equal(x.rx(x.weekOf(monOf[3]), "dead").w, 360);
});

test("rounding increment is respected per lift", () => {
  const x = app();
  x.plan.maxes.squat = 287; x.plan.round.squat = 5; x.bump();
  a.equal(x.rx(x.weekOf(monOf[1]), "squat").w % 5, 0);
  x.plan.round.squat = 2.5; x.bump();
  a.equal(x.rx(x.weekOf(monOf[1]), "squat").w, 200.5 - 0.5);  // 287 × 0.7 = 200.9 → 200
});

test("percentages can run off a training max instead of a true 1RM", () => {
  const x = app();
  x.plan.basis = "tm"; x.plan.tmPct = 90; x.bump();
  a.equal(x.rx(x.weekOf(monOf[1]), "squat").w, 190);          // 300 × 0.9 × 0.7 = 189 → 190
});

test("maxes step up each cycle and an override wins", () => {
  const x = app();
  a.equal(x.maxFor(1).squat.v, 300);
  a.equal(x.maxFor(2).squat.v, 310);
  a.equal(x.maxFor(3).squat.v, 320);
  a.equal(x.maxFor(2).bench.v, 205);
  x.plan.cycleMaxes = { 3: { squat: 335 } }; x.bump();
  a.equal(x.maxFor(3).squat.v, 335);
  a.equal(x.maxFor(4).squat.v, 345, "later cycles build on the override");
});

test("ramp sets scale with the working weight and the week's intensity", () => {
  const x = app();
  const light = x.ramp("squat", 210, "light", false).map((r) => r.w);
  const heavy = x.ramp("squat", 285, "heavy", false).map((r) => r.w);
  a.equal(light[0], x.plan.bar, "always starts with the empty bar");
  a.equal(light.length, 4, "light weeks skip the 85% single");
  a.equal(heavy.length, 6, "heavy weeks add a 90% single");
  a.ok(heavy[heavy.length - 1] < 285, "the last ramp set stays under the working weight");
  a.equal(x.ramp("pull", 160, "mid", false).length, 2, "the pulldown gets a short ramp");
  a.ok(x.ramp("dead", 360, "heavy", false).length < heavy.length, "the deadlift ramps in fewer steps");
});

test("weighted pull-ups work off bodyweight plus added weight", () => {
  const x = app();
  x.plan.l3.on.wpu = true; x.seed({ "2026-10-01": { date: "2026-10-01", checkin: { bw: 200 } } }); x.bump();
  a.equal(x.loadFor("wpu", 45, 70, "2026-10-05"), -27.5, "70% of 245 is under bodyweight");
  a.equal(x.loadFor("wpu", 45, 95, "2026-10-05"), 32.5, "95% of 245 means +32.5 on the belt");
  a.equal(x.fmtLoad("wpu", -27.5), "BW");
  a.equal(x.fmtLoad("wpu", 32.5), "+32.5");
  a.equal(x.estMax("wpu", 50, 1, "2026-10-05"), 50, "a single at +50 is a +50 max");
  a.ok(Math.abs(x.estMax("wpu", 25, 3, "2026-10-05") - 41.9) < 0.2);
});

test("5RM converts to an estimated 1RM", () => {
  const x = app();
  a.equal(Math.round(x.e1rm(260, 5)), 299);
  a.equal(Math.round(x.estMax("squat", 260, 5, "2026-09-29")), 299);
});

test("deload weeks drop the load and cut the deadlift to one set", () => {
  const x = app();
  x.plan.deloadEvery = 1; x.bump();
  const d = x.weeks().find((w) => w.kind === "deload");
  const r = x.rx(d, "squat");
  a.equal(r.p, 60);
  a.equal(r.s, 2);
  a.equal(x.rx(d, "dead").s, 1);
});

test("Lift 3 rotates the way the setting says", () => {
  const x = app();
  x.plan.l3.on.ohp = true;
  const l3 = (d) => x.dayPlan(d).lifts[2];
  x.plan.l3.mode = "same"; x.plan.l3.primary = "pull"; x.bump();
  a.deepEqual([l3("2026-10-05"), l3("2026-10-07"), l3("2026-10-12")], ["pull", "pull", "pull"]);
  x.plan.l3.mode = "alt-day"; x.bump();
  a.deepEqual([l3("2026-10-05"), l3("2026-10-07")], ["pull", "ohp"]);
  x.plan.l3.mode = "alt-week"; x.bump();
  a.deepEqual([l3("2026-10-05"), l3("2026-10-07"), l3("2026-10-12")], ["pull", "pull", "ohp"]);
  x.seed({ "2026-10-12": { date: "2026-10-12", l3: "pull" } });
  a.equal(l3("2026-10-12"), "pull", "a per-day swap overrides the rotation");
});

test("ramp rest defaults to 90 s, is per lift, and ignores nonsense", () => {
  const x = app();
  a.equal(x.warmRestSecs("squat"), 90);                      // the default, not the old 45
  x.plan.warmRest = { squat: 120, bench: 60 };
  a.equal(x.warmRestSecs("squat"), 120);                     // shortened or lengthened per lift
  a.equal(x.warmRestSecs("bench"), 60);
  a.equal(x.warmRestSecs("dead"), 90);                       // a lift with nothing set
  // Under a minute is not a ramp rest any more, however it got there.
  x.plan.warmRest = { squat: 0, bench: 9000, pull: "x", ohp: 30, wpu: 45 };
  for (const k of ["squat", "bench", "pull", "ohp", "wpu"]) a.equal(x.warmRestSecs(k), 90);
  a.deepEqual(x.WARM_RESTS.map(x.warmRestLabel), ["60s", "90s", "2 min", "2.5 min"]);
  a.ok(x.WARM_RESTS.every((v) => v >= 60), "nothing shorter than a minute is on offer");
});
