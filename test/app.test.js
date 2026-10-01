const { test } = require("node:test");
const a = require("node:assert");
const { loadApp } = require("./harness.js");
const fs = require("node:fs");
const path = require("node:path");

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

test("the release version and package.json agree, so deploy tags are truthful", () => {
  const x = app();
  const pkg = require("../package.json");
  a.equal(x.APP_VERSION, x.RELEASES[0].v, "the app reports its newest release as its version");
  a.equal(pkg.version.split(".").slice(0, 2).join("."), x.APP_VERSION,
    `package.json is ${pkg.version} but the newest release is ${x.APP_VERSION}`);
  a.equal(x.tagVersion(`v${pkg.version}-abc1234`), x.APP_VERSION, "the deploy tag parses back to it");
  a.equal(x.tagVersion("abc1234"), null, "an untagged deploy reports no version");
});

test("a travel week pauses the cycle and keeps its own movements", () => {
  const x = app({ now: "2026-10-19" });
  const wasWeek3 = x.weekOf("2026-10-19");
  a.equal(wasWeek3.w, 3);

  x.plan.inserts = { "2026-10-19": "travel" };
  x.bump();
  const wk = x.weekOf("2026-10-19");
  a.equal(wk.kind, "travel");
  a.equal(x.weekTitle(wk).t, "Travel week");
  a.equal(x.weekOf("2026-10-26").w, 3, "the cycle picks up where it left off");

  const week = [0, 1, 2, 3, 4, 5, 6].map((i) => x.dayPlan(x.addDays("2026-10-19", i)));
  a.deepEqual(week.map((d) => d.t), ["travel", "hic", "travel", "plyohic", "travel", "hic", "off"]);
  a.deepEqual(week.map((d) => x.sessKind(d)),
    ["strength", "hic", "strength", "hic", "strength", "hic", "other"],
    "the rule about back-to-back days still holds on a travel week");
  a.equal(x.mobKind(week[4]), "dead", "the hinge day gets the posterior chain block");
  a.ok(x.travelList("day1").length >= 3);
});

test("a travel week is left out of the cycle review", () => {
  const x = app({ now: "2026-11-30" });
  const seed = {};
  for (const w of x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1)) {
    for (const i of [0, 2, 4]) {
      const d = x.addDays(w.monday, i);
      seed[d] = { date: d, done: true, rpe: 7, lifts: { squat: { sets: [true, true, true] } } };
    }
  }
  x.seed(seed);
  const before = x.cycleStats(1).stats.squat.n;

  x.plan.inserts = { "2026-10-19": "travel" };
  x.bump();
  const travelDay = "2026-10-19";
  x.seed({ [travelDay]: { date: travelDay, done: true, rpe: 9, travel: { 0: true } } });
  const after = x.cycleStats(1).stats.squat.n;
  a.ok(after < before, "the displaced week no longer counts toward the review");
  a.equal(x.dayPlan(travelDay).t, "travel");
});

test("upper-body plyos are optional, rotate with the jump phases, and swap per slot", () => {
  const x = app({ now: "2026-10-22" });        // Thursday, cycle 1 week 3
  a.equal(!!x.plan.plyoUpper, false, "off unless asked for");
  const wk = x.weekOf("2026-10-22");
  const card = () => x.plyoUpperCard(wk, false, false);
  a.ok(!/data-act="upset"/.test(card()), "no sets to tick while it is off");

  x.plan.plyoUpper = true; x.bump();
  a.match(card(), /data-act="upset"/);

  const names = x.weeks().filter((w) => w.kind === "cycle" && w.cycle <= 2)
    .map((w) => x.plyoUpperPhase(w).name);
  a.deepEqual(names.slice(0, 9),
    ["Power","Power","Power","Rotation","Rotation","Rotation","Elastic","Elastic","Elastic"],
    "three weeks per phase, in step with the jump phases");

  // Every slot offers real alternatives, and every option is documented.
  for (const ph of x.PLYO_UPPER) for (const sl of ph.slots) {
    a.ok(sl.opts.length >= 2, `${ph.name} / ${sl.name} has something to swap to`);
    a.ok(sl.s > 0);
    for (const o of sl.opts) {
      a.ok(x.PLIB[o.id], `${o.id} has a library entry`);
      a.ok(o.gear && o.r && o.rest > 0, `${o.id} says what it needs`);
    }
  }

  // The default is the first option; a pick sticks, and drives the reps and the rest.
  const ph0 = x.plyoUpperPhase(wk);
  a.equal(x.plyoUpperEx(ph0)[1].id, "chestpass");
  x.plan.plyoUp = { [x.upKey(ph0, 1)]: "speedpress" }; x.bump();
  const picked = x.plyoUpperEx(ph0)[1];
  a.equal(picked.id, "speedpress");
  a.equal(picked.rest, 90);
  a.match(card(), /Speed bench or floor press/);
  a.match(card(), /data-pbind="plyoUp\.0-1"/);

  // A pick on one phase does not leak into another.
  a.equal(x.plyoUpperEx(x.PLYO_UPPER[1])[1].id, "explpull");
});

test("both jump-test days warm up before maximal attempts", () => {
  const x = app({});
  const days = x.weeks().flatMap((w) =>
    [0, 1, 2, 3, 4, 5, 6].map((d) => [x.addDays(w.monday, d), x.dayPlan(x.addDays(w.monday, d))])
  ).filter(([, dp]) => dp.t === "plyobase" || dp.jumps);
  a.ok(days.some(([, dp]) => dp.t === "plyobase"), "the bridge week tests jumps");
  a.ok(days.some(([, dp]) => dp.t === "test"), "so does every retest week");
  for (const [date, dp] of days) {
    x.sel = date;
    const h = x.sessionHtml(x.weekOf(date), dp);
    a.match(h, /Jump warm-up/, `${date} (${dp.t}) has the jump drills`);
    a.match(h, /Warm-up<\/b>/, `${date} (${dp.t}) has the general warm-up`);
    a.ok(h.indexOf("Jump warm-up") < h.indexOf("Jump tests"), `${date} warms up first`);
  }
  // The three tested jumps all have a library entry now.
  for (const id of ["broad", "vertj", "triple"]) a.ok(x.PLIB[id], `${id} is in the library`);
  a.match(x.jumpCard("x"), /Standing triple jump/);
});

test("a day whose label promises conditioning renders a card to log it", () => {
  const x = app({});
  const days = x.weeks().flatMap((w) =>
    [0, 1, 2, 3, 4, 5, 6].map((d) => [x.addDays(w.monday, d), x.dayPlan(x.addDays(w.monday, d))])
  );
  const spin = days.find(([, dp]) => dp.short === "5RM+Spin");
  a.ok(spin, "the bridge week's two-Lift-3 Saturday exists with both lifts on it");
  x.sel = spin[0];
  const h = x.sessionHtml(x.weekOf(spin[0]), spin[1]);
  a.match(h, /Interval timer/, "the easy spin can be timed");
  a.match(h, /Minutes/, "and logged");
  a.ok(h.indexOf("5RM") < h.indexOf("Interval timer"), "lifts first, spin after");

  // Nothing whose short label mentions conditioning is left without a card for it.
  for (const [date, dp] of days) {
    if (!/hic|spin|easy|liss/i.test(dp.short || "")) continue;
    x.sel = date;
    a.match(x.sessionHtml(x.weekOf(date), dp), /Interval timer/, `${date} (${dp.short}) can log it`);
  }
});

test("the plyo phase is on the day header only where it applies", () => {
  const x = app({});
  const wk = x.weeks().find((w) => w.kind === "cycle");
  const line = (d) => { x.sel = d; return x.vToday().split("</div>").find((s) => s.includes("wkline")) || ""; };

  const thu = x.addDays(wk.monday, 3);
  a.equal(x.dayPlan(thu).t, "plyohic", "Thursday is the plyo day");
  a.match(line(thu), /Plyo: Extensive · ~60 contacts/, "named, with its contact target");

  for (const i of [0, 1, 2, 4, 5, 6]) {
    const d = x.addDays(wk.monday, i);
    a.doesNotMatch(line(d), /Plyo:/, `${d} does not do plyos, so it does not label them`);
    a.match(line(d), /Cycle 1/, "but still says which week it is");
  }
  // Halving the contacts halves the target on the header too.
  x.seed({ [thu]: { date: thu, plyo: { cut: true } } });
  a.match(line(thu), /~30 contacts/);
});

test("signing out is reachable from the header and from Setup", () => {
  const x = app({});
  x.me = "jon.morozowski@gmail.com";
  a.equal(x.initials("jon.morozowski@gmail.com"), "JM");
  a.equal(x.initials("sam@example.com"), "SA");
  a.equal(x.initials(""), "•", "no email, no initials, but still a button");

  x.acctPaint();
  const el = (id) => x.dom.made[id];
  a.equal(el("acct-i").textContent, "JM");
  a.equal(el("acct-e").textContent, "jon.morozowski@gmail.com");
  a.equal(el("acct-out").textContent, "Sign out");

  const setup = x.vSetup();
  a.match(setup, /Account/);
  a.match(setup, /href="\/cdn-cgi\/access\/logout"/, "Cloudflare Access drops the session");
  a.match(setup, /jon\.morozowski@gmail\.com/);
  a.ok(setup.indexOf("Account") < setup.indexOf("Maxes"), "the account card is first");
});

test("nothing outside #main relies on the data-act delegation", () => {
  // The click handler for data-act is bound to #main. Static markup in the header that
  // carries data-act looks wired and does nothing, which is how the account menu shipped
  // with two dead items.
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  a.deepEqual(header.match(/data-act="[^"]*"/g) || [], [], "header uses its own listeners");

  // The account menu's items are routed by data-view instead.
  a.match(header, /data-view="setup"[^>]*role="menuitem"/);
  a.match(header, /data-view="releases"[^>]*role="menuitem"/);
  a.match(header, /id="acct-out"[^>]*href="\/cdn-cgi\/access\/logout"/);
});

test("conditioning minutes per week: logged minutes win, the rest are the planned length", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-10-05"; x.plan.bridge = false; x.bump();
  const mon = x.mondayOf("2026-11-11");
  const prev = x.addDays(mon, -7);
  // one session with minutes logged, one with only a result
  const hics = [];
  for (let i = 0; i < 7; i++) { const d = x.addDays(prev, i); if (x.dayPlan(d).t === "hic") hics.push(d) }
  a.ok(hics.length >= 2, "the week has two conditioning days");
  const [timed, map] = hics;
  x.seed({
    [timed]: { date: timed, done: true, hic: { format: "liss", mod: "echo", min: 40, cal: 300 } },
    [map]: { date: map, done: true, hic: { format: "map", mod: "echo", cal: 120 } },
  });
  x.bump();

  const wks = x.condWeeks(12);
  const row = wks.find((w) => w.mon === prev);
  a.equal(row.n, 2, "both sessions counted");
  a.equal(row.est, 1, "one of them had no minutes logged");
  const planned = Math.round(x.ivTotal(x.ivSegments("map", x.ivOpts(map, "map"))) / 60);
  a.equal(row.min, 40 + planned, "logged minutes plus the planned length of the other");

  // Weeks before the program started are not drawn at all.
  a.ok(wks.every((w) => w.mon >= x.mondayOf(x.plan.startMonday)));
  const html = x.vStatus();
  a.match(html, /Minutes per week/);
  a.match(html, /still running/, "the current week is marked as incomplete");
});

test("the adherence heatmap matches the week dots, and says nothing before the start", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-10-05"; x.plan.bridge = false; x.bump();
  const t = "2026-11-11";
  const h = x.heatmap(t, 12);
  a.match(h, /Last 6 weeks/, "only weeks since the start");
  const cells = h.slice(h.indexOf('<div class="heat" '));
  a.equal((cells.match(/<i class="/g) || []).length, 6 * 7, "six weeks of seven cells");

  // A done day reads done in both places; a past untouched day reads missed in both.
  const done = x.addDays(x.mondayOf(t), -7);
  x.seed({ [done]: { date: done, done: true } }); x.bump();
  a.equal(x.sessState(done, t), "done");
  a.match(x.heatmap(t, 12), new RegExp(`<i class="done" title="${x.fmtD(done, true)}`));

  // Nothing before the program start is coloured: on day one there is nothing missed.
  const early = x.heatmap(x.plan.startMonday, 12);
  a.match(early, /Last 1 week\b/);
  const grid = early.slice(early.indexOf('<div class="heat" '));   // past the legend
  a.ok(!/<i class="missed"/.test(grid), "day one has nothing behind it");
  a.ok(!/<i class="pre"/.test(grid), "and no cells from before the start");
});

test("the heaviest completed set only claims a 1RM when you logged your own weight", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  // find a heavy-week squat day (>=85%)
  const heavy = x.weeks().filter((w) => w.kind === "cycle" && x.rx(w, "squat").p >= 85)[0];
  a.ok(heavy, "a heavy week exists");
  const d = x.addDays(heavy.monday, 0), v = x.rx(heavy, "squat");

  x.seed({ [d]: { date: d, done: true, lifts: { squat: { sets: [true, true, true] } } } }); x.bump();
  const asRx = x.heavySet("squat");
  a.equal(asRx.off, false, "nothing was overridden");
  a.match(x.vStatus(), /Heaviest set completed/);
  a.ok(!/implies/.test(x.vStatus()), "a prescribed set restates the max, so it claims nothing");

  // Now log a heavier weight than prescribed: that is real evidence.
  const w = x.loadFor("squat", v.m.v, v.p, d) + 20;
  x.seed({ [d]: { date: d, done: true, lifts: { squat: { sets: [true, true, true], used: w } } } }); x.bump();
  const over = x.heavySet("squat");
  a.equal(over.off, true);
  a.equal(over.w, w);
  a.ok(over.e > asRx.e, "a heavier set implies a higher max");
  a.match(x.vStatus(), /implies/);
});

test("releases are a history: newest first, each version used once", () => {
  const x = app({});
  const rs = x.RELEASES;
  a.ok(rs.length > 1);
  const num = (v) => v.split(".").map(Number);
  for (let i = 1; i < rs.length; i++) {
    const [aMaj, aMin] = num(rs[i - 1].v), [bMaj, bMin] = num(rs[i].v);
    a.ok(aMaj > bMaj || (aMaj === bMaj && aMin > bMin), `${rs[i - 1].v} comes after ${rs[i].v}`);
    a.ok(rs[i - 1].date >= rs[i].date, `${rs[i - 1].v} (${rs[i - 1].date}) is not older than ${rs[i].v} (${rs[i].date})`);
  }
  for (const r of rs) {
    a.match(r.v, /^\d+\.\d+$/, "major.minor, which is what APP_VERSION reports");
    a.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
    a.ok(r.title && r.items.length, `${r.v} says what changed`);
  }
  a.equal(new Set(rs.map((r) => r.v)).size, rs.length, "no version reused");
  a.equal(x.APP_VERSION, rs[0].v);
});

test("bodyweight charts every weigh-in and the average it feeds", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const set = (r) => { x.dom.store["ob.bwRange"] = JSON.stringify(r) };

  set("90");
  a.match(x.bwCard("2026-11-30"), /Log your weight in the daily check-in/, "nothing logged yet");

  // 60 days of weigh-ins, noisy, trending down
  let w = 210;
  for (let i = 59; i >= 0; i--) {
    const d = x.addDays("2026-11-30", -i);
    w -= 0.05;
    x.seed({ [d]: { date: d, checkin: { bw: Math.round((w + [0.8, -0.9, 0.2, -0.3, 0.6][i % 5]) * 10) / 10 } } });
  }
  x.bump();

  const h = x.bwCard("2026-11-30");
  a.match(h, /class="ch-line2"/, "the raw weigh-ins are drawn");
  a.match(h, /class="ch-pt2"/);
  a.match(h, /Weighed on 60 of the last 60 days/);
  a.match(h, /7-day average/);

  // The series carries both numbers per point, and the average is steadier than the raw.
  const xs = x.bwSeries("2026-11-30");
  a.equal(xs.length, 60);
  a.ok(xs.every((p) => p.raw != null && p.v != null));
  const spread = (f) => Math.max(...xs.map(f)) - Math.min(...xs.map(f));
  a.ok(spread((p) => p.v) < spread((p) => p.raw), "the average smooths the weigh-ins");

  // The range picker changes the window, and is per device.
  set("30");
  a.equal(x.bwSeries("2026-11-30").length, 30);
  a.match(x.bwCard("2026-11-30"), /aria-pressed="true">30 days/);
  set("all");
  a.equal(x.bwSeries("2026-11-30").length, 60, "all = back to the program start");
  set("nonsense");
  a.equal(x.bwRange(), 90, "an unknown range falls back to the default");

  // Change over the range compares the ends the same way, so one noisy first
  // weigh-in cannot set the headline.
  set("all");
  const xs2 = x.bwSeries("2026-11-30");
  const mean = (a0) => a0.reduce((s, p) => s + p.raw, 0) / a0.length;
  const want = mean(xs2.slice(-7)) - mean(xs2.slice(0, 7));
  a.match(x.bwCard("2026-11-30"), new RegExp(">" + (want > 0 ? "\\+" : "") + x.r1(want) + "<"));
  a.match(x.bwCard("2026-11-30"), /first 7 vs last 7/);
});

test("measured TDEE is energy balance, not a formula", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  // 28 days: ate exactly 2500, lost exactly 2 lb of trend weight.
  // 2 lb over 27 days = 7000 kcal = 259/day, so the burn is 2500 + 259.
  const start = x.addDays("2026-11-30", -27);
  for (let i = 0; i <= 27; i++) {
    const d = x.addDays(start, i);
    const bw = 200 - (2 * i) / 27;
    // calories for day d are logged on the check-in the next morning
    x.seed({ [d]: { date: d, checkin: { bw: Math.round(bw * 100) / 100, kcal: 2500 } } });
  }
  x.bump();
  const m = x.tdeeMeasured("2026-11-30", 28);
  a.ok(m, "28 days of both is enough");
  a.equal(m.mean, 2500);
  // the end groups are centred 21 days apart, so they differ by 21/27 of the 2 lb
  a.equal(m.gap, 21);
  a.ok(Math.abs(m.dw + 2 * 21 / 27) < 0.05, `end groups differ by ${m.dw}`);
  a.ok(Math.abs(m.tdee - 2759) < 40, `burn ${m.tdee} should be about 2759`);

  // Eating at maintenance: burn equals intake.
  for (let i = 0; i <= 27; i++) {
    const d = x.addDays(start, i);
    x.seed({ [d]: { date: d, checkin: { bw: 200, kcal: 2800 } } });
  }
  x.bump();
  a.equal(x.tdeeMeasured("2026-11-30", 28).tdee, 2800, "flat weight means you ate your burn");

  // It refuses to guess when the data is thin.
  for (let i = 0; i <= 27; i++) {
    const d = x.addDays(start, i);
    x.seed({ [d]: { date: d, checkin: { bw: 200, kcal: i < 10 ? 2800 : null } } });
  }
  x.bump();
  a.equal(x.tdeeMeasured("2026-11-30", 28), null, "not enough days with calories");
});

test("Mifflin-St Jeor and the Navy tape method match their published formulas", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.bump();
  x.seed({ "2026-11-30": { date: "2026-11-30", checkin: { bw: 200 } } });
  Object.assign(x.plan, { sex: "m", height: 70, birthYear: 1983, activity: 1.55 });
  x.bump();

  // 200 lb = 90.72 kg, 70 in = 177.8 cm, age 43 in 2026
  // 10(90.72) + 6.25(177.8) - 5(43) + 5 = 907.2 + 1111.25 - 215 + 5 = 1808
  a.equal(x.bmr("2026-11-30"), 1808);
  a.equal(x.tdeePredicted("2026-11-30"), Math.round(1808 * 1.55));
  a.equal(x.ageNow(), 43);

  // Navy, men: 86.010*log10(waist-neck) - 70.041*log10(height) + 36.76
  const m = { neck: 15.5, waist: 34, hip: 40 };
  const want = 86.010 * Math.log10(34 - 15.5) - 70.041 * Math.log10(70) + 36.76;
  a.equal(x.navyBf(m, "2026-11-30"), Math.round(want * 10) / 10);
  a.ok(x.navyBf(m, "2026-11-30") > 14 && x.navyBf(m, "2026-11-30") < 20, "a plausible number");

  // Women use the hips, and without them it declines to answer.
  x.plan.sex = "f"; x.bump();
  const wantF = 163.205 * Math.log10(34 + 40 - 15.5) - 97.684 * Math.log10(70) - 78.387;
  a.equal(x.navyBf(m, "2026-11-30"), Math.round(wantF * 10) / 10);
  a.equal(x.navyBf({ neck: 15.5, waist: 34 }, "2026-11-30"), null);

  // Missing profile data means no estimate rather than a wrong one.
  x.plan.sex = "m"; x.plan.height = null; x.bump();
  a.equal(x.navyBf(m, "2026-11-30"), null);
  a.equal(x.bmr("2026-11-30"), null);
  a.equal(x.navyBf({ neck: 16, waist: 15 }, "2026-11-30"), null, "waist under neck is not a body fat of zero");
});

test("calories belong to the day they were eaten, not the day they were logged", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.bump();
  x.seed({ "2026-11-30": { date: "2026-11-30", checkin: { kcal: 2200 } } });
  x.bump();
  a.equal(x.kcalOn("2026-11-29"), 2200, "logged on the 30th, eaten on the 29th");
  a.equal(x.kcalOn("2026-11-30"), null, "today's intake is not known until tomorrow");
});

test("the burn estimate follows the data instead of holding day one's number", () => {
  const x = app({ now: "2026-12-31" });
  x.plan.startMonday = "2026-08-03"; x.plan.bridge = false;
  Object.assign(x.plan, { sex: "m", height: 70, birthYear: 1983, activity: 1.9 });  // a high, wrong guess
  x.bump();

  // Someone whose real burn is 2600, then drops to 2250 halfway through: same intake,
  // weight stops falling and starts rising.
  const start = "2026-08-03";
  let w = 200;
  const days = Math.round((Date.parse("2026-12-31") - Date.parse(start)) / 864e5);
  for (let i = 0; i <= days; i++) {
    const d = x.addDays(start, i);
    const burn = i < days / 2 ? 2600 : 2250;
    w += (2400 - burn) / 3500;                        // eats 2400 every day
    x.seed({ [d]: { date: d, checkin: { bw: Math.round(w * 100) / 100, kcal: 2400 } } });
  }
  x.bump();

  const early = x.tdeeOn(x.addDays(start, 40));
  const late = x.tdeeOn("2026-12-31");
  a.ok(early && late);
  a.ok(Math.abs(early.measured.tdee - 2600) < 60, `early measured ${early.measured.tdee} ~ 2600`);
  a.ok(Math.abs(late.measured.tdee - 2250) < 60, `late measured ${late.measured.tdee} ~ 2250`);
  a.ok(late.tdee < early.tdee - 200, "the headline number came down with it");

  // The formula's bad guess gets diluted as evidence builds.
  a.ok(late.w > early.w, `trust rose from ${early.w.toFixed(2)} to ${late.w.toFixed(2)}`);
  a.ok(late.w > 0.9, "with months of data the formula stops mattering");
  a.ok(late.predicted > 3000, "...which it needs to, because the formula is way off here");

  // On day one there is no data, so it is the formula alone, not a refusal.
  const x2 = app({ now: "2026-08-03" });
  x2.plan.startMonday = "2026-08-03";
  Object.assign(x2.plan, { sex: "m", height: 70, birthYear: 1983, activity: 1.55 });
  x2.seed({ "2026-08-03": { date: "2026-08-03", checkin: { bw: 200 } } });
  x2.bump();
  const day1 = x2.tdeeOn("2026-08-03");
  a.equal(day1.w, 0);
  a.equal(day1.tdee, x2.tdeePredicted("2026-08-03"));
  a.equal(day1.measured, null);

  // The series is one point per week and only covers weeks that had the data.
  const ts = x.tdeeSeries("2026-12-31", 12);
  a.equal(ts.length, 12);
  a.ok(ts[0].v > ts[ts.length - 1].v, "it drifts down across the series");
  a.match(x.energyCard("2026-12-31"), /Burn over time/);
  a.match(x.energyCard("2026-12-31"), /come down about/);
});

test("the formula's share falls as evidence builds, on one rule", () => {
  const x = app({ now: "2026-12-31" });
  x.plan.startMonday = "2026-08-03"; x.plan.bridge = false;
  Object.assign(x.plan, { sex: "m", height: 70, birthYear: 1983, activity: 1.9 });
  x.bump();
  let w = 200;
  for (let i = 0; i <= 150; i++) {
    const d = x.addDays("2026-08-03", i);
    w -= 0.03;
    x.seed({ [d]: { date: d, checkin: { bw: Math.round(w * 100) / 100, kcal: 2400 } } });
  }
  x.bump();

  // 42 days of logging both and the formula is gone; before that it is a straight ramp.
  const at = (i) => x.tdeeOn(x.addDays("2026-08-03", i));
  a.equal(Math.round(at(21).w * 100), Math.round(21 / 42 * 100));
  a.equal(Math.round(at(35).w * 100), Math.round(35 / 42 * 100));
  a.equal(at(60).w, 1);
  a.equal(at(120).w, 1, "it does not drift back");
  a.equal(at(120).tdee, at(120).measured.tdee, "at full trust the headline is your own number");

  // Stop logging calories and the estimate decays back toward the formula rather than
  // freezing on a number that is going stale.
  for (let i = 121; i <= 150; i++) {
    const d = x.addDays("2026-08-03", i);
    x.seed({ [d]: { date: d, checkin: { bw: x.lg(d).checkin.bw } } });
  }
  x.bump();
  const stale = x.tdeeOn("2026-12-31");
  a.ok(!stale.measured, "no window has enough calories any more");
  a.equal(stale.w, 0);
  a.equal(stale.tdee, x.tdeePredicted("2026-12-31"), "falls back to the formula, and says so");
  a.match(x.energyCard("2026-12-31"), /the formula only/);
});

test("the weekly check-in asks for measurements once a week and then gets out of the way", () => {
  const x = app({ now: "2026-11-11" });        // a Wednesday
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  Object.assign(x.plan, { sex: "m", height: 70 });
  x.bump();
  const mon = x.mondayOf("2026-11-11");

  // Nothing this week: it asks.
  a.match(x.weeklyCard(), /Weekly check-in/);
  a.match(x.weeklyCard(), /data-bind="meas.waist"/, "the inputs are there");
  a.match(x.weeklyCard(), /first one/);

  // Logged this week: it folds away into a summary you can open.
  x.seed({ [mon]: { date: mon, meas: { neck: 15.5, waist: 34, hip: 40 } } }); x.bump();
  x.openPx.clear();                       // as on a fresh load, days after filling it in
  const done = x.weeklyCard();
  a.match(done, /^<details/, "collapsible once it is done");
  a.ok(!/^<details[^>]* open/.test(done), "and shut by default when it was logged another day");
  a.match(done, /done Mon 11\/9/);
  a.match(done, /% body fat/);
  a.match(done, /Measuring again today records a second set/);

  // Next week it asks again, and shows when the last one was.
  x.setToday("2026-11-18");
  const next = x.weeklyCard();
  a.match(next, /data-bind="meas.waist"/);
  a.match(next, /last Mon 11\/9 · 7 days ago/);

  // It only appears on today, never while looking back at another day.
  x.sel = "2026-11-17";
  a.equal(x.weeklyCard(), "");
  x.sel = "2026-11-18";

  // And the daily check-in no longer carries measurements.
  a.ok(!/data-bind="meas\./.test(x.checkinCard("2026-11-18")), "measurements left the daily card");

  // Without height or sex the measurements still log, they just do not estimate.
  x.plan.height = null; x.bump();
  a.match(x.weeklyCard(), /turn into a body-fat estimate/);
  a.match(x.weeklyCard(), /data-bind="meas.waist"/);
});

test("the lift you pick is the lift, and your max is that lift's max", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const wk = x.weeks().find((w) => w.kind === "cycle" && w.w === 1);
  const mon = wk.monday;
  x.sel = mon;

  // Untouched: the reference lift.
  a.equal(x.varOf("squat", mon), "high");
  a.equal(x.rx(wk, "squat", mon).m.v, 300);

  // Pick front squats and the 300 is read as a front squat max -- no conversion, because
  // that is the lift the block is built on and the number you were asked for.
  x.plan.liftVar = { squat: "front" }; x.bump();
  a.equal(x.liftName("squat", mon), "Front squat");
  const fr = x.rx(wk, "squat", mon);
  a.equal(fr.m.v, 300, "the stored max is used as it stands");
  a.equal(fr.m.src, "base");
  a.equal(fr.w, x.loadFor("squat", 300, fr.p, mon));

  // Deadlifts the same.
  const dd = x.weeks().find((w) => w.kind === "cycle");
  let dday = null;
  for (let i = 0; i < 7; i++) { const d = x.addDays(dd.monday, i); if ((x.dayPlan(d).lifts || []).includes("dead")) { dday = d; break } }
  x.plan.liftVar.dead = "trap"; x.bump();
  a.equal(x.liftName("dead", dday), "Trap bar deadlift");
  a.equal(x.rx(dd, "dead", dday).m.v, 400, "no ratio on the block lift");
});

test("a one-off swap is scaled off the block lift, and only for that session", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.liftVar = { squat: "front" }; x.bump();           // the block runs on front squats
  const wk = x.weeks().find((w) => w.kind === "cycle" && w.w === 1);
  const mon = wk.monday;
  x.sel = mon;

  // One session on the back squat: 300 front squat max is about 300 / 0.85 back squat.
  x.seed({ [mon]: { date: mon, var: { squat: "high" } } }); x.bump();
  const one = x.rx(wk, "squat", mon);
  a.equal(one.m.src, "ratio");
  a.equal(one.m.bv, "front", "scaled from the block lift, not from the reference");
  a.ok(Math.abs(one.m.v - 300 / 0.85) < 0.001);
  a.ok(one.m.v > 300, "a back squat is heavier than the front squat it is derived from");
  a.match(x.liftCard(wk, "squat", x.dayPlan(mon)), /Swapped for this session/);
  a.match(x.liftCard(wk, "squat", x.dayPlan(mon)), /This cycle is built on the front squat/);

  // The next session is back to the block lift.
  const nxt = x.addDays(mon, 2);
  a.equal(x.varOf("squat", nxt), "front");
  a.equal(x.rx(wk, "squat", nxt).m.src, "base");
});

test("a cycle can run a different lift from the one set for later cycles", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.liftVar = { squat: "high" };
  x.plan.cycleVar = { 2: { squat: "front" } };             // cycle 2 only
  x.bump();
  const c1 = x.weeks().find((w) => w.kind === "cycle" && w.cycle === 1);
  const c2 = x.weeks().find((w) => w.kind === "cycle" && w.cycle === 2);
  a.equal(x.blockVar("squat", c1.monday), "high");
  a.equal(x.blockVar("squat", c2.monday), "front");
  a.equal(x.liftName("squat", c2.monday), "Front squat");
  // and each uses that cycle's max as it stands
  a.equal(x.rx(c2, "squat", c2.monday).m.src !== "ratio", true);
});

test("retest and bridge weeks measure the block lift, not a one-off", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = true;
  x.plan.liftVar = { squat: "zercher", dead: "sumo" }; x.bump();

  for (const kind of ["test", "bridge"]) {
    const w = x.weeks().find((ww) => ww.kind === kind);
    if (!w) continue;
    a.equal(x.varOf("squat", w.monday), "zercher", `${kind} week tests the lift you run`);
    a.equal(x.varOf("dead", w.monday), "sumo");
    // a one-off swap does not change what the week exists to measure
    x.seed({ [w.monday]: { date: w.monday, var: { squat: "front" } } }); x.bump();
    a.equal(x.varOf("squat", w.monday), "zercher");
    a.equal(x.rx(w, "squat", w.monday).m.src !== "ratio", true, "and it is not scaled");
  }
});

test("the CSV keeps its columns lined up when variants are in play", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = true;
  x.plan.liftVar = { squat: "front" }; x.bump();
  const wk = x.weeks().find((w) => w.kind === "cycle");
  const mon = wk.monday;
  x.seed({ [mon]: { date: mon, done: true, lifts: { squat: { sets: [true, true, true] } } } });
  const br = x.weeks().find((w) => w.kind === "bridge");
  const t5 = x.addDays(br.monday, 1);
  x.seed({ [t5]: { date: t5, test: { squat: { w: 250, r: 5 } } } });
  x.bump();

  const rows = x.liftsCsv().trim().split("\n").map((l) => l.split(","));
  const head = rows[0], n = head.length;
  for (const r of rows) a.equal(r.length, n, `row has ${r.length} fields, header has ${n}: ${r.join("|")}`);
  const vi = head.indexOf("variant");
  a.ok(vi > 0, "there is a variant column");

  const work = rows.find((r) => r[vi] === "front");
  a.ok(work, "the working row names the variant actually done");
  a.equal(work[head.indexOf("lift")], "Front squat");

  const test = rows.find((r) => r[head.indexOf("kind")] === "5RM test");
  a.equal(test[vi], "high", "the bridge-week test is the block lift, whatever you swapped day to day");
});

test("a variant that no longer exists falls back instead of breaking", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  a.equal(x.VARS.dead.rdl, undefined, "RDL is not a deadlift variant");
  const wk = x.weeks().find((w) => w.kind === "cycle");
  let d = null;
  for (let i = 0; i < 7; i++) { const c = x.addDays(wk.monday, i); if ((x.dayPlan(c).lifts || []).includes("dead")) { d = c; break } }

  x.plan.liftVar = { dead: "rdl" };                       // left over from 1.13
  x.seed({ [d]: { date: d, var: { dead: "rdl" } } }); x.bump();
  a.equal(x.varOf("dead", d), "conv", "it reverts to the reference");
  a.equal(x.rx(wk, "dead", d).m.v, 400, "and the weight is the reference max, not nothing");
  a.equal(x.liftName("dead", d), "Conventional deadlift");

  // every surviving variant with no ratio is one that was asked for by name
  for (const [k, list] of Object.entries(x.VARS))
    for (const [id, v] of Object.entries(list))
      a.ok(v.r > 0, `${k}.${id} is a barbell lift with a ratio to the reference`);
});

test("a derived max is not printed to two decimal places", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.liftVar = { squat: "front" }; x.bump();
  const wk = x.weeks().find((w) => w.kind === "cycle" && w.w === 1), mon = wk.monday;
  x.sel = mon;
  x.seed({ [mon]: { date: mon, var: { squat: "high" } } }); x.bump();
  const card = x.liftCard(wk, "squat", x.dayPlan(mon));
  a.ok(!/Max \d+\.\d\d/.test(card), "no 352.94 in the header");
  a.match(card, /Max 353/);
  a.ok(Math.abs(x.rx(wk, "squat", mon).m.v - 300 / 0.85) < 1e-9, "the maths keeps full precision");
});

test("you can define a lift variant the list does not have", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  a.equal(x.VARS.squat.back, undefined, "no generic back squat alongside high and low bar");
  a.equal(x.varRef("squat"), "high", "high bar is the reference");
  a.ok(x.VARS.squat.ssb, "and the safety squat bar is in the list");

  // A custom variant behaves like any other.
  x.plan.customVar = { squat: [{ id: "cpin", name: "Pin squat", short: "Pin", r: 0.8 }] };
  x.plan.liftVar = { squat: "cpin" }; x.bump();
  const V = x.varsOf("squat");
  a.ok(V.cpin, "it joins the list");
  a.equal(V.cpin.custom, true);
  a.match(V.cpin.note, /80% of the high-bar back squat/, "it explains itself");

  const wk = x.weeks().find((w) => w.kind === "cycle" && w.w === 1), mon = wk.monday;
  x.sel = mon;
  a.equal(x.blockVar("squat", mon), "cpin");
  a.equal(x.liftName("squat", mon), "Pin squat");
  a.equal(x.rx(wk, "squat", mon).m.v, 300, "as the block lift, your max is its max");

  // Swapped for one session against a custom block lift: scaled both ways.
  x.seed({ [mon]: { date: mon, var: { squat: "front" } } }); x.bump();
  const one = x.rx(wk, "squat", mon);
  a.equal(one.m.src, "ratio");
  a.ok(Math.abs(one.m.v - 300 * (0.85 / 0.8)) < 1e-9, "front squat against a pin squat block");

  // Garbage entries are ignored rather than prescribed.
  x.plan.customVar.squat.push({ id: "bad", name: "", r: 0.5 }, { id: "bad2", name: "No ratio", r: 0 });
  x.bump();
  const V2 = x.varsOf("squat");
  a.equal(V2.bad, undefined);
  a.equal(V2.bad2, undefined);

  // Setup offers them, and the Today picker does too.
  a.match(x.vSetup(), /Pin squat/);
  a.match(x.liftCard(wk, "squat", x.dayPlan(mon)), /<option value="cpin"/);
});

test("the weekly check-in can be collapsed, and stays that way", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  Object.assign(x.plan, { sex: "m", height: 70 });
  x.bump();
  const t = "2026-11-11";

  // Nothing logged: the form is a plain card, and it marks itself open for when it fills.
  x.openPx.clear();
  a.match(x.weeklyCard(), /^<div class="card"/);
  a.ok(x.openPx.has("wkmeas"), "so completing it does not snap it shut mid-entry");

  // Filled in today: now a details, open, with the inputs still there to fix a typo.
  x.seed({ [t]: { date: t, meas: { neck: 15.5, waist: 34, hip: 40 } } }); x.bump();
  const open = x.weeklyCard();
  a.match(open, /^<details[^>]* open/, "open on the day you filled it in");
  a.match(open, /data-bind="meas.waist"/, "still editable");
  a.match(open, /data-px="wkmeas"/, "the toggle is remembered like every other details");

  // Collapsing it (what the toggle listener does) keeps it collapsed.
  x.openPx.delete("wkmeas");
  const shut = x.weeklyCard();
  a.match(shut, /^<details/);
  a.ok(!/^<details[^>]* open/.test(shut), "stays shut");
  a.match(shut, /Weekly check-in/, "the summary still says what it holds");
  a.match(shut, /34/, "and the numbers are one tap away");
});

test("minutes can be logged without using the timer", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  let d = null;
  for (const w of x.weeks()) { for (let i = 0; i < 7; i++) { const c = x.addDays(w.monday, i); const p = x.dayPlan(c); if (p.t === "hic" && p.fmt !== "liss") { d = c; break } } if (d) break }
  a.ok(d, "there is a hard conditioning day");
  x.sel = d;
  const dp = x.dayPlan(d);

  // The field is there for every format, not just LISS, with the planned length offered.
  const card = x.hicCard(dp, "");
  a.match(card, /data-bind="hic.min"/, "a minutes field on a MAP session");
  const planned = Math.round(x.ivTotal(x.ivSegments(dp.fmt, x.ivOpts(d, dp.fmt))) / 60);
  a.match(card, new RegExp(`data-act="minplan" data-v="${planned}"`), "and a one-tap way to accept it");
  a.match(card, new RegExp(`Use ${planned} min`));

  // Once logged, the offer goes away and the Status chart counts the real number.
  x.seed({ [d]: { date: d, done: true, hic: { format: dp.fmt, mod: "echo", cal: 120, min: 47 } } }); x.bump();
  a.ok(!/data-act="minplan"/.test(x.hicCard(dp, "")), "no longer asking");
  const row = x.condWeeks(12).find((w) => w.mon === x.mondayOf(d));
  a.equal(row.min, 47, "the logged minutes, not the estimate");
  a.equal(row.est, 0, "and it is not counted as an estimate");
});

test("silent mode never opens an audio channel", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.quietTimer = true; x.plan.voice = true; x.bump();
  a.equal(x.quiet(), true);
  // say() and the beeps all bail out before touching speechSynthesis or an AudioContext
  x.say("test");                     // would throw if it tried: the stub has neither
  x.beep();
  x.tone(880, 0.2);
  x.unlockAudio();
  a.match(x.vSetup(), /Silent timers/);
  a.match(x.vSetup(), /keep my music playing/);

  x.plan.quietTimer = false; x.bump();
  a.equal(x.quiet(), false);
});
