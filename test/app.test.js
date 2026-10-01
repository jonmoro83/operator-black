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
