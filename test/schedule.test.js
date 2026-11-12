const { test } = require("node:test");
const a = require("node:assert");
const { loadApp } = require("./harness.js");

const maxes = { squat: 300, bench: 200, pull: 180, ohp: 135, dead: 400 };
function app(o) { const x = loadApp(o); Object.assign(x.plan.maxes, maxes); x.bump(); return x }

test("bridge week runs first, then six-week cycles", () => {
  const x = app();
  const w = x.weeks();
  a.equal(w[0].kind, "bridge");
  a.equal(w[0].monday, "2026-09-28");
  for (let i = 1; i <= 6; i++) { a.equal(w[i].kind, "cycle"); a.equal(w[i].cycle, 1); a.equal(w[i].w, i) }
  a.equal(w[7].cycle, 2);
});

test("no bridge week when it is turned off", () => {
  const x = app(); x.plan.bridge = false; x.bump();
  a.equal(x.weeks()[0].kind, "cycle");
});

test("deload and retest land on their cadence, and a retest wins over a deload", () => {
  const x = app();
  x.plan.deloadEvery = 2; x.plan.testEvery = 3; x.bump();
  const kinds = x.weeks().slice(0, 30).map((w) => w.kind + (w.cycle ? w.cycle : ""));
  a.deepEqual(kinds.filter((k) => k === "deload").length > 0, true);
  const after2 = x.weeks().find((w) => w.kind === "deload");
  a.equal(after2.after, 2, "first deload follows cycle 2");
  const test1 = x.weeks().find((w) => w.kind === "test");
  a.equal(test1.after, 3, "first retest follows cycle 3, replacing that deload");
  const both = x.weeks().filter((w) => (w.kind === "deload" || w.kind === "test") && w.after === 3);
  a.equal(both.length, 1, "cycle 3 gets one extra week, not two");
});

test("deload cadence of 0 schedules none", () => {
  const x = app(); x.plan.deloadEvery = 0; x.bump();
  a.equal(x.weeks().slice(0, 40).filter((w) => w.kind === "deload").length, 0);
});

test("an inserted week pushes everything back and can be removed", () => {
  const x = app();
  const before = x.weeks().map((w) => w.kind + (w.w || ""));
  x.plan.inserts = { "2026-10-19": "off" }; x.bump();
  const wk = x.weekOf("2026-10-19");
  a.equal(wk.kind, "off");
  a.equal(x.weekOf("2026-10-26").w, 3, "the week that was displaced now runs a week later");
  x.plan.inserts = {}; x.bump();
  a.deepEqual(x.weeks().map((w) => w.kind + (w.w || "")), before, "removing it restores the original plan");
});

test("a skipped deload does not appear", () => {
  const x = app();
  x.plan.deloadEvery = 2; x.plan.testEvery = 3; x.bump();   // deloads are off by default now
  const d = x.weeks().find((w) => w.kind === "deload");
  x.plan.skips = { [d.rule]: true }; x.bump();
  a.equal(x.weeks().find((w) => w.kind === "deload" && w.after === d.after), undefined);
});

test("past weeks are frozen and survive a rule change", () => {
  const x = app({ now: "2026-11-18" });
  const before = x.weekOf("2026-10-19");
  a.equal(x.freezePast(), true);
  x.plan.deloadEvery = 1; x.plan.waves.operator[2].p = 85; x.bump();
  const after = x.weekOf("2026-10-19");
  a.equal(after.kind, before.kind);
  a.equal(after.cycle, before.cycle);
  a.equal(after.w, before.w);
  a.equal(x.rx(after, "squat").p, 90, "a locked week keeps the percentage it was trained at");

  // The week you are in keeps its identity: a cadence change on Wednesday must not turn
  // the week you are halfway through into a deload. It takes effect from next week.
  a.equal(x.weekOf("2026-11-16").kind, "cycle", "the current week is not reshuffled underneath you");
  // The boundary the deload belonged to (the end of cycle 1) is behind the frozen week,
  // so it is not retro-fitted; the new cadence acts on the next boundary it can reach.
  const dl = x.weeks(60).filter((w) => w.kind === "deload");
  a.ok(dl.length, "the new cadence does take effect");
  a.ok(dl[0].monday > "2026-11-16", "just not inside the week already under way");

  // Its numbers are not frozen though -- Setup promises the wave applies from this week.
  const w3 = x.weeks().find((w) => w.kind === "cycle" && w.w === 3 && w.monday > "2026-11-16");
  a.equal(x.rx(w3, "squat").p, 85, "the next week 3 takes the edited wave");
});

test("the weekly layout is strength / conditioning on alternate days", () => {
  const x = app();
  const mon = "2026-10-19";
  const kinds = [0, 1, 2, 3, 4, 5, 6].map((i) => x.sessKind(x.dayPlan(x.addDays(mon, i))));
  // Saturday is Black's HIC-or-E slot (TB II p59); with no history an E is due, and
  // an easy session is still conditioning on its own day.
  a.deepEqual(kinds, ["strength", "hic", "strength", "hic", "strength", "easy", "other"]);
});

/* ---------------- the plan you live is the plan you were shown (3.84) ----------------
Every other test of the engine lays a plan out once and reads it. That misses the one
thing that happens to a real plan: the week you are in is locked when it starts, and
every week after it is generated again from the locks. This walks a plan forward a week
at a time, opening the app each Wednesday, and requires that what arrives is what was
on the calendar at the start. It is how the missing 3-1-3-1 recovery weeks were found. */
function lived(setup, n = 20) {
  const x = loadApp({ now: "2026-09-07" });
  Object.assign(x.plan.maxes, { squat: 300, bench: 200, dead: 350, pull: 150 });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; setup(x.plan); x.bump();
  const name = (w) => w.kind + (w.w ? w.w : "") + (w.cycle ? "/c" + w.cycle : "");
  const planned = x.weeks().slice(0, n).map(name), got = [];
  for (let i = 0; i < n; i++) {
    const d = x.addDays("2026-09-07", i * 7 + 2);
    x.setToday(d); x.bump(); x.freezePast();
    got.push(name(x.weekOf(d)));
  }
  return { planned, got };
}

test("3-1-3-1 recovery weeks arrive, week after week, as the calendar promised", () => {
  const { planned, got } = lived((p) => { p.recovery313 = true });
  a.deepEqual(planned.slice(0, 9), ["cycle1/c1", "cycle2/c1", "cycle3/c1", "recovery/c1", "cycle4/c1", "cycle5/c1", "cycle6/c1", "recovery/c1", "cycle1/c2"],
    "a six-week block takes eight");
  a.deepEqual(got, planned, "and living it week by week delivers every one of them");
});

test("locking the week you are in never changes what comes next, for any spacing of deloads and retests", () => {
  const cases = { plain: () => {}, "a deload after every cycle": (p) => { p.deloadEvery = 1 }, "a retest after every cycle": (p) => { p.testEvery = 1 },
    "a retest every second cycle and a deload every cycle": (p) => { p.testEvery = 2; p.deloadEvery = 1 },
    "3-1-3-1 with a retest every cycle": (p) => { p.recovery313 = true; p.testEvery = 1 },
    "a bridge week first": (p) => { p.bridge = true },
    "Zulu": (p) => { p.stempl = "zulu" }, "Mass": (p) => { p.stempl = "mass" }, "Fighter": (p) => { p.stempl = "fighter" } };
  for (const [label, setup] of Object.entries(cases)) {
    const { planned, got } = lived(setup);
    a.deepEqual(got, planned, label);
  }
});

test("switching 3-1-3-1 off or on part way applies from the week you are in", () => {
  const x = loadApp({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.recovery313 = true; x.bump();
  // Through the third week, with the recovery week due next.
  for (let i = 0; i < 3; i++) { x.setToday(x.addDays("2026-09-07", i * 7 + 2)); x.bump(); x.freezePast() }
  a.equal(x.weeks()[3].kind, "recovery");
  x.plan.recovery313 = false; x.bump();
  a.equal(x.weeks()[3].kind, "cycle", "off: the next week is week four");
  a.equal(x.weeks()[3].w, 4);
  x.plan.recovery313 = true; x.bump();
  a.equal(x.weeks()[3].kind, "recovery", "and back on, it is owed again");
  // A recovery week that has been lived is not handed out twice.
  x.setToday("2026-09-30"); x.bump(); x.freezePast();
  x.setToday("2026-10-07"); x.bump(); x.freezePast();
  a.deepEqual(x.weeks().slice(3, 6).map((w) => w.kind + (w.w || "")), ["recovery", "cycle4", "cycle5"]);
});
