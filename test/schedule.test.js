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
  x.plan.deloadEvery = 1; x.plan.wave[2].p = 85; x.bump();
  const after = x.weekOf("2026-10-19");
  a.equal(after.kind, before.kind);
  a.equal(after.cycle, before.cycle);
  a.equal(after.w, before.w);
  a.equal(x.rx(after, "squat").p, 90, "a locked week keeps the percentage it was trained at");
  // the new rules apply from the current week on: a deload now falls after cycle 1
  a.equal(x.weekOf("2026-11-16").kind, "deload");
  const w3 = x.weeks().find((w) => w.kind === "cycle" && w.w === 3 && w.monday > "2026-11-16");
  a.equal(x.rx(w3, "squat").p, 85, "the next week 3 takes the edited wave");
});

test("the weekly layout is strength / conditioning on alternate days", () => {
  const x = app();
  const mon = "2026-10-19";
  const kinds = [0, 1, 2, 3, 4, 5, 6].map((i) => x.sessKind(x.dayPlan(x.addDays(mon, i))));
  a.deepEqual(kinds, ["strength", "hic", "strength", "hic", "strength", "hic", "other"]);
});
