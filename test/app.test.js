const { test } = require("node:test");
const a = require("node:assert");
const { loadApp } = require("./harness.js");

const maxes = { squat: 300, bench: 200, pull: 180, ohp: 135, dead: 400 };
function app(o) { const x = loadApp(o); Object.assign(x.plan.maxes, maxes); x.bump(); return x }

test("rearranging never leaves two strength or two hard conditioning days together", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19", K = x.slotKinds(mon);
  let checked = 0;
  for (let slot = 0; slot < 7; slot++) {
    for (let day = 0; day < 7; day++) {
      const r = x.bestOrder(mon, day, slot);
      if (!r) continue;
      checked++;
      a.equal(r.ord[day], slot, "the day we asked for gets the session we asked for");
      a.deepEqual([...r.ord].sort().join(), "0,1,2,3,4,5,6", "every session still appears once");
      const kinds = r.ord.map((s) => K[s]);
      for (let i = 1; i < 7; i++) {
        const bad = (kinds[i] === "strength" || kinds[i] === "hic") && kinds[i] === kinds[i - 1];
        a.equal(bad, false, `day ${i} would double up on ${kinds[i]}`);
      }
    }
  }
  a.ok(checked > 20, "a good number of arrangements were reachable");
});

test("moving a session onto Sunday is refused when next Monday lifts", () => {
  const x = app();
  a.equal(x.bestOrder("2026-10-19", 6, 0), null);
});

test("days already done this week stay put", () => {
  const x = app({ now: "2026-10-22" });               // Thursday
  const r = x.bestOrder("2026-10-19", 3, 5);
  a.ok(r, "Thursday can still take Saturday's conditioning");
  a.deepEqual(r.ord.slice(0, 3), [0, 1, 2], "Monday to Wednesday are untouched");
});

test("personal records track the best and what it beat", () => {
  const x = app({ now: "2027-02-20" });
  x.seed({
    "2026-09-29": { date: "2026-09-29", test: { squat: { w: 260, r: 5 } } },
    "2027-02-18": { date: "2027-02-18", test: { squat: { w: 315, r: 1 } }, jumps: { broad: 101 } },
    "2026-10-01": { date: "2026-10-01", jumps: { broad: 96 } },
    "2026-10-06": { date: "2026-10-06", hic: { mod: "echo", format: "map", cal: 140 } },
    "2026-10-13": { date: "2026-10-13", hic: { mod: "echo", format: "map", cal: 151 } },
  });
  const by = Object.fromEntries(x.prList().map((r) => [r.key, r]));
  a.equal(by["lift:squat"].value, 315);
  a.equal(by["lift:squat"].prev, 295, "the 5RM it beat, as an estimated 1RM");
  a.equal(by["jump:broad"].value, 101);
  a.equal(by["hic:echo|map"].value, 151);
  a.deepEqual(x.prsOn("2027-02-18").map((r) => r.key).sort(), ["jump:broad", "lift:squat"]);
  a.equal(x.prsOn("2026-10-06").length, 0, "a first entry is not a personal best");
});

test("bodyweight uses a 7-day average and reports a weekly rate", () => {
  const x = app({ now: "2026-10-28" });
  const seed = {};
  for (let i = 0; i < 28; i++) {
    const d = x.addDays("2026-10-01", i);
    seed[d] = { date: d, checkin: { bw: 208 - i * 0.1 } };     // a clean 0.7 lb/week drop
  }
  x.seed(seed);
  const avg = x.bwAvg("2026-10-28", 7);
  a.equal(avg.n, 7);
  a.ok(Math.abs(avg.avg - 205.6) < 0.05, `average was ${avg.avg}`);
  const rate = x.bwRate("2026-10-28", 14);
  a.ok(Math.abs(rate.perWeek + 0.7) < 0.01, "about 0.7 lb down per week");
  a.ok(Math.abs(x.bwFor("2026-10-28") - avg.avg) < 1e-9, "everything else reads the average");
});

test("hold timers are offered only for real durations", () => {
  const x = app();
  a.deepEqual(x.holdSecs("45–60 sec per side"), { s: 60, sides: 2 });
  a.deepEqual(x.holdSecs("2–3 min"), { s: 180, sides: 1 });
  a.equal(x.holdSecs("8–10 slow reps"), null);
  a.equal(x.holdSecs("10 reps per side"), null);
  a.equal(x.holdSecs("5 breaths"), null);
});

test("each session type gets the mobility block that matches it", () => {
  const x = app();
  const kind = (d) => x.mobKind(x.dayPlan(d));
  a.equal(kind("2026-10-05"), "lift");
  a.equal(kind("2026-10-09"), "dead", "deadlift day gets the posterior chain block");
  a.equal(kind("2026-10-06"), "hic");
  a.equal(kind("2026-10-08"), "plyo");
  a.equal(kind("2026-10-11"), "off");
});

test("the guided runner walks every item and ticks it off", () => {
  const x = app();
  x.seed({ "2026-10-19": { date: "2026-10-19" } });
  x.gdStart("warmup");
  const items = x.gdItems("warmup", "2026-10-19");
  a.equal(items.length, 14);
  let guard = 0;
  while (x.guide && guard++ < 50) {
    const it = x.gdItems("warmup", "2026-10-19")[x.guide.pos];
    x.gdTickOff(it.i);
    x.gdGo(x.guide.pos + 1);
  }
  a.equal(x.guide, null, "it finishes");
  a.equal((x.logs["2026-10-19"].warmup || []).filter(Boolean).length, 14);
});

test("CSV export covers every program with its own plan", () => {
  const x = app({ now: "2027-02-20" });
  x.programs["p-1"] = { id: "p-1", name: "Block 1", startMonday: "2026-09-28", end: "2027-02-14", plan: JSON.parse(JSON.stringify(x.plan)) };
  x.plan.startMonday = "2027-02-15"; x.plan.programName = "Block 2"; x.plan.bridge = false; x.bump();
  x.seed({
    "2026-10-19": { date: "2026-10-19", done: true, lifts: { squat: { sets: [true, true, true] } } },
    "2027-02-15": { date: "2027-02-15", done: true, lifts: { squat: { sets: [true, true, true] } } },
  });
  const rows = x.liftsCsv().split("\r\n").filter(Boolean);
  a.equal(rows.length, 3, "a header and one row per lift");
  a.match(rows[1], /Block 1/);
  a.match(rows[2], /Block 2/);
  a.equal(x.plan.programName, "Block 2", "the current plan is restored afterwards");
  a.match(x.sessionsCsv().split("\r\n")[0], /^﻿?date,program,week,session/);
});

test("undo puts back what a change overwrote", () => {
  const x = app();
  x.seed({ "2026-10-19": { date: "2026-10-19", lifts: { squat: { sets: [true, true, true] } }, rpe: 8 } });

  const restore = x.snapLog("2026-10-19");
  x.offerUndo("Set unticked", restore);
  x.setLog("2026-10-19", "lifts.squat.sets", [true, false, false]);
  x.setLog("2026-10-19", "rpe", null);
  a.deepEqual(x.logs["2026-10-19"].lifts.squat.sets, [true, false, false]);
  x.doUndo();
  a.deepEqual(x.logs["2026-10-19"].lifts.squat.sets, [true, true, true], "sets come back");
  a.equal(x.logs["2026-10-19"].rpe, 8, "and so does everything else in that day");

  const before = x.maxFor(2).squat.v;
  x.offerUndo("Lowered the max", x.snapPlan());
  x.mutatePlan((p) => { p.cycleMaxes[2] = { squat: 250 } });
  a.equal(x.maxFor(2).squat.v, 250);
  x.doUndo();
  a.equal(x.maxFor(2).squat.v, before, "the plan is restored");

  x.doUndo();                       // nothing queued: must not throw or change anything
  a.equal(x.maxFor(2).squat.v, before);
});

test("a day with no log at all is undone back to empty", () => {
  const x = app();
  const restore = x.snapLog("2026-10-20");
  x.setLog("2026-10-20", "done", true);
  a.equal(x.logs["2026-10-20"].done, true);
  x.offerUndo("Session marked done", restore);
  x.doUndo();
  a.equal(x.logs["2026-10-20"].done, undefined);
});

test("Setup still has every card it is supposed to", () => {
  const x = app();
  x.me = "jon@example.com";
  const h = x.vSetup();
  for (const title of ["Maxes", "Programs", "Appearance", "Program", "Lift 3", "Rest alerts",
    "Spoken cues", "Mobility", "Accessories", "Conditioning", "Recovery and nutrition",
    "The wave", "Cycles, deloads and retests", "About this app", "Backups",
    "Export to a spreadsheet"]) {
    a.ok(h.includes(`<h2>${title}</h2>`), `Setup is missing the "${title}" card`);
  }
  a.match(h, /jon@example\.com/, "About this app shows who is signed in");
  a.match(h, /data-view="releases"/, "and links to the release notes");
});

test("release notes are present and newest first", () => {
  const x = app();
  const h = x.vReleases();
  a.equal((h.match(/<h3>/g) || []).length, x.RELEASES.length);
  a.match(h, /Current/, "the newest release is marked as current");
  const dates = x.RELEASES.map((r) => r.date);
  a.deepEqual(dates, [...dates].sort().reverse(), "newest first");
  for (const r of x.RELEASES) a.ok(r.items.length && r.v && r.title, `release ${r.v} is complete`);
});
