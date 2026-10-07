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

test("the planned length adds up, and says how", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const o = { rounds: 8, warm: true, cool: false, lissMin: 35 };

  // 8 rounds of 1:00 hard / 1:00 easy is 15 minutes, not 16: no easy after the last.
  const p = x.ivParts(x.ivSegments("map", o));
  a.equal(p.rounds, 8);
  a.equal(p.work, 15 * 60, "8 hard + 7 easy");
  a.equal(p.warm, 495, "5:00 plus three 15s pickups with their easy periods");
  a.equal(p.cool, 0);

  const L = x.ivPartsLabel("map", o);
  a.equal(L.total, 23);
  a.equal(L.text, "8 min warm-up + 15 min of intervals");

  // The other formats add up the same way.
  for (const [f, rounds, work] of [["anaerobic", 6, 6 * 30 + 5 * 120], ["threshold", 4, 4 * 240 + 3 * 180], ["long", 5, 5 * 180 + 4 * 90]]) {
    const q = x.ivParts(x.ivSegments(f, { ...o, rounds }));
    a.equal(q.rounds, rounds);
    a.equal(q.work, work, `${f}: ${rounds} hard and ${rounds - 1} easy`);
  }

  // A cool-down is counted separately, and LISS is just its minutes.
  a.equal(x.ivParts(x.ivSegments("map", { ...o, cool: true })).cool, 300);
  a.equal(x.ivPartsLabel("liss", o).text, "35 min steady");

  // And the card explains the arithmetic rather than asserting a number.
  let d = null;
  for (const w of x.weeks()) { for (let i = 0; i < 7; i++) { const c = x.addDays(w.monday, i); const dp = x.dayPlan(c); if (dp.t === "hic" && dp.fmt === "map") { d = c; break } } if (d) break }
  if (d) {
    x.sel = d;
    const card = x.hicCard(x.dayPlan(d), "");
    a.match(card, /min warm-up \+ \d+ min of intervals/);
    a.match(card, /there is no easy period after the last one/);
  }
});

test("a plan change says what it moved", () => {
  const x = app({ now: "2026-10-19" });
  // Set both: with testEvery 2 the retest wins every second cycle and no deload remains.
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.deloadEvery = 2; x.plan.testEvery = 3; x.bump();

  const before = x.milestones();
  a.ok(before.deload && before.test, "there is a deload and a retest ahead");

  // Inserting a week pushes everything after it back.
  const mon = x.mondayOf("2026-10-19");
  x.replan("Deload week added", (p) => { p.inserts[x.addDays(mon, 7)] = "deload" });
  const moved = x.milestoneDiff(before, x.milestones());
  a.match(moved, /retest \d+\/\d+ → \d+\/\d+/, "it names the retest move");
  a.ok(x.undoItem, "and it is undoable");
  a.match(x.undoItem.label, /^Deload week added · /, "the toast carries both");

  // Turning the rule off removes the scheduled deloads and says so. (An explicitly
  // inserted week is not a rule, so it survives -- hence a fresh plan here.)
  const y = app({ now: "2026-10-19" });
  y.plan.startMonday = "2026-09-07"; y.plan.bridge = false;
  y.plan.deloadEvery = 2; y.plan.testEvery = 3; y.bump();
  const b2 = y.milestones();
  y.replan("Deloads off", (p) => { p.deloadEvery = 0 });
  a.match(y.milestoneDiff(b2, y.milestones()), /no deload scheduled now/);

  // A change that moves nothing says nothing extra.
  const b3 = x.milestones();
  x.replan("Rounding changed", (p) => { p.round.squat = 5 });
  a.equal(x.milestoneDiff(b3, x.milestones()), "");
  a.equal(x.undoItem.label, "Rounding changed", "no empty separator on the toast");
});

test("the app notices when conditioning stops rotating", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  a.equal(x.hicRut("2026-11-30", 6), null, "nothing logged, nothing to say");

  // six hard sessions, all MAP on the bike
  const days = [];
  for (const w of x.weeks()) for (let i = 0; i < 7; i++) {
    const d = x.addDays(w.monday, i);
    if (d > "2026-11-30") continue;
    const dp = x.dayPlan(d);
    if (dp.t === "hic" && dp.fmt !== "liss") days.push(d);
  }
  const six = days.slice(-6);
  for (const d of six) x.seed({ [d]: { date: d, done: true, hic: { format: "map", mod: "echo", cal: 120 } } });
  x.bump();
  const rut = x.hicRut("2026-11-30", 6);
  a.ok(rut, "six of the same is a rut");
  a.equal(rut.f, "map");
  a.equal(rut.mod, "echo");

  // vary both the format and the tool and there is nothing to say
  x.seed({ [six[2]]: { date: six[2], done: true, hic: { format: "threshold", mod: "run", dist: 2000 } } }); x.bump();
  a.equal(x.hicRut("2026-11-30", 6), null, "one genuinely different session breaks it");

  // same format but different tools is still fine to flag on the tool
  for (const d of six) x.seed({ [d]: { date: d, done: true, hic: { format: "map", mod: "echo", cal: 120 } } });
  x.seed({ [six[1]]: { date: six[1], done: true, hic: { format: "anaerobic", mod: "echo", cal: 90 } } }); x.bump();
  const r2 = x.hicRut("2026-11-30", 6);
  a.ok(r2 && !r2.f && r2.mod === "echo", "all on the bike, formats mixed");
});

test("a benchmark session is picked, tracked and chased up", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  a.equal(x.benchmark(), null, "nothing to benchmark yet");

  const hard = [];
  for (const w of x.weeks()) for (let i = 0; i < 7; i++) {
    const d = x.addDays(w.monday, i);
    if (d > "2026-11-30") continue;
    const dp = x.dayPlan(d);
    if (dp.t === "hic" && dp.fmt !== "liss") hard.push(d);
  }
  // mostly bike MAP, with a couple of others
  hard.forEach((d, i) => x.seed({ [d]: { date: d, done: true, hic: i % 4 === 3 ? { format: "threshold", mod: "run", dist: 3000 } : { format: "map", mod: "echo", cal: 100 + i } } }));
  x.bump();

  const b = x.benchmark();
  a.deepEqual([b.mod, b.fmt], ["echo", "map"], "the pairing done most often");
  a.equal(b.auto, true);

  const st = x.benchmarkState("2026-11-30");
  a.ok(st.xs.length >= 3);
  a.equal(st.best, Math.max(...st.xs.map((v) => v.v)));
  a.equal(st.due, st.days >= st.every);
  a.match(x.vStatus(), /Benchmark · Echo bike MAP/);

  // An explicit choice wins over the guess.
  x.plan.benchmark = { mod: "ruck", fmt: "long" }; x.bump();
  a.deepEqual([x.benchmark().mod, x.benchmark().fmt], ["ruck", "long"]);
  a.equal(x.benchmarkState("2026-11-30").due, true, "never run, so it is due");
});

test("the pull-up road knows which rung you are on", () => {
  const x = app({ now: "2026-11-30" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  // Nothing logged: it says how to start rather than guessing.
  a.match(x.pullupCard("2026-11-30"), /maps out the road/);
  a.equal(x.pullupState("2026-11-30").stage, 0);

  const rungs = [[0, "Hangs and negatives"], [1, "Band-assisted volume"], [4, "Band-assisted volume"],
                 [5, "Clean reps"], [9, "Clean reps"], [10, "Ready to load"], [15, "Weighted"], [22, "Weighted"]];
  for (const [reps, name] of rungs) {
    x.seed({ "2026-10-05": { date: "2026-10-05", pullups: reps } }); x.bump();
    a.equal(x.pullupState("2026-11-30").st.name, name, `${reps} reps is "${name}"`);
  }

  // It counts the gap to the next rung, from your best set.
  x.seed({ "2026-10-05": { date: "2026-10-05", pullups: 7 } }); x.bump();
  const p = x.pullupState("2026-11-30");
  a.equal(p.reps, 7);
  a.equal(p.next.at, 10);
  a.equal(p.togo, 3);
  a.match(x.pullupCard("2026-11-30"), /3 more reps/);

  // A later, worse set does not demote you: the best stands.
  x.seed({ "2026-11-02": { date: "2026-11-02", pullups: 4 } }); x.bump();
  a.equal(x.pullupState("2026-11-30").reps, 7, "best set, not latest");

  // Added weight shows as a share of bodyweight.
  x.plan.maxes.wpu = 45;
  x.seed({ "2026-11-03": { date: "2026-11-03", checkin: { bw: 200 } } }); x.bump();
  const q = x.pullupState("2026-11-30");
  a.equal(q.wpu, 45);
  a.equal(q.pct, 23);
  a.match(x.pullupCard("2026-11-30"), /23% of bodyweight/);

  // Wednesday's accessory line tells you what the rung means today.
  const wk = x.weeks().find((w) => w.kind === "cycle");
  let wed = null;
  for (let i = 0; i < 7; i++) { const d = x.addDays(wk.monday, i); const dp = x.dayPlan(d); if (dp.t === "lift" && dp.acc === "wed") { wed = d; break } }
  if (wed) {
    x.sel = wed;
    const card = x.accCard(wk, x.dayPlan(wed));
    if (/Pull-up progression/.test(card)) {
      // the rung as it stood on that day, not today's
      const was = x.pullupState(wed).st.work.slice(0, 24);
      a.ok(card.includes(was), `the day's own prescription: ${was}`);
    }
  }
});

test("a day's note matches how many lifts that day actually has", () => {
  const seen = [];
  for (const on of [{ pull: true, ohp: true }, { pull: true, ohp: true, wpu: true }]) {
    const x = app({ now: "2026-10-01" });
    x.plan.startMonday = "2026-09-28"; x.plan.bridge = true; x.plan.l3 = { on }; x.bump();
    const br = x.weeks().find((w) => w.kind === "bridge");
    const sat = x.addDays(br.monday, 5);
    const dp = x.dayPlan(sat);
    a.equal(dp.short, "5RM+Spin");
    seen.push(dp.lifts.length);
    if (dp.lifts.length === 1) {
      a.ok(!/two lifts per day/.test(dp.note), "does not claim two lifts when there is one");
      a.ok(!/Test these/.test(dp.note), "and does not say 'these' about one lift");
      a.match(dp.note, new RegExp(x.liftName(dp.lifts[0], sat).toLowerCase()), "names the lift");
    } else {
      a.match(dp.note, /two lifts per day/);
    }
    a.match(dp.note, /ride easy for 30–40 min/, "the spin is still promised either way");
  }
  a.deepEqual(seen, [1, 2], "two Lift 3 variants leaves one for Saturday, three leaves two");
});

test("every warm-up and mobility movement has an entry, and the Guide lists them all", () => {
  const x = app({});
  // Nothing in the built-in checklists is left without an explanation.
  for (const w of x.WARMUP) a.ok(x.mlibEntry(w.n), `warm-up: ${w.n}`);
  for (const [kind, block] of Object.entries(x.MOB))
    for (const [n] of block.items) a.ok(x.mlibEntry(n), `${kind} mobility: ${n}`);

  // Every entry is complete, and every entry is reachable from the Guide.
  const guide = x.vGuide();
  for (const [id, e] of Object.entries(x.MLIB)) {
    for (const f of ["name", "setup", "exec", "cues", "errors"]) a.ok(e[f], `${id} is missing ${f}`);
    a.ok(guide.includes(`data-px="ml-${id}"`), `${id} is in the Guide`);
  }

  // A row with an entry gets a button that opens the panel; it is closed until asked for.
  x.openPx.clear();
  const shut = x.checkRow("warmup.8", false, "Couch stretch", "45–60 sec per side");
  a.match(shut, /data-act="mlib" data-k="m-warmup-8"/, "a real button, not a label");
  a.match(shut, /aria-expanded="false"/);
  a.ok(!/The pelvic tuck/.test(shut), "the explanation is not rendered yet");
  a.match(shut, /data-act="hold"/, "the hold timer survives");
  a.ok(!/<details/.test(shut), "no native disclosure to race the re-render");

  // Opening it is state, not DOM, so a re-render keeps it open.
  x.openPx.add("m-warmup-8");
  const open = x.checkRow("warmup.8", false, "Couch stretch", "45–60 sec per side");
  a.match(open, /The pelvic tuck is the whole exercise/);
  a.match(open, /aria-expanded="true"/);
  a.match(open, /class="libinfo on"/);

  // Ticking the box must not depend on the panel, and vice versa.
  const ticked = x.checkRow("warmup.8", true, "Couch stretch", "45–60 sec per side");
  a.match(ticked, /checked/);
  a.match(ticked, /The pelvic tuck/, "still open after a tick");

  // A movement the library does not know still renders as a plain row with no button.
  const custom = x.checkRow("mobility.0", true, "Jefferson curl", "3 × 5");
  a.match(custom, /^<div class="crow">/);
  a.ok(!/data-act="mlib"/.test(custom));
  a.match(custom, /checked/);
});

test("new component classes do not collide with the banner modifiers", () => {
  const x = app({});
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "app.css"), "utf8");
  // .banner.info / .warn / .alert are modifiers: a bare rule for one of those names hits
  // every banner on the page. This is how the bridge-week banner became a 22px circle.
  for (const m of ["info", "warn", "alert", "light", "heavy", "mid"]) {
    const bare = new RegExp(`(^|[^.\\\\w-])\\\\.${m}\\\\s*[,{]`, "m");
    a.ok(!bare.test(css), `app.css has a bare .${m} rule, which every banner.${m} inherits`);
  }
  // and the movement button uses its own name
  x.openPx.clear();
  a.match(x.checkRow("warmup.8", false, "Couch stretch", "45 sec"), /class="libinfo"/);
});

test("a FOBBIT counts base time only, and its bursts are reps not seconds", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  const wk1 = x.addDays(x.weeks().find((w) => w.kind === "cycle").monday, 1);
  a.equal(x.easyCondWeek(wk1), false, "an ordinary conditioning week");
  const o = { ...x.ivOpts(wk1, "fobbit"), cool: false };
  a.equal(o.warm, false, "no separate warm-up: the base is the warm-up");
  a.equal(o.rounds, 10, "ten sets, so the base adds up to the standard 20 minutes");
  a.deepEqual(o.reps, [["Swings", "20"], ["Snatches", "10 per arm"]], "prescribed in reps");
  a.equal(o.burst, undefined, "there is no burst duration to pick");

  const segs = x.ivSegments("fobbit", o);
  const base = segs.filter((s) => s.k === "easy"), sets = segs.filter((s) => s.k === "work");
  a.equal(segs[0].l, "Base", "it opens on the base, unlike every other format");
  a.equal(base.length, 10);
  a.equal(sets.length, 10, "one set of reps per base, alternating two movements");
  a.deepEqual(sets.slice(0, 4).map((s) => s.l), ["Swings", "Snatches", "Swings", "Snatches"]);
  a.equal(sets[0].reps, "20");
  a.equal(sets[1].reps, "10 per arm");
  a.ok(sets.every((s) => s.hold), "every set holds the clock until you say it is done");

  // The base is the session. The sets sit on top and are not counted.
  a.equal(base.reduce((t, s) => t + s.s, 0) / 60, 20, "20 minutes of base");
  a.equal(x.ivParts(segs).work / 60, 20, "and that is what the session reports");
  a.equal(x.ivParts(segs).warm, 0);
  a.equal(x.ivPartsLabel("fobbit", o).total, 20);

  // Session length scales by base, and the easy week takes the book's lighter version.
  a.equal(x.ivSegments("fobbit", { ...o, rounds: 7 }).filter((s) => s.k === "easy").reduce((t, s) => t + s.s, 0) / 60, 14);
  a.equal(x.ivSegments("fobbit", { ...o, rounds: 15 }).filter((s) => s.k === "easy").reduce((t, s) => t + s.s, 0) / 60, 30);

  const hw = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "heavy");
  const eo = x.ivOpts(x.addDays(hw.monday, 1), "fobbit");
  a.equal(eo.rounds, 7, "the easy week drops to the 15-minute version");
  a.deepEqual(eo.reps, [["Swings", "10"], ["Snatches", "5 per arm"]], "with the reps halved too");

  // Every other format still opens on work, is timed, and drops the trailing easy period.
  for (const f of ["map", "anaerobic", "threshold", "long"]) {
    const s2 = x.ivSegments(f, { ...x.ivOpts(wk1, f), warm: false, cool: false });
    a.equal(s2[0].k, "work", `${f} still starts hard`);
    a.ok(!s2.some((g) => g.hold), `${f} is timed throughout`);
  }

  // No distance or calorie number: the work is a movement, not a distance.
  a.equal(x.metricFor("echo", "fobbit"), null);
  a.ok(x.metricFor("echo", "map"), "other formats keep theirs");

  // Logged by minutes and sets, and it still counts as a session.
  const d = "2026-09-30";
  x.seed({ [d]: { date: d, done: true, hic: { format: "fobbit", mod: "run", what: "KB swings / snatches", min: 29, rounds: 10 } } });
  x.bump();
  a.equal(x.hicSessions(true).filter((h) => h.f === "fobbit").length, 1);
  a.equal(x.condWeeks(12).find((w) => w.mon === x.mondayOf(d)).min, 29);

  x.sel = wk1;
  x.seed({ [wk1]: { date: wk1, hic: { format: "fobbit", mod: "run" } } }); x.bump();
  const card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
  a.match(card, /20 swings/, "the card names the prescription");
  a.match(card, /10 per arm snatches/);
  a.match(card, /The sets are not on the clock/);
  a.match(card, /data-act="ivopt" data-k="rounds" data-v="10"/, "session length is what you pick");
  a.ok(!/data-k="burst"/.test(card), "the invented burst-seconds picker is gone");
  a.match(card, /Use 20 min/, "the base total, with the clock reading longer");
  a.match(card, /10 × two minutes of base/);
});
test("conditioning eases on the weeks the lifting is heaviest", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  // TB2 puts the easy conditioning week on the wave's 90-95% weeks on purpose.
  const seen = [];
  for (const w of x.weeks().filter((w) => w.kind === "cycle").slice(0, 6)) {
    const d = x.addDays(w.monday, 1), p = +x.wkRx(w).p;
    const easy = x.easyCondWeek(d);
    a.equal(easy, x.tier(p) === "heavy", `week ${w.w} at ${p}%`);
    seen.push([w.w, p, easy, x.ivOpts(d, "fobbit").rounds, x.ivOpts(d, "liss").lissMin]);
  }
  a.deepEqual(seen.filter((r) => r[2]).map((r) => r[0]), [3, 6], "weeks 3 and 6, the 90% and 95% weeks");

  // An easy week means fewer rounds and a shorter steady session.
  const [, , , hardRounds, hardLiss] = seen.find((r) => r[2]);
  const [, , , normRounds, normLiss] = seen.find((r) => !r[2]);
  a.ok(hardRounds < normRounds, `${hardRounds} rounds vs ${normRounds}`);
  a.ok(hardLiss < normLiss, `${hardLiss} min vs ${normLiss}`);

  // And the day says why, so it does not read as a week you let slip.
  const hw = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "heavy");
  let d = null;
  for (let i = 0; i < 7; i++) { const c = x.addDays(hw.monday, i); if (x.dayPlan(c).t === "hic") { d = c; break } }
  a.ok(d, "a heavy week has a conditioning day");
  x.sel = d;
  const card = x.hicCard(x.dayPlan(d), "");
  a.match(card, /Easy conditioning week/);
  a.match(card, /deliberate, not a missed week/);

  // A deload week is not a cycle week, so the rule does not fire there.
  const dl = x.weeks().find((w) => w.kind === "deload");
  if (dl) a.equal(x.easyCondWeek(x.addDays(dl.monday, 1)), false, "deloads are already easy");
});
test("a format with no comparable number cannot be a benchmark", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  // Setup only offers formats that produce a number you can compare.
  const setup = x.vSetup();
  const opts = (setup.match(/data-pbind="benchmark\.fmt">([\s\S]*?)<\/select>/) || [])[1] || "";
  a.ok(opts, "the benchmark format picker exists");
  for (const [k, f] of Object.entries(x.HIC)) {
    const listed = opts.includes(`value="${k}"`);
    if (k === "liss" || f.noMetric) a.ok(!listed, `${k} is not offerable as a benchmark`);
    else a.ok(listed, `${k} is`);
  }

  // A stale pin is ignored rather than left nagging: before, a pinned FOBBIT benchmark
  // showed "never run, due" however many you had done, because it has no result to find.
  const d = "2026-09-30";
  x.seed({ [d]: { date: d, done: true, hic: { format: "fobbit", mod: "run", what: "swings", min: 20, rounds: 6 } } });
  x.plan.benchmark = { mod: "run", fmt: "fobbit" }; x.bump();
  const b = x.benchmark();
  a.ok(!b || b.fmt !== "fobbit", "the pin does not stick");

  // But the session itself still counts everywhere a session should.
  a.equal(x.hicSessions(true).filter((h) => h.f === "fobbit").length, 1);
  a.equal(x.condWeeks(12).find((w) => w.mon === x.mondayOf(d)).min, 20);
  a.ok(x.hicRut(d, 1), "and it counts toward the rotation check");
});

test("the shipped defaults are the book's cadence", () => {
  const x = app();
  // TB1: six-week blocks, retest after two of them, and no deload week anywhere in it.
  a.equal(x.DEF.testEvery, 2, "twelve weeks between retests");
  a.equal(x.DEF.deloadEvery, 0, "no scheduled deload");

  // A fresh plan therefore runs cycles straight into a retest.
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const ws = x.weeks().slice(0, 26);
  a.equal(ws.filter((w) => w.kind === "deload").length, 0, "no deloads turn up on their own");
  const tests = ws.filter((w) => w.kind === "test");
  a.ok(tests.length >= 2, "retests do");
  a.deepEqual(tests.slice(0, 2).map((w) => w.after), [2, 4], "after every second cycle");

  // Twelve weeks of training between them, which is what the book calls optimal.
  const gap = (x.D(tests[1].monday) - x.D(tests[0].monday)) / 864e5 / 7;
  a.equal(gap, 13, "12 training weeks plus the retest week itself");

  // The deload is still there for anyone who wants it, and it is reachable in one tap.
  x.plan.deloadEvery = 2; x.plan.testEvery = 0; x.bump();
  a.ok(x.weeks().slice(0, 20).some((w) => w.kind === "deload"), "still available");

  // And one tap puts it back to the book, with the usual undo.
  x.replan("Set to the book's cadence", (p) => { p.testEvery = 2; p.deloadEvery = 0 });
  a.equal(x.plan.testEvery, 2);
  a.equal(x.plan.deloadEvery, 0);
  a.ok(x.undoItem, "undoable like any plan change");
  a.match(x.vSetup(), /By the book/, "and Setup says so rather than offering the button");
});

test("a wave week can carry an optional set ceiling, which is Operator I/A's volume choice", () => {
  const x = app({ now: "2026-10-05" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const w1 = x.weeks().filter((w) => w.kind === "cycle" && w.w === 1)[0];
  const mon = w1.monday, dp = x.dayPlan(mon);
  a.equal(dp.t, "lift", "week 1 day 1 is a lifting day");

  // Out of the box nothing changes: the wave prescribes three sets and that is all you get.
  a.equal(x.rx(w1, "squat", mon).sMax, x.rx(w1, "squat", mon).s, "no ceiling by default");
  let card = x.liftCard(w1, "squat", dp);
  a.match(card, /<span class="rx">3 × 5 @ 70%/, "a plain count, not a range");
  a.equal((card.match(/data-act="set"/g) || []).length, 3, "three buttons");
  a.ok(!/setb[^"]*\bopt\b/.test(card), "none of them optional");

  // Deadlift has always been a range, and now it says so through rx() like everything else.
  const fri = x.addDays(mon, 4), fdp = x.dayPlan(fri);
  a.ok(fdp.lifts.includes("dead"), "day 3 is the deadlift day");
  const rd = x.rx(w1, "dead", fri);
  a.deepEqual([rd.s, rd.sMax], [1, 3], "one set required, up to three");
  const dcard = x.liftCard(w1, "dead", fdp);
  a.match(dcard, /<span class="rx">1–3 ×/, "shown as a range");
  a.equal((dcard.match(/class="setb opt"/g) || []).length, 2, "sets two and three are optional");

  // Now ask for I/A on week 1: three prescribed, up to ten, the lifter's call on the day.
  x.plan.wave[0].sMax = 10; x.bump();
  const r = x.rx(w1, "squat", mon);
  a.deepEqual([r.s, r.sMax], [3, 10]);
  card = x.liftCard(w1, "squat", dp);
  a.match(card, /<span class="rx">3–10 × 5 @ 70%/);
  a.equal((card.match(/data-act="set"/g) || []).length, 10, "ten buttons");
  a.equal((card.match(/class="setb opt"/g) || []).length, 7, "seven of them dashed");
  a.match(card, /3 sets is the prescription/, "and the card says which are optional");
  a.match(card, /two-minute rest still applies/, "the Golden Rule survives the extra volume");

  // Session mode offers the same ten, and skipping the optional ones is not a gap.
  const work = x.lsSteps(mon).filter((s) => s.type === "work" && s.k === "squat");
  a.equal(work.length, 10, "ten work steps");
  a.deepEqual(work.map((s) => !!s.opt), [false, false, false, true, true, true, true, true, true, true]);

  // A ceiling at or below the prescription is meaningless, so it is ignored.
  x.plan.wave[0].sMax = 2; x.bump();
  a.equal(x.rx(w1, "squat", mon).sMax, 3, "never fewer than the wave asks for");
  x.plan.wave[0].sMax = null; x.bump();
  a.equal(x.rx(w1, "squat", mon).sMax, 3, "and clearing it goes back to a plain three");

  // Setup exposes it per week, blank by default.
  const setup = x.vSetup();
  a.match(setup, /data-pbind="wave\.0\.sMax"/, "an input on the wave table");
  a.match(setup, /Operator I\/A/, "named, so the field is not a mystery");
});

test("a set can be added on the day itself, without going near Setup", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const w1 = x.weeks().filter((w) => w.kind === "cycle" && w.w === 1)[0];
  const mon = w1.monday, dp = x.dayPlan(mon);
  a.equal(mon, "2026-09-07", "today is the day we are rendering");

  // Nothing configured: three sets, and a + tile offering a fourth.
  a.equal(x.rx(w1, "squat", mon).sMax, 3);
  let card = x.liftCard(w1, "squat", dp);
  a.equal((card.match(/data-act="set"/g) || []).length, 3);
  a.match(card, /data-act="addset" data-lift="squat"/, "the + tile is there");
  a.ok(!/data-act="rmset"/.test(card), "nothing to remove yet");

  // Add one. It lands in the day's log, not the plan.
  a.equal(x.addSet("squat", 1, mon), true);
  a.equal(((x.logs[mon].lifts || {}).squat || {}).extra, 1, "stored on the day");
  a.equal(x.plan.wave[0].sMax, undefined, "the program itself is untouched");
  a.deepEqual([x.rx(w1, "squat", mon).s, x.rx(w1, "squat", mon).sMax], [3, 4]);
  card = x.liftCard(w1, "squat", dp);
  a.equal((card.match(/data-act="set"/g) || []).length, 4, "a fourth button");
  a.equal((card.match(/class="setb opt"/g) || []).length, 1, "and it is optional");
  a.match(card, /data-act="rmset"/, "which can be taken back");

  // The next session is unaffected: this was a decision about today.
  a.equal(x.rx(w1, "squat", x.addDays(mon, 2)).sMax, 3, "Wednesday is back to three");

  // The full-screen stepper offers the same fourth set rather than ending at three.
  a.equal(x.lsSteps(mon).filter((s) => s.type === "work" && s.k === "squat").length, 4);

  // A ticked set cannot be pulled out from under its own tick.
  x.seed({ [mon]: { date: mon, lifts: { squat: { extra: 1, sets: [true, true, true, true] } } } }); x.bump();
  a.equal(x.addSet("squat", -1, mon), false, "set four is logged, so it stays");
  a.ok(!/data-act="rmset"/.test(x.liftCard(w1, "squat", dp)), "and the button is not offered");
  x.seed({ [mon]: { date: mon, lifts: { squat: { extra: 1, sets: [true, true, true, false] } } } }); x.bump();
  a.equal(x.addSet("squat", -1, mon), true, "untick it and it can go");
  a.equal(x.rx(w1, "squat", mon).sMax, 3);

  // The + stops at the book\u2019s ten.
  for (let i = 0; i < 20; i++) x.addSet("squat", 1, mon);
  a.equal(x.rx(w1, "squat", mon).sMax, 10, "ten sets per lift is the ceiling");
  a.ok(!/data-act="addset"/.test(x.liftCard(w1, "squat", dp)), "and the + tile goes away");

  // Deadlift keeps its own range and grows from there.
  const fri = x.addDays(mon, 4);
  a.deepEqual([x.rx(w1, "dead", fri).s, x.rx(w1, "dead", fri).sMax], [1, 3]);
  x.addSet("dead", 1, fri);
  a.deepEqual([x.rx(w1, "dead", fri).s, x.rx(w1, "dead", fri).sMax], [1, 4], "a fourth deadlift set");
});

test("the generic timer counts both ways and survives pausing", () => {
  const x = loadApp();
  a.deepEqual([30, 90, 600, 3600, 3725].map(x.gtFmt), ["0:30", "1:30", "10:00", "1:00:00", "1:02:05"]);

  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;                                  // a clock the test can move
  try {
    x.gtStart("down", 120);
    a.equal(x.gtSecs(), 120);
    t += 45000;
    a.equal(x.gtSecs(), 75);

    x.gtPause();
    t += 20000;                                        // 20 s spent paused
    a.equal(x.gtSecs(), 75);                           // frozen, not draining
    x.gtPause();
    a.equal(x.gtSecs(), 75);                           // resumed with nothing lost
    t += 15000;
    a.equal(x.gtSecs(), 60);

    x.gtAdd(30);
    a.equal(x.gtSecs(), 90);
    x.gtAdd(-30);
    a.equal(x.gtSecs(), 60);

    x.gtStart("up");                                   // the stopwatch counts the other way
    a.equal(x.gtSecs(), 0);
    t += 65000;
    a.equal(x.gtSecs(), 65);
    x.gtPause(); t += 30000;
    a.equal(x.gtSecs(), 65);                           // and pauses the same way
    x.gtPause(); t += 5000;
    a.equal(x.gtSecs(), 70);

    x.gtStop();
    a.equal(x.gt, null);
  } finally { Date.now = realNow }
});

test("the screen is held for a whole session, not just while a rest counts", () => {
  const x = loadApp();
  a.equal(x.wantScreen(), false);                      // nothing going on

  x.rest = { k:"squat", end: Date.now() + 60000, dur:60, done:false };
  a.equal(x.wantScreen(), true);
  x.rest.done = true;
  a.equal(x.wantScreen(), false);                      // a finished rest alone doesn't

  x.ls = { date:"2026-10-19", i:0 };                   // but the session it belongs to does
  a.equal(x.wantScreen(), true);
  x.ls = null;
  x.guide = { date:"2026-10-19" };
  a.equal(x.wantScreen(), true);
  x.guide = null;

  x.gt = { mode:"down", end: Date.now() + 60000, dur:60, paused:null, done:false };
  a.equal(x.wantScreen(), true);
  x.gt.paused = Date.now();                            // a paused timer lets it sleep
  a.equal(x.wantScreen(), false);
  x.gt = null;

  x.iv = { done:false };
  a.equal(x.wantScreen(), true);
  x.iv = null;
  x.rest = null;
  a.equal(x.wantScreen(), false);
});

test("trail running and hiking log elevation gain", () => {
  const x = loadApp();
  a.ok(x.MOD.trail, "trail run is an activity");
  a.equal(x.MOD.trail.elev, true);
  a.equal(x.MOD.hike.elev, true);
  a.equal(x.MOD.ruck.elev, true);
  a.ok(!x.MOD.run.elev, "road running doesn't ask for it");
  a.ok(!x.MOD.echo.elev);

  a.equal(x.elevUnit(), "ft");                         // follows the weight unit
  x.plan.unit = "kg"; x.bump();
  a.equal(x.elevUnit(), "m");
  x.plan.unit = "lb"; x.bump();

  x.seed({ "2026-10-17": { date:"2026-10-17", hic:{ mod:"trail", format:"liss", min:70, dist:5, elev:1800 } } });
  const s = x.hicSessions(true).find((e) => e.d === "2026-10-17");
  a.equal(s.mod, "trail");
  a.equal(s.elev, 1800);                               // carried through for history and CSV
  a.deepEqual(x.metricFor("trail", "liss"), ["dist", "mi"]);
  a.deepEqual(x.metricFor("trail", "map"), ["dist", "m"]);
});

test("climbing counts as distance, and ranks sessions by the flat equivalent", () => {
  const x = loadApp();
  a.equal(x.elevPerDist(), 1000);                      // 1,000 ft of gain = 1 mile
  a.equal(x.flatEquiv({ v:5, u:"mi", elev:2000 }), 7);
  a.equal(x.flatEquiv({ v:5, u:"mi", elev:0 }), null); // flat stays flat
  a.equal(x.flatEquiv({ v:400, u:"m", elev:300 }), null, "metres of repeats aren't miles");
  a.equal(x.hicValue({ v:6, u:"mi" }), 6);
  a.equal(x.hicValue({ v:5, u:"mi", elev:2000 }), 7);

  x.plan.unit = "kg"; x.bump();
  a.equal(x.elevPerDist(), 190);
  x.plan.elevPer = { kg: 200 }; x.bump();
  a.equal(x.elevPerDist(), 200);
  x.plan.unit = "lb"; x.bump();

  // the longer flat day wins on raw distance; the climbing day wins once the hills count
  x.seed({
    "2026-10-10": { date:"2026-10-10", hic:{ mod:"trail", format:"liss", dist:6, elev:200 } },
    "2026-10-17": { date:"2026-10-17", hic:{ mod:"trail", format:"liss", dist:5, elev:3000 } },
  });
  const runs = x.hicSessions(true).filter((e) => e.mod === "trail");
  a.deepEqual(runs.map((e) => e.v), [6, 5]);
  a.deepEqual(runs.map(x.hicValue), [6.2, 8]);
  a.equal(x.lastHic("liss", "trail", "2026-10-20").best.d, "2026-10-17");
});

test("sharp pain holds a lift back; a niggle only gets reported", () => {
  const x = loadApp();
  const base = { n:6, grind:0, heavyGrind:0, lightGrind:0, missed:0, rpe:[7,7], sharp:0, niggle:0, where:{} };
  a.equal(x.recommend({ ...base }, 70)[0], "bigger");                      // clean cycle

  a.equal(x.recommend({ ...base, niggle:3 }, 70)[0], "bigger");            // a niggle doesn't move it
  a.ok(x.recommend({ ...base, niggle:3 }, 70)[1].includes("niggle"));      // but it is said out loud

  a.equal(x.recommend({ ...base, sharp:1, where:{ elbow:1 } }, 70)[0], "hold");
  a.ok(x.recommend({ ...base, sharp:1, where:{ elbow:1 } }, 70)[1].includes("elbow"));
  a.equal(x.recommend({ ...base, sharp:2 }, 70)[0], "reduce");
  a.equal(x.recommend({ ...base, n:1, sharp:1 }, 70)[0], "hold", "outranks too-few-sessions");
});

test("Base Building inserts eight weeks and hands back to the cycle after", () => {
  const x = loadApp();
  Object.assign(x.plan.maxes, { squat:300, bench:200, pull:180, ohp:135, dead:400 });
  const mon = "2026-11-16";
  x.plan.inserts[mon] = "bb"; x.bump();

  const L = x.weeks(), i = L.findIndex((w) => w.monday === mon);
  a.equal(L[i - 1].kind, "cycle");
  a.deepEqual(L.slice(i, i + 8).map((w) => w.kind + w.w), ["bb1","bb2","bb3","bb4","bb5","bb6","bb7","bb8"]);
  a.equal(L[i + 8].kind, "cycle");
  a.equal(L[i + 8].cycle, L[i - 1].cycle + 1, "the next cycle, not a repeat");

  // weeks 1-5 have no barbell work; 6-8 bring back two strength days
  const week = (w) => [0,1,2,3,4,5,6].map((d) => x.dayPlan(x.addDays(x.addDays(mon, (w-1)*7), d)).t);
  a.deepEqual(week(1), ["se","hic","hic","se","off","hic","off"]);
  a.deepEqual(week(6), ["lift","hic","off","lift","hic","hic","off"]);
  a.equal(week(1).filter((t) => t === "lift").length, 0);

  const d1 = x.dayPlan(mon);
  a.equal(d1.circuits, 3); a.equal(d1.reps, 20);
  a.equal(x.dayPlan(x.addDays(mon, 3)).circuits, 2);
  a.equal(x.dayPlan(x.addDays(mon, 1)).eMin, 30);                 // E 30M
  a.equal(x.dayPlan(x.addDays(mon, 21 + 1)).eMin, 60);            // week 4 is E 60M

  // the lifting weeks walk up the wave
  a.deepEqual(L.slice(i + 5, i + 8).map((w) => w.rx.p), [70, 80, 90]);

  // strength-first swaps the two
  x.plan.bbVer = { [mon]: "strength" }; x.bump();
  a.deepEqual(week(1), ["lift","hic","hic","lift","off","hic","off"]);
  a.equal(x.dayPlan(x.addDays(mon, 35)).t, "se", "week 6 day 1 is SE now");
  a.equal(x.dayPlan(x.addDays(mon, 35)).reps, 30);
});

test("SE circuits take a cluster, per day or by default", () => {
  const x = loadApp();
  a.equal(x.seCluster("2026-11-16"), "bw");                        // the default
  a.equal(x.seList("bw").length, 6);
  a.ok(x.seList("bar").includes("Front squat"));
  a.deepEqual(x.seList("mine"), []);                               // nothing set yet

  x.plan.se = { cluster:"kb", custom:["Thrusters","Burpees"], rest:45 }; x.bump();
  a.equal(x.seCluster("2026-11-16"), "kb");
  a.equal(x.seRestSecs(), 45);
  a.deepEqual(x.seList("mine"), ["Thrusters","Burpees"]);

  x.seed({ "2026-11-16": { date:"2026-11-16", se:{ cluster:"bar" } } });
  a.equal(x.seCluster("2026-11-16"), "bar", "the day overrides the default");
});

test("an SE day's exercise list can be changed just for that day", () => {
  const x = loadApp();
  const d = "2026-11-16";
  x.plan.inserts[d] = "bb"; x.plan.se = { cluster:"bar", custom:[], rest:60 }; x.bump();

  a.deepEqual(x.seDayList(d), x.seList("bar"));
  a.equal(x.seEdited(d), false);

  // the bar is taken: swap row 2 for a kettlebell movement
  const ex = x.seDayList(d).slice();
  ex[2] = "Swings";
  x.seed({ [d]: { date:d, se:{ cluster:"bar", ex, done:[[true],[true],[true]] } } });
  a.equal(x.seDayList(d)[2], "Swings");
  a.equal(x.seEdited(d), true);
  a.deepEqual(x.seList("bar"), x.seList("bar"), "the cluster itself is untouched");
  a.equal(x.plan.se.cluster, "bar");

  // another day in the same block is unaffected
  a.deepEqual(x.seDayList(x.addDays(d, 3)), x.seList("bar"));

  // the swap list offers movements from every cluster, minus what's already in today's
  const vocab = x.seVocab();
  a.ok(vocab.includes("Swings") && vocab.includes("Push-ups") && vocab.includes("Front squat"));
  a.equal(new Set(vocab).size, vocab.length, "no duplicates");
});

test("stored data carries a schema version, and old shapes are migrated once", () => {
  const x = app({ now: "2026-10-19" });

  // A log written the old way: numeric-keyed objects where arrays belong.
  const d = "2026-10-19";
  x.logs[d] = { date: d, warmup: { 0: true, 1: false }, lifts: { squat: { sets: { 0: true, 1: true }, warmup: { 0: { w: 95, r: 5 } } } } };
  x.programs.old = { id: "old", logs: { "2026-01-05": { date: "2026-01-05", mobility: { 0: true } } } };
  x.plan.schema = 0;
  x.outbox = {}; x.bump();

  a.equal(x.migrate(), true, "there was something to do");
  a.equal(x.plan.schema, x.SCHEMA, "and the plan is stamped with the current version");

  const L = x.logs[d];
  a.ok(Array.isArray(L.warmup), "top-level warm-up flags");
  a.deepEqual(L.warmup, [true, false], "in order, values intact");
  a.ok(Array.isArray(L.lifts.squat.sets), "set ticks");
  a.ok(Array.isArray(L.lifts.squat.warmup), "per-lift warm-up rows");
  a.deepEqual(L.lifts.squat.warmup, [{ w: 95, r: 5 }], "with the row untouched");
  a.ok(Array.isArray(x.programs.old.logs["2026-01-05"].mobility), "archived programs too");

  // Only what changed is sent, and the plan always is (it carries the new stamp).
  a.ok("plan/main" in x.outbox, "the plan is saved");
  a.ok("logs/" + d in x.outbox, "the log it rewrote is saved");

  // Running again is a no-op: no second pass, nothing re-sent.
  x.outbox = {};
  a.equal(x.migrate(), false, "nothing left to do");
  a.deepEqual(Object.keys(x.outbox), [], "and nothing is written");
  a.equal(x.schemaAhead, false);
});

test("a log already in the right shape is not rewritten by a migration", () => {
  const x = app({ now: "2026-10-19" });
  const d = "2026-10-19";
  x.logs[d] = { date: d, lifts: { squat: { sets: [true, true, true] } } };
  x.plan.schema = 0; x.outbox = {}; x.bump();
  x.migrate();
  a.ok(!("logs/" + d in x.outbox), "untouched documents stay untouched");
  a.deepEqual(x.logs[d].lifts.squat.sets, [true, true, true], "and keep their value");
});

test("data from a newer app makes this one read-only instead of overwriting it", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.schema = x.SCHEMA + 1; x.bump();

  a.equal(x.migrate(), false, "there is no forward migration to run");
  a.equal(x.schemaAhead, true, "it knows it is behind");

  // Everything that writes now refuses.
  a.equal(x.readOnly(), true);
  x.outbox = {};
  x.setLog("2026-10-19", "lifts.squat.sets", [true]);
  x.setPlan("bodyweight", 999);
  a.deepEqual(Object.keys(x.outbox), [], "nothing was queued");
  a.notEqual(x.plan.bodyweight, 999, "and the plan in memory is unchanged");

  // And it says why, rather than looking broken.
  const b = x.archiveBanner();
  a.match(b, /out of date/i);
  a.match(b, /data-act="reload"/, "with a way out");
});

test("every migration is numbered in order and matches SCHEMA", () => {
  const x = app({});
  const tos = x.MIGRATIONS.map((m) => m.to);
  a.deepEqual(tos, tos.slice().sort((p, q) => p - q), "in ascending order");
  a.equal(new Set(tos).size, tos.length, "no number used twice");
  a.equal(tos[tos.length - 1], x.SCHEMA, "the last one brings data to SCHEMA");
  a.equal(tos[0], 1, "and they start at 1, since 0 means unversioned");
  for (const m of x.MIGRATIONS) a.ok(m.note && typeof m.run === "function", `migration ${m.to} is complete`);
  a.equal(x.DEF.schema, 0, "a brand new plan starts unversioned and migrates like any other");
});

test("the calendar feed is valid iCalendar that a phone will accept", () => {
  const x = app({ now: "2026-09-14" });   // week 1 inside the feed window
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const t = x.icsFeed();
  const lines = t.split("\r\n");

  a.ok(t.startsWith("BEGIN:VCALENDAR\r\n"), "opens as a calendar");
  a.ok(t.endsWith("END:VCALENDAR\r\n"), "and closes as one");
  a.match(t, /\r\nVERSION:2\.0\r\n/, "RFC 5545 version");
  a.match(t, /\r\nPRODID:/, "and identifies itself");
  a.ok(!/[^\r]\n/.test(t), "every break is CRLF, which strict parsers require");
  a.ok(lines.every((l) => Buffer.byteLength(l, "utf8") <= 75), "no line over 75 octets");

  const open = (t.match(/BEGIN:VEVENT/g) || []).length, close = (t.match(/END:VEVENT/g) || []).length;
  a.equal(open, close, "every event is closed");
  a.ok(open > 50, `a useful horizon, got ${open} events`);
  const uids = t.match(/^UID:.*$/gm);
  a.equal(new Set(uids).size, uids.length, "UIDs are unique, so a refresh updates rather than duplicates");
  a.ok(uids.every((u) => /^UID:ob-\d{4}-\d{2}-\d{2}@/.test(u)), "and stable per day, not random");

  // All-day events, with the end on the following day as the spec requires.
  a.match(t, /DTSTART;VALUE=DATE:20260907\r\nDTEND;VALUE=DATE:20260908\r\n/);
  // Commas and semicolons in a title have to be escaped or the line splits.
  a.match(t, /SUMMARY:Op 1 · Squat\\, Bench\\, Pulldown/);
});

test("the feed carries the weights, and leaves rest days out", () => {
  const x = app({ now: "2026-09-14" });   // week 1 inside the feed window
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  Object.assign(x.plan.maxes, { squat: 315, bench: 225, pull: 180, ohp: 135, dead: 405 });
  x.bump();

  const t = x.icsFeed();
  const got = new Set([...t.matchAll(/^DTSTART;VALUE=DATE:(\d{8})$/gm)].map((m) => m[1]));

  // Week 1 day 1 is a lifting day at 70%: the event says so, with the bar weight on it.
  const mon = "2026-09-07", r = x.rx(x.weeks().find((w) => w.monday === mon), "squat", mon);
  a.equal(r.p, 70);
  a.ok(got.has("20260907"), "the lifting day is in the feed");
  a.ok(t.includes("3 × 5 @ 70%"), "with the prescription");
  a.ok(t.includes(x.n(r.w) + " lb"), `and the working weight (${r.w})`);

  // Sunday is off, and nothing is emitted for it.
  const sun = x.addDays(mon, 6);
  a.equal(x.dayPlan(sun).t, "off", "Sunday is a rest day");
  a.ok(!got.has(sun.replace(/-/g, "")), "so it gets no calendar entry");

  // Every date in the feed is a day the programme actually asks for something.
  for (const d of got) {
    const iso = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6);
    a.ok(!["off", "pre"].includes(x.dayPlan(iso).t), `${iso} is a training day`);
  }
});

test("the feed is only re-uploaded when it actually changes", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  const before = x.icsKey(x.icsFeed());
  a.equal(before, x.icsKey(x.icsFeed()), "generating twice gives the same calendar");
  a.notEqual(x.icsFeed().indexOf("DTSTAMP:"), -1, "even though DTSTAMP is in there");
  a.ok(!before.includes("DTSTAMP:2"), "the comparison key drops it");

  // A change to the plan does change it.
  x.plan.maxes.squat = 400; x.bump();
  a.notEqual(x.icsKey(x.icsFeed()), before, "a new max rewrites the weights");
});
