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
  // Three cards used to be called some form of "Program", which is why they are now
  // named for what they hold.
  for (const title of ["Maxes", "Programs and archive", "Appearance", "Template and protocol",
    "Start and units", "Lift 3", "Rest alerts", "Spoken cues", "Mobility", "Accessories",
    "Conditioning", "Recovery and nutrition", "The wave", "Cycles, deloads and retests",
    "About this app", "Backups", "Export to a spreadsheet"]) {
    a.ok(h.includes(`<h2>${title}</h2>`), `Setup is missing the "${title}" card`);
  }
  // Grouping must not lose one. Every card ends up inside exactly one section.
  a.equal((h.match(/class="card/g) || []).length, (h.match(/<h2>/g) || []).length,
    "every card still has its heading");
  a.ok(!h.includes("\u0000"), "and no section marker survives into the output");
  const secs = [...h.matchAll(/<summary><b>([^<]*)<\/b><span class="small muted">(\d+) setting/g)];
  a.deepEqual(secs.map((m) => m[1]), ["Program", "Training", "Alerts and sound", "About you", "Your data", "This app"]);
  // Account sits above the sections on purpose: signing out should not be two taps
  // inside a collapsed group. So the section counts are every card but that one.
  a.equal(secs.reduce((n, m) => n + +m[2], 0), (h.match(/<h2>/g) || []).length - 1,
    "the counts on the section headers add up to every card but Account");
  a.ok(h.indexOf('id="account"') < h.indexOf("<details class=\"setup-sec\""), "and it comes first");
  // Program is open on arrival. A screen of six shut drawers is worse than the scroll
  // it replaced, because now you cannot even see what is in there.
  a.match(h, /data-sec="program" open|open data-sec="program"/, "Program starts open");
  a.equal((h.match(/<details class="setup-sec" open/g) || []).length, 1, "and only it does");

  // Setup re-renders on every field change, and a <details> keeps its open state in
  // the DOM. So more than one open section has to be remembered, or typing in a field
  // collapses the others -- the same lesson the mobility panels taught with openPx.
  const openCount = () => (x.vSetup().match(/<details class="setup-sec" open/g) || []).length;
  x.setSetupOpen("training", true);
  a.equal(openCount(), 2, "two can be open at once");
  a.equal(openCount(), 2, "and a re-render does not collapse either");
  x.setSetupOpen("program", false);
  a.equal(openCount(), 1, "closing one closes only that one");
  a.ok(/data-sec="training" open|open data-sec="training"/.test(x.vSetup()), "the right one stayed");

  // And it comes back that way next time the app is opened, which is the only reason
  // to write it down at all.
  const y = app();
  y.dom.store["ob.setupsec"] = JSON.stringify(["training", "you"]);
  y.loaded = true; y.bump();
  const yh = y.vSetup();
  a.equal((yh.match(/<details class="setup-sec" open/g) || []).length, 2, "both are restored");
  for (const k of ["training", "you"]) a.ok(new RegExp(`data-sec="${k}" open|open data-sec="${k}"`).test(yh), k);
  // Rubbish in storage falls back rather than throwing or opening nothing.
  const z = app();
  z.dom.store["ob.setupsec"] = "{not json";
  z.loaded = true; z.bump();
  a.match(z.vSetup(), /data-sec="program" open|open data-sec="program"/, "a bad value falls back to Program");
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
  a.deepEqual(week.map((d) => d.t), ["travel", "hic", "travel", "hic", "travel", "hic", "off"]);
  a.deepEqual(week.map((d) => !!d.plyo), [false, false, false, true, false, false, false],
    "and the plyos sit on their own day, not on a day type of their own");
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
  a.equal(x.dayPlan(thu).plyo, true, "Thursday is the plyo day");
  a.equal(x.dayPlan(thu).t, "hic", "and it is still the week's conditioning day underneath");
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
  // The heaviest set is in History now, with the maxes-by-cycle table it explains.
  a.match(x.vHistory(), /Heaviest set completed/);
  a.ok(!/implies/.test(x.vHistory()), "a prescribed set restates the max, so it claims nothing");

  // Now log a heavier weight than prescribed: that is real evidence.
  const w = x.loadFor("squat", v.m.v, v.p, d) + 20;
  x.seed({ [d]: { date: d, done: true, lifts: { squat: { sets: [true, true, true], used: w } } } }); x.bump();
  const over = x.heavySet("squat");
  a.equal(over.off, true);
  a.equal(over.w, w);
  a.ok(over.e > asRx.e, "a heavier set implies a higher max");
  a.match(x.vHistory(), /implies/);
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
  x.plan.soundMode = "silent"; x.plan.voice = true; x.bump();
  a.equal(x.quiet(), true);
  // say() and the beeps all bail out before touching speechSynthesis or an AudioContext
  x.say("test");                     // would throw if it tried: the stub has neither
  x.beep();
  x.tone(880, 0.2);
  x.unlockAudio();
  a.match(x.vSetup(), /No sound at all/);
  a.match(x.vSetup(), /data-act="soundmode" data-v="silent"[^>]*aria-pressed="true"/);
  a.equal(x.audio.ctxs, 0, "and no audio context was ever created");

  x.plan.soundMode = "duck"; x.bump();
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
  a.deepEqual(o.bouts.map((b) => [b.name, b.reps]), x.FOBBIT.kb.mv, "prescribed in reps, taken from the chosen FOBBIT");
  a.ok(o.bouts.every((b) => b.hold && b.secs == null), "and held, not timed");
  a.equal(o.burst, undefined, "there is no burst duration to pick");

  const segs = x.ivSegments("fobbit", o);
  const base = segs.filter((s) => s.k === "easy"), sets = segs.filter((s) => s.k === "work");
  a.equal(segs[0].l, "Base", "it opens on the base, unlike every other format");
  a.equal(base.length, 10);
  a.equal(sets.length, 10, "one set of reps per base, alternating two movements");
  const [kbA, kbB] = x.FOBBIT.kb.mv;
  a.deepEqual(sets.slice(0, 4).map((s) => s.l), [kbA[0], kbB[0], kbA[0], kbB[0]]);
  a.equal(sets[0].reps, kbA[1]);
  a.equal(sets[1].reps, kbB[1]);
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
  a.equal(eo.mins, 15, "the easy week drops to the 15-minute version");
  a.equal(eo.rounds, 8, "which is eight two-minute blocks, and the card says so rather than rounding it away");
  a.deepEqual(eo.bouts, x.fobBouts("kb", true), "with the reps halved too");
  a.deepEqual(eo.bouts.map((b) => b.reps), [x.halveReps(kbA[1]), x.halveReps(kbB[1])], "and halving only touches the count");

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
  a.match(card, /Kettlebell swing × 20, then kettlebell snatch × 10 \/ arm/, "the card names the prescription");
  a.match(card, /A bout of reps is not on the clock/);
  a.match(card, /data-act="ivopt" data-k="mins" data-v="20"/, "session length is what you pick, in minutes");
  a.ok(!/data-k="burst"/.test(card), "the invented burst-seconds picker is gone");
  a.match(card, /Use 20 min/, "the base total, with the clock reading longer");
  a.match(card, /10 × 2 min of base/);
});
test("the FOBBIT card explains the format in general and the movements only once one is picked", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = x.addDays(x.weeks().find((w) => w.kind === "cycle").monday, 1);
  x.sel = d;

  // Every movement the catalog knows about. None of them may appear in the general blurb.
  const allMoves = Object.values(x.FOBBIT).flatMap((F) => (F.mv || []).map((m) => m[0].toLowerCase()));
  const words = [...new Set(allMoves.flatMap((m) => m.split(/[^a-z-]+/)))].filter((w) => w.length > 3 && w !== "with" && w !== "alternating" && w !== "sides");
  a.ok(words.length > 8, "a real vocabulary to check against");

  const blurbs = new Set(), lines = [];
  for (const id of Object.keys(x.FOBBIT)) {
    x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: id } } }); x.bump();
    const card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
    const blurb = (card.match(/Hold an easy aerobic base[^<]*/) || [""])[0];
    a.ok(blurb, id + " describes the format at all");
    a.match(blurb, /step off it every .* for a bout of work/, "it says how a FOBBIT is structured");
    for (const w of words) a.ok(!blurb.includes(w), `the general blurb must not name "${w}" (on ${id}): ${blurb}`);
    blurbs.add(blurb);
    lines.push([id, (card.match(/<b>([^<]*)<\/b>, between /) || ["", ""])[1], card]);
  }
  // Two things may differ between blurbs, and both are structural: the base interval,
  // and whether there is more than one movement to rotate through. Neither names one.
  const norm = (b) => b.replace(/every .*? for a bout/, "every X for a bout").replace(/ The movements rotate in order\./, "");
  a.equal(new Set([...blurbs].map(norm)).size, 1, "otherwise one description of the format, shared by every FOBBIT");
  a.ok([...blurbs].length > 2, "and the blurbs really do vary, so the check is not vacuous");

  // The named movements follow the selection, and "something else" names none.
  for (const [id, line] of lines) {
    if (!x.fobDef(id)) { a.equal(line, "", "a free-text FOBBIT prescribes nothing"); continue }
    const bouts = x.fobBouts(id, false);
    a.equal(line, x.fobLine(id), id + " prints its own rotation and nobody else's");
    for (const b of bouts) a.ok(line.toLowerCase().includes(b.name.toLowerCase()), `${id} names ${b.name}`);

    // And the timer runs the rotation it just advertised, in order and on a cycle.
    x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: id } } }); x.bump();
    const sets = x.ivSegments("fobbit", x.ivOpts(d, "fobbit")).filter((g) => g.k === "work");
    a.ok(sets.length >= bouts.length * 2, `${id} runs the rotation round at least twice`);
    for (let i = 0; i < bouts.length * 2; i++) {
      const b = bouts[i % bouts.length];
      a.equal(sets[i].l, b.name, `${id} bout ${i + 1} is the one the card named`);
      a.equal(sets[i].reps, b.reps, `${id} bout ${i + 1} carries its own dose`);
    }
  }
  // The bug this all exists to prevent: one FOBBIT's movements showing up under another.
  a.deepEqual(lines.filter(([, l]) => /swing/i.test(l)).map(([id]) => id).sort(), ["kb", "massfob"],
    "only the kettlebell ones mention swings");

  // A FOBBIT with no rotation still gives the timer something to show, and a slash in
  // what you typed is read as two movements, because that is how people write them.
  x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: "other", what: "Sled push / sit-ups" } } }); x.bump();
  const free = x.ivSegments("fobbit", x.ivOpts(d, "fobbit")).filter((g) => g.k === "work");
  a.deepEqual(free.slice(0, 4).map((g) => g.l), ["Sled push", "sit-ups", "Sled push", "sit-ups"]);
  a.equal(free.length, 10, "and still runs the full count");
  x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: "other" } } }); x.bump();
  a.equal(x.ivSegments("fobbit", x.ivOpts(d, "fobbit")).filter((g) => g.k === "work")[0].l, "Burst",
    "and with nothing typed it still has a shape");

  // The card knows how many bouts the session is, so the field says so rather than
  // leaving you to count. A blank here was the bug.
  for (const id of Object.keys(x.FOBBIT)) {
    x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: id } } }); x.bump();
    const card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
    const m = card.match(/Bouts done<input[^>]*placeholder="([^"]*)"/);
    a.ok(m, id + " has a bouts field");
    a.equal(m[1], String(x.ivOpts(d, "fobbit").rounds), id + " suggests the session's bout count");
    a.ok(+m[1] > 0, id + " suggests a real number");
  }

  // The bout count is the number you act on, so it goes where you cannot miss it: the
  // headline, a one-tap fill, and the field's placeholder. Three places, one source.
  for (const id of Object.keys(x.FOBBIT)) {
    x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: id } } }); x.bump();
    const card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
    const n = x.ivOpts(d, "fobbit").rounds;
    a.match(card, new RegExp(`font-size:18px;font-weight:700">${n} bouts · [^<]*of base between<`), id + ": the headline");
    a.match(card, new RegExp(`data-act="boutplan" data-v="${n}">Use ${n} bouts<`), id + ": the one-tap fill");
  }
  // Predator is a lead format too, and gets the same treatment.
  x.seed({ [d]: { date: d, hic: { format: "predator", mod: "run" } } }); x.bump();
  const pc = x.hicCard({ t: "hic", fmt: "predator" }, "");
  a.match(pc, new RegExp(`${x.ivOpts(d, "predator").rounds} bouts · `), "Predator's headline counts bouts");

  // A format that is not base-then-bout keeps its own description and grows no button.
  x.seed({ [d]: { date: d, hic: { format: "map", mod: "run" } } }); x.bump();
  const mc = x.hicCard({ t: "hic", fmt: "map" }, "");
  a.match(mc, new RegExp(`font-size:18px;font-weight:700">${x.HIC.map.sess.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`), "MAP keeps its format line");
  a.ok(!/boutplan/.test(mc), "and has no bouts to suggest");

  // Once you have logged bouts the offer goes away, as the minutes one does.
  x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: "kb", rounds: 8 } } }); x.bump();
  a.ok(!/boutplan/.test(x.hicCard({ t: "hic", fmt: "fobbit" }, "")), "nothing to offer once it is logged");

  // Provenance reads as a sentence. A bare "Ours." under the picker said nothing.
  for (const id of Object.keys(x.FOBBIT)) {
    x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: id } } }); x.bump();
    const card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
    a.ok(!/>(Ours|Tactical Barbell II|Mass Protocol|TB article[^<]*)\.</.test(card),
      id + ": the source must not be a bare label on its own line");
    if (!x.fobDef(id)) { a.ok(!/The shape is the book/.test(card), "nothing to attribute on the free-text one"); continue }
    if (x.FOBBIT[id].src === "ours") a.match(card, /The shape is the book’s; these movements are the app’s own\./, id);
    else a.match(card, new RegExp("From " + x.fobSrcLabel(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\."), id);
  }

  // On the easy week the card shows the halved rotation and says so.
  const hw = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "heavy");
  const ed = x.addDays(hw.monday, 1); x.sel = ed;
  x.seed({ [ed]: { date: ed, hic: { format: "fobbit", mod: "run", fob: "kb" } } }); x.bump();
  const easy = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
  a.match(easy, /<b>Kettlebell swing × 10, then kettlebell snatch × 5 \/ arm<\/b>/, "the halved rotation, not the full one");
  a.match(easy, /Reps are halved today/, "and the card says why the numbers look light");
  a.ok(!/Reps are halved today/.test(lines.find((l) => l[0] === "kb")[2]), "an ordinary week says nothing of the sort");
});
test("a FOBBIT's base interval, rotation length and dose all come from the one you picked", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = x.addDays(x.weeks().find((w) => w.kind === "cycle").monday, 1); x.sel = d;
  const segs = (id) => { x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: id } } }); x.bump();
    const o = x.ivOpts(d, "fobbit"); return { o, segs: x.ivSegments("fobbit", o) } };

  // TB2: two minutes of base, two movements, held reps, and the base is what counts.
  const kb = segs("kb");
  a.equal(kb.o.every, 120); a.equal(kb.o.count, "base");
  a.equal(kb.segs.filter((g) => g.k === "easy")[0].s, 120, "two-minute base blocks");

  // Mod #1: three to five minutes of base, ONE movement, and sized by total time.
  const ms = segs("maxstrength");
  a.equal(ms.o.every, 180, "the timer takes the low end of 3 to 5 minutes");
  a.equal(x.fobEveryLabel("maxstrength"), "3 min to 5 min", "and the prose keeps the range");
  a.equal(ms.o.count, "total", "the Mods measure the whole session, not just the base");
  a.equal(ms.segs.filter((g) => g.k === "easy")[0].s, 180, "and the timer really runs that base");
  a.equal(new Set(ms.segs.filter((g) => g.k === "work").map((g) => g.l)).size, 1, "a single lift, repeated");
  a.ok(ms.segs.filter((g) => g.k === "work").every((g) => g.hold), "a set of three is held, not timed");

  // Mod #3 runs the other way round: the drill is longer than the base, and timed.
  const cb = segs("combat");
  a.equal(cb.o.every, 60, "sixty to ninety seconds of base");
  a.equal(cb.segs.filter((g) => g.k === "easy")[0].s, 60, "and the timer really runs that base");
  const work = cb.segs.filter((g) => g.k === "work");
  a.equal(work[0].s, 120, "two to three minutes of drill");
  a.ok(work[0].s > cb.o.every, "the work is longer than the base, which no other FOBBIT does");
  a.ok(work.every((g) => !g.hold), "a striking round is on the clock");
  a.deepEqual(work.slice(0, 4).map((g) => g.l), ["Heavy bag", "Straight punches", "Shadow boxing", "Heavy bag"],
    "three drills, rotating in order");

  // Mod #2 ships twice: ten reps held, or sixty seconds on the clock.
  const se = segs("se"), am = segs("seamrap");
  a.equal(se.segs.filter((g) => g.k === "work").length % 3, 0, "three movements divide evenly");
  a.ok(se.segs.filter((g) => g.k === "work").every((g) => g.hold && g.reps === "10"));
  a.ok(am.segs.filter((g) => g.k === "work").every((g) => !g.hold && g.s === 60), "the AMRAP version is timed");

  // A held bout is not part of the session; a timed one is. That is the whole difference.
  a.equal(x.ivParts(se.segs).work, se.segs.filter((g) => g.k === "easy").reduce((t, g) => t + g.s, 0),
    "the reps version reports base only");
  a.ok(x.ivParts(am.segs).work > am.segs.filter((g) => g.k === "easy").reduce((t, g) => t + g.s, 0),
    "the AMRAP version counts the bouts too");
});

test("a FOBBIT is sized in minutes, and over thirty of them it stops being a HIC", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = x.addDays(x.weeks().find((w) => w.kind === "cycle").monday, 1); x.sel = d;

  // The rule, in the author's words: over 30 minutes it is an E, under it is a HIC.
  a.equal(x.fobIsE(20), false); a.equal(x.fobIsE(30), false, "thirty exactly is still a HIC");
  a.equal(x.fobIsE(31), true); a.equal(x.fobIsE(60), true);

  // Base-counted: the minutes are base, so rounds are minutes over the interval.
  a.equal(x.fobRounds("kb", 20), 10); a.equal(x.fobRounds("kb", 30), 15);
  // Total-counted: the bouts have to be paid for out of the same minutes, so fewer fit.
  a.ok(x.fobRounds("maxstrength", 30) < Math.round(30 * 60 / 180), "the held sets cost time too");
  a.ok(x.fobRounds("combat", 30) < Math.round(30 * 60 / 60), "and so do the drills");

  // Each FOBBIT offers its own lengths: Mass Protocol refuses to go past twenty.
  a.deepEqual(x.fobMinOpts("massfob"), [15, 20], "fifteen to twenty minutes, no longer");
  a.ok(x.fobMinOpts("maxstrength").every((m) => m >= 30), "and Mod #1 starts where the others stop");

  // Picking a length is picking minutes, and the card says what that makes the session.
  x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: "se" } } }); x.bump();
  a.equal(x.ivOpts(d, "fobbit").mins, 30, "its own default");
  a.equal(x.ivOpts(d, "fobbit").isE, false);
  let card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
  a.match(card, /counts as a HIC/);
  a.match(card, /data-act="ivopt" data-k="mins" data-v="60"/, "and the longer options are there");

  x.setLog(d, "hic.iv.mins", 60); x.bump();
  a.equal(x.ivOpts(d, "fobbit").isE, true);
  card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
  a.match(card, /counts as an E session rather than a HIC/, "and the card says the length changed what it is");

  // Scheduling follows it: a default FOBBIT that is an E is not a hard session, so the
  // rule against two hard conditioning days running does not apply to it.
  a.equal(x.sessHard({ fmt: "liss" }), false);
  a.equal(x.sessHard({ fmt: "map" }), true);
  a.equal(x.sessHard({ fmt: "fobbit" }), true, "the default FOBBIT is twenty minutes");
  x.plan.fobbit = "maxstrength"; x.bump();
  a.equal(x.sessHard({ fmt: "fobbit" }), false, "but Mod #1 is half an hour at least, so it is an E");
  x.plan.fobbit = "kb"; x.bump();

  // And counting what you actually did follows it too.
  a.equal(x.hicWasHard({ f: "fobbit", min: 20 }), true);
  a.equal(x.hicWasHard({ f: "fobbit", min: 45 }), false, "logged long, counted as an E");
  a.equal(x.hicWasHard({ f: "map", min: 45 }), true, "which is a FOBBIT rule, not a length rule");
  a.equal(x.hicWasHard({ f: "liss", min: 20 }), false);

  // A length stored before FOBBITs had their own interval was a count of two-minute
  // rounds, so it has to keep meaning that or old sessions silently change length.
  x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: "kb", iv: { rounds: 15 } } } }); x.bump();
  a.equal(x.ivOpts(d, "fobbit").mins, 30, "fifteen old rounds is thirty minutes");
  a.equal(x.ivOpts(d, "fobbit").rounds, 15, "and it still runs fifteen of them");
});

test("a FOBBIT dosed as a percentage turns into a weight when there is a max on file", () => {
  const x = app({ now: "2026-10-01" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = x.addDays(x.weeks().find((w) => w.kind === "cycle").monday, 1); x.sel = d;
  x.seed({ [d]: { date: d, hic: { format: "fobbit", mod: "run", fob: "maxstrength" } } }); x.bump();

  const b = x.fobBouts("maxstrength", false)[0];
  a.equal(b.reps, "3"); a.deepEqual(b.pct, [70, 75]); a.equal(b.lift, "ohp");
  a.equal(x.doseLabel(b), "3 at 70% to 75%", "the dose reads as a percentage, not a weight");
  a.deepEqual(x.fobBouts("maxstrength", true), x.fobBouts("maxstrength", false),
    "and the easy week does not halve it: three reps at 70% is already light, and the week shortens the session instead");

  // 135 lb press: 70% is 94.5 and 75% is 101.25, both rounded to the nearest 5.
  const card = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
  a.match(card, /at 70–75% of 135: <b>95 to 100 lb<\/b>/, "worked out for you");

  // Without a max it still prescribes the session, it just cannot do the arithmetic.
  x.plan.maxes.ohp = ""; x.bump();
  const bare = x.hicCard({ t: "hic", fmt: "fobbit" }, "");
  a.match(bare, /70–75% of your 1RM/);
  a.match(bare, /Put a 1RM in Setup/);
  a.ok(!/<b>\d+ to \d+ lb<\/b>/.test(bare), "and invents no weight");

  // Nothing else in the catalog is dosed this way, so nothing else grows a load line.
  for (const id of Object.keys(x.FOBBIT)) {
    if (id === "maxstrength") continue;
    a.equal(x.fobLoadLine(x.fobBouts(id, false)), "", id + " has no percentage to resolve");
  }
});

test("halving a FOBBIT's reps touches the count and leaves the units alone", () => {
  const x = app({ now: "2026-10-01" });
  a.equal(x.halveReps("20"), "10");
  a.equal(x.halveReps("10 / arm"), "5 / arm", "the unit survives");
  a.equal(x.halveReps("5"), "3", "odd counts round up");
  a.equal(x.halveReps("1"), "1", "and never reach zero");
  a.equal(x.halveReps("30 m"), "15 m");
  a.equal(x.halveReps("Sled push"), "Sled push", "free text is left alone");
  a.equal(x.halveReps("20 with the 24 kg bell"), "10 with the 24 kg bell", "the load in the unit is not a rep count");
  a.equal(x.halveReps("Max reps in 60 s"), "Max reps in 60 s", "a number that is not the leading count is left alone");
  // Every rep-dosed movement in the catalog halves; timed bouts and percentage sets do
  // not, because an AMRAP is self-limiting and three reps at 70% is already light.
  let halved = 0, left = 0;
  for (const id of Object.keys(x.FOBBIT)) {
    if (!x.fobDef(id)) continue;
    const full = x.fobBouts(id, false), easy = x.fobBouts(id, true);
    a.equal(easy.length, full.length, id + " keeps its rotation");
    for (let i = 0; i < full.length; i++) {
      a.equal(easy[i].name, full[i].name, id + " renames nothing");
      if (full[i].secs != null || full[i].pct) { a.deepEqual(easy[i], full[i], id + " leaves a timed or loaded bout alone"); left++ }
      else { a.equal(easy[i].reps, x.halveReps(full[i].reps), id + " halves its reps"); halved++ }
    }
  }
  a.ok(halved > 10, "plenty of rep doses to halve");
  a.ok(left > 3, "and some that must not be");
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
  x.plan.waves.operator[0].sMax = 10; x.bump();
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
  x.plan.waves.operator[0].sMax = 2; x.bump();
  a.equal(x.rx(w1, "squat", mon).sMax, 3, "never fewer than the wave asks for");
  x.plan.waves.operator[0].sMax = null; x.bump();
  a.equal(x.rx(w1, "squat", mon).sMax, 3, "and clearing it goes back to a plain three");

  // Setup exposes it per week, blank by default.
  const setup = x.vSetup();
  a.match(setup, /data-pbind="waves\.operator\.0\.sMax"/, "an input on the wave table");
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
  a.equal(x.plan.waves.operator[0].sMax, undefined, "the program itself is untouched");
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
  a.deepEqual(x.metricFor("trail", "map"), ["dist", "yd"], "imperial by default in tests");
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

test("the feed is all-day with no reminder until you ask for one", () => {
  const x = app({ now: "2026-09-14" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const t = x.icsFeed();
  a.match(t, /DTSTART;VALUE=DATE:20260907\r\nDTEND;VALUE=DATE:20260908\r\nTRANSP:TRANSPARENT/);
  a.ok(!t.includes("BEGIN:VALARM"), "nothing nags you by default");
  a.ok(!/DTSTART:\d{8}T/.test(t), "and nothing is given a time");
});

test("a usual training time books the session for as long as it takes", () => {
  const x = app({ now: "2026-09-14" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.cal = { mode: "timed", time: "06:00", weekend: "", alarm: null }; x.bump();
  const t = x.icsFeed();
  const ev = (d) => t.split("BEGIN:VEVENT").find((b) => b.includes("DTSTART:" + d)) || "";

  // No Z and no TZID: 06:00 stays 06:00 when you travel instead of shifting.
  a.ok(!/DTSTART:\d{8}T\d{6}Z/.test(t), "times float with the local clock");
  a.ok(!t.includes("TZID"), "so no VTIMEZONE block is needed");
  a.match(t, /TRANSP:OPAQUE/, "a timed session blocks the time out");

  // A lifting day gets 75 minutes.
  a.match(ev("20260907"), /DTSTART:20260907T060000\r\nDTEND:20260907T071500/);
  // Conditioning asks the interval timer, so the calendar and the session card agree.
  const mins = x.ivPartsLabel("map", x.ivOpts("2026-09-08", "map")).total;
  const end = 360 + mins;
  a.match(ev("20260908"), new RegExp("DTEND:20260908T" + String(Math.floor(end / 60)).padStart(2, "0") + String(end % 60).padStart(2, "0") + "00"));
});

test("weekends can run on their own clock, and a late start rolls past midnight", () => {
  const x = app({ now: "2026-09-14" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.cal = { mode: "timed", time: "06:00", weekend: "09:30", alarm: null }; x.bump();
  let t = x.icsFeed();
  a.equal(x.dow("2026-09-12"), 5, "Saturday");
  a.match(t, /DTSTART:20260912T093000/, "Saturday uses the weekend time");
  a.match(t, /DTSTART:20260911T060000/, "Friday does not");

  // Blank weekend box means the same time every day.
  x.plan.cal.weekend = ""; x.bump();
  a.match(x.icsFeed(), /DTSTART:20260912T060000/, "same time at the weekend");

  // 23:30 + 75 min is 00:45 the next morning, and the end date has to say so.
  x.plan.cal.time = "23:30"; x.bump();
  a.match(x.icsFeed(), /DTSTART:20260907T233000\r\nDTEND:20260908T004500/);
});

test("the reminder is whatever you picked, and nonsense falls back to something sane", () => {
  const x = app({ now: "2026-09-14" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.cal = { mode: "timed", time: "06:00", weekend: "", alarm: 30 }; x.bump();
  let t = x.icsFeed();
  const events = (t.match(/BEGIN:VEVENT/g) || []).length;
  a.equal((t.match(/BEGIN:VALARM/g) || []).length, events, "every session carries it");
  a.match(t, /ACTION:DISPLAY\r\nDESCRIPTION:.*\r\nTRIGGER:-PT30M/, "a display alarm, 30 min before");

  for (const [mins, trig] of [[0, "-PT0S"], [60, "-PT1H"], [120, "-PT2H"], [15, "-PT15M"]]) {
    x.plan.cal.alarm = mins; x.bump();
    a.match(x.icsFeed(), new RegExp("TRIGGER:" + trig.replace("-", "\\-")), `${mins} min`);
  }

  // All-day mode offers the evening before, which is 4 hours back from midnight.
  x.plan.cal = { mode: "allday", alarm: 240 }; x.bump();
  a.match(x.icsFeed(), /TRIGGER:-PT4H/);

  // A time the picker could never produce should not produce a broken calendar.
  x.plan.cal = { mode: "timed", time: "nonsense", weekend: "25:99", alarm: null }; x.bump();
  t = x.icsFeed();
  a.match(t, /DTSTART:20260907T060000/, "falls back to 06:00");
  a.ok(t.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75), "and is still valid");
});

test("the records list is built once per change, not once per lookup", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.startMonday = "2026-08-03"; x.plan.bridge = false; x.bump();
  // Two entries: prsOn only reports a record that beat an earlier one, so a lone
  // result is a first, not a personal best.
  const was = "2026-09-21", d = "2026-09-28";
  x.seed({ [was]: { date: was, pullups: 10 }, [d]: { date: d, pullups: 12 } }); x.bump();

  // Building it walks every log several times over. One Today render asks for it eight
  // times -- weekRecap checks each of the week's seven days, then prCard asks again --
  // so without this it was most of the cost of the view.
  const first = x.prList();
  a.equal(x.prList(), first, "the same list comes back, not a rebuilt one");
  a.equal(first.find((r) => r.key === "pullups").value, 12);

  // A log write has to invalidate it, or a new best would not show until a reload.
  x.setLog(d, "pullups", 20);
  const after = x.prList();
  a.notEqual(after, first, "a log write rebuilds it");
  a.equal(after.find((r) => r.key === "pullups").value, 20, "with the new best in it");
  a.equal(x.prList(), after, "and then it is cached again");

  // So does a plan change: records are formatted and rounded off plan settings.
  x.plan.round.squat = 1; x.bump();
  a.notEqual(x.prList(), after, "a plan change rebuilds it too");

  // The thing that reads it still works.
  a.deepEqual(x.prsOn(d).map((r) => r.key), ["pullups"], "and the day's PR is still found");
  a.equal(x.prsOn(was).length, 0, "while the first result it beat is not itself a best");
});

test("a thrown view leaves a banner you can act on, not a blank screen", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  x.render();
  const main = x.dom.made.main;
  a.ok(main.innerHTML.length > 100, "a normal render fills the page");
  a.equal(x.crashList().length, 0, "and records nothing");

  // Break the view the way a real bug would: the rounding table is read for every
  // working weight, and there is no sensible fallback for it.
  const round = x.plan.round;
  Object.defineProperty(x.plan, "round", { get() { throw new Error("no round") }, configurable: true });
  x.bump();
  a.doesNotThrow(() => x.render(), "render swallows it rather than dying halfway");

  a.match(main.innerHTML, /Something went wrong/, "the page says so");
  a.match(main.innerHTML, /data-act="reload"/, "with a way out");
  a.match(main.innerHTML, /data-act="errcopy"/, "and a way to report it");
  a.ok(!/<script/i.test(main.innerHTML), "and nothing unescaped");

  const errs = x.crashList();
  a.equal(errs.length, 1, "the error is kept");
  a.equal(errs[0].where, "render");
  a.ok(errs[0].msg.length > 0, `a message: ${errs[0].msg}`);
  a.ok(errs[0].at.startsWith("20"), "stamped with when");

  // It recovers: fix the cause and the next render is normal again.
  Object.defineProperty(x.plan, "round", { value: round, writable: true, configurable: true });
  x.bump();
  x.render();
  a.ok(!/Something went wrong/.test(main.innerHTML), "back to normal once the cause is gone");
});

test("the last few errors are kept, shown in Setup, and can be copied or cleared", () => {
  const x = app({ now: "2026-10-07" });
  a.equal(x.crashCard(), "", "no card when nothing has gone wrong");

  for (let i = 0; i < x.CRASH_KEEP + 3; i++) x.crashLog(new Error("boom " + i), "test");
  const list = x.crashList();
  a.equal(list.length, x.CRASH_KEEP, "only the last few are kept");
  a.match(list[0].msg, /boom 7$/, "newest first");

  const card = x.crashCard();
  a.match(card, /Problems/);
  a.match(card, /boom 7/, "the newest is on it");
  a.match(card, /never sent anywhere/, "and it says where they go");
  a.match(card, /data-act="errclear"/);
  a.match(x.vSetup(), /Problems/, "it is in Setup");

  const report = x.crashReport();
  a.match(report, /boom 7/);
  a.match(report, /node/, "with the browser, so a report is actionable");

  x.crashClear();
  a.deepEqual(x.crashList(), []);
  a.equal(x.crashCard(), "", "and the card goes away");
});

test("a crash in one view does not take the rest of the app with it", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.waves.operator = [null]; x.bump();
  x.render();
  a.equal(x.crashList().length, 1);

  // The banner is self-sufficient: Copy details works without reaching any other
  // screen, which matters because a plan broken enough to kill Today could kill the
  // screen you would go to for help.
  a.match(x.dom.made.main.innerHTML, /data-act="errcopy"/);
  a.match(x.crashReport(), /wave|null|undefined|read/i, "and the report has something to go on");

  // Setup is the recovery screen, so it has to survive a plan this broken.
  a.doesNotThrow(() => x.vSetup(), "Setup still renders");
  a.match(x.vSetup(), /Problems/, "with the errors on it");
  a.doesNotThrow(() => x.vGuide(), "and an unrelated view is unaffected");
});

test("an implausible number gets a note, and a plausible one does not", () => {
  const x = app({ now: "2026-10-07" });

  // Nothing normal is ever flagged, including genuinely strong or light people.
  for (const [bind, v] of [["bodyweight", 196], ["bodyweight", 95], ["bodyweight", 310],
                           ["maxes.squat", 500], ["maxes.squat", 95], ["checkin.kcal", 3800],
                           ["meas.waist", 31], ["pullups", 25], ["checkin.sleepH", 7.5]]) {
    a.equal(x.oddNote(bind, v), "", `${bind}=${v} is ordinary`);
  }

  // The cases from the roadmap.
  a.match(x.oddNote("bodyweight", 2050), /outside the usual/, "a fat-fingered weigh-in");
  a.match(x.oddNote("maxes.squat", 4000), /outside the usual/, "a 4000 lb squat");
  a.match(x.oddNote("bodyweight", 2050), /60–400/, "and it says what it expected");
  a.match(x.oddNote("bodyweight", 2050), /Kept as typed/, "while making clear it is not a block");

  // Blank is not wrong, it is just blank.
  for (const v of [null, undefined, "", NaN]) a.equal(x.oddNote("bodyweight", v), "", `${v} says nothing`);

  // Fields with no sensible band say nothing rather than guessing.
  a.equal(x.oddNote("hic.cal", 99999), "");
  a.equal(x.oddNote("lifts.squat.warmup.0.w", 9999), "", "ramp rows are left alone");

  // It reaches the real inputs, both kinds.
  a.match(x.numIn("bodyweight", 2050, ""), /oddnote/);
  a.match(x.numIn("bodyweight", 196, ""), /^<input/);
  a.ok(!/oddnote/.test(x.numIn("bodyweight", 196, "")));
});

test("the bands move with the units, so kilograms are not all flagged", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.unit = "kg"; x.bump();
  a.equal(x.u(), "kg");

  a.equal(x.oddNote("bodyweight", 89), "", "89 kg is an ordinary bodyweight");
  a.equal(x.oddNote("maxes.squat", 200), "", "a 200 kg squat is strong, not impossible");
  a.match(x.oddNote("bodyweight", 930), /outside the usual/, "930 kg is not");
  a.match(x.oddNote("bodyweight", 930), /kg/, "and it says so in kilograms");

  // Measurements switch to centimetres with the same treatment.
  a.equal(x.oddNote("meas.waist", 84), "", "84 cm waist");
  a.match(x.oddNote("meas.waist", 400), /cm/);

  x.plan.unit = "lb"; x.bump();
  a.match(x.oddNote("bodyweight", 930), /lb/, "and back again");
});

test("a day changed on two devices at once is noticed, not silently dropped", () => {
  const x = app({ now: "2026-10-07" });
  const d = "2026-10-05";
  a.deepEqual(x.conflicts(), [], "nothing to say by default");

  // This device has an unsent change for that day.
  x.setLog(d, "lifts.squat.sets", [true, true, true]);
  a.equal(x.pending("logs/" + d), true, "it is queued");

  // The server comes back with a different version of the same day: the other device
  // got there first. Ours is kept — that is the rule — but it is now written down.
  x.applyState({ logs: { [d]: { date: d, lifts: { squat: { sets: [true] } } } } });
  a.deepEqual(x.lg(d).lifts.squat.sets, [true, true, true], "this device's version wins");
  const c = x.conflicts();
  a.equal(c.length, 1, "and the clash is recorded");
  a.equal(c[0].path, "logs/" + d);

  // Setup says so, in words.
  const card = x.syncCard();
  a.match(card, /Changes that crossed/);
  a.match(card, /version was kept/);
  a.match(card, /data-act="syncclear"/);
  a.match(x.vSetup(), /Changes that crossed/);

  x.clearConflicts();
  a.deepEqual(x.conflicts(), []);
  a.equal(x.syncCard(), "");
});

test("the same document arriving unchanged is not a clash", () => {
  const x = app({ now: "2026-10-07" });
  const d = "2026-10-05";
  x.setLog(d, "pullups", 12);
  const same = JSON.parse(JSON.stringify(x.lg(d)));

  x.applyState({ logs: { [d]: same } });
  a.deepEqual(x.conflicts(), [], "identical copies are not a disagreement");

  // Nor is a server change to a day this device is not holding.
  x.applyState({ logs: { [d]: same, "2026-10-06": { date: "2026-10-06", pullups: 9 } } });
  a.deepEqual(x.conflicts(), [], "a day we have nothing to say about just arrives");
  a.equal(x.lg("2026-10-06").pullups, 9, "and is taken");
});

test("repeat clashes on one day stay one entry, and the list is capped", () => {
  const x = app({ now: "2026-10-07" });
  const d = "2026-10-05";
  x.setLog(d, "pullups", 12);
  for (let i = 0; i < 3; i++) x.applyState({ logs: { [d]: { date: d, pullups: i } } });
  a.equal(x.conflicts().length, 1, "one day, one entry, however often it polls");

  for (let i = 0; i < x.CONFLICT_KEEP + 4; i++) x.noteConflict("logs/2026-01-" + String((i % 28) + 1).padStart(2, "0"));
  a.equal(x.conflicts().length, x.CONFLICT_KEEP, "and it does not grow forever");
});

test("accessories are slots filled by a choice, not a list of text", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07";

  a.deepEqual(x.accSlots("mon"), ["pchain", "spress", "rdelt", "core", "biceps", "triceps"],
    "a day covers jobs, biggest first");
  a.deepEqual(x.accSlots("fri"), ["sleg", "pchain", "biceps", "triceps", "carry"], "carries last");
  for (const d of ["mon", "wed", "fri"]) {
    a.ok(x.accSlots(d).includes("biceps") && x.accSlots(d).includes("triceps"), `arms on ${d}`);
  }
  // Operator squats three times a week and deadlifts on one of them, so the hamstrings
  // get two days rather than the one they used to.
  a.equal(["mon", "wed", "fri"].filter((d) => x.accSlots(d).includes("pchain")).length, 2);
  a.equal(x.accName(x.accOn(mon, "biceps")), "Barbell curl", "with a sensible default in each");

  // Every slot has something that can fill it, and nothing is tagged to a slot that
  // does not exist.
  for (const s of Object.keys(x.ASLOT)) a.ok(x.accFor(s).length > 0, `${s} has exercises`);
  for (const [id, e] of Object.entries(x.ALIB)) a.ok(x.ASLOT[e.slot], `${id} points at a real slot`);
  for (const [s, id] of Object.entries(x.ACC_DEF)) a.equal(x.ALIB[id].slot, s, `${s}'s default fills it`);

  // The day's list is editable without touching anything logged.
  x.plan.accSlots = { mon: ["hpull", "core"] }; x.bump();
  a.deepEqual(x.accSlots("mon"), ["hpull", "core"]);
  a.ok(!x.accSlots("mon").includes("delts"), "and an edited day is exactly what you set");
  a.deepEqual(x.accSlots("wed"), ["hpull", "delts", "pullup", "biceps", "triceps"], "other days are untouched");
});

test("a swap on the day beats the block, and the block beats the default", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07";
  a.equal(x.accName(x.accOn(mon, "biceps")), "Barbell curl");
  a.equal(x.accSwapped(mon, "biceps"), false);

  // This block runs EZ-bar curls on Monday.
  x.plan.accCycle = { 1: { mon: { biceps: "ezcurl" } } }; x.bump();
  a.equal(x.accName(x.accOn(mon, "biceps")), "EZ-bar curl", "the cycle's pick wins over the default");
  a.equal(x.accSwapped(mon, "biceps"), false, "which is not a swap");

  // The barbell is taken today.
  x.setLog(mon, "acc.ex.biceps", "dbcurl");
  a.equal(x.accName(x.accOn(mon, "biceps")), "Dumbbell curl", "today's choice wins over the block");
  a.equal(x.accSwapped(mon, "biceps"), true, "and is marked as a one-off");

  // Tomorrow is back to the block's choice.
  const nextMon = x.addDays(mon, 7);
  a.equal(x.accName(x.accOn(nextMon, "biceps")), "EZ-bar curl", "the swap was for that session only");

  // A later cycle can run something else again.
  x.plan.accPick = { mon: { biceps: "hammer" } }; x.bump();
  const c2 = x.weeks().find((w) => w.kind === "cycle" && w.cycle === 2);
  a.ok(c2, "there is a second cycle");
  a.equal(x.accName(x.accOn(c2.monday, "biceps")), "Hammer curl", "later cycles start on their own pick");
});

test("accessory work is logged against the slot, with sets, weight and reps", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07";

  a.equal(x.accDone(mon, "spress"), false);
  x.setLog(mon, "acc.sets.spress", [{ w: 95, r: 10 }, { w: 95, r: 9 }]);
  a.deepEqual(x.accSets(mon, "spress"), [{ w: 95, r: 10 }, { w: 95, r: 9 }]);
  a.equal(x.accDone(mon, "spress"), true, "logging a set is the record that you did it");

  // Or just a tick, for work you do not want to count.
  x.setLog(mon, "acc.done.core", true);
  a.equal(x.accDone(mon, "core"), true);
  a.equal(x.accDoneCount(mon, "mon"), 2);

  // Changing the day's slot list does not re-point anything already logged. This is
  // the whole reason for the change: ticks used to be stored by position.
  x.plan.accSlots = { mon: ["core", "biceps", "spress"] }; x.bump();
  a.equal(x.accDone(mon, "spress"), true, "still the horizontal pull");
  a.equal(x.accDone(mon, "biceps"), false, "and biceps did not inherit a tick");
  a.deepEqual(x.accSets(mon, "spress"), [{ w: 95, r: 10 }, { w: 95, r: 9 }], "with its sets intact");
});

test("ticks stored by position are migrated to slots, and old programs still read", () => {
  const x = app({ now: "2026-09-14" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  const mon = "2026-09-07";
  // The old shape: a boolean per position in that day's list. Which slot a position
  // means depends on the list as it stands now, which is the whole reason migration 2
  // pins them once rather than reading them by position forever.
  const slots = x.accSlots("mon");
  x.seed({ [mon]: { date: mon, acc: [true, false, true, false] } });
  x.plan.schema = 1; x.bump();

  a.equal(x.accDone(mon, slots[0]), true, "readable even before migrating");
  a.equal(x.accDone(mon, slots[1]), false);

  a.equal(x.migrate(), true);
  a.equal(x.plan.schema, x.SCHEMA);
  a.deepEqual(x.logs[mon].acc, { done: { [slots[0]]: true, [slots[2]]: true } },
    "pinned to what they meant");
  a.equal(x.accDone(mon, slots[0]), true);
  a.equal(x.accDone(mon, slots[2]), true);

  // And now the list can move without dragging them along.
  x.plan.accSlots = { mon: ["biceps", slots[0]] }; x.bump();
  a.equal(x.accDone(mon, slots[0]), true, "still attached to the job, not the position");
  a.equal(x.accDone(mon, "biceps"), false);
});

test("your own exercises join the catalogue everywhere the built-in ones are", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.accCustom = [{ id: "mine-spider", slot: "biceps", name: "Spider curl", gear: "EZ bar" }];
  x.bump();

  a.ok(x.accFor("biceps").includes("mine-spider"), "it is offered for its job");
  a.equal(x.accName("mine-spider"), "Spider curl");
  a.equal(x.accEx("mine-spider").mine, true, "and is marked as yours");

  x.plan.accPick = { mon: { biceps: "mine-spider" } }; x.bump();
  a.equal(x.accName(x.accOn("2026-09-07", "biceps")), "Spider curl", "and can fill the slot");

  // Rubbish in the list is ignored rather than breaking the picker.
  x.plan.accCustom = [{ id: "x", slot: "nosuchslot", name: "Nope" }, { name: "No id" }, null]; x.bump();
  a.deepEqual(x.accCustom(), [], "nothing malformed gets through");
  a.equal(x.accName(x.accOn("2026-09-07", "biceps")), "Barbell curl", "and a pick that vanished falls back");
});

test("the same job on two days can run different movements", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07", wed = "2026-09-09", fri = "2026-09-11";
  a.equal(x.dayPlan(mon).acc, "mon");
  a.equal(x.dayPlan(wed).acc, "wed");
  a.equal(x.dayPlan(fri).acc, "fri");

  // Arms are on all three Operator days, which is the whole reason the pick is keyed
  // by day: one curl three times a week is a choice, not a default.
  x.plan.accPick = { mon: { biceps: "bbcurl" }, wed: { biceps: "hammer" }, fri: { biceps: "inccurl" } };
  x.bump();
  a.equal(x.accName(x.accOn(mon, "biceps")), "Barbell curl");
  a.equal(x.accName(x.accOn(wed, "biceps")), "Hammer curl");
  a.equal(x.accName(x.accOn(fri, "biceps")), "Incline dumbbell curl");

  // A swap is still only for its own session, and only where it differs.
  x.setLog(wed, "acc.ex.biceps", "hammer");
  a.equal(x.accSwapped(wed, "biceps"), false, "picking what was already set is not a swap");
  x.setLog(wed, "acc.ex.biceps", "dbcurl");
  a.equal(x.accSwapped(wed, "biceps"), true);
  a.equal(x.accName(x.accOn(mon, "biceps")), "Barbell curl", "Monday is unaffected");
});

test("picks made before the per-day change are spread across the days that use them", () => {
  const x = app({ now: "2026-09-14" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  // The 1.53 shape: one exercise per job, with no notion of which day.
  x.plan.accPick = { biceps: "ezcurl", carry: "suitcase" };
  x.plan.accCycle = { 1: { triceps: "dip" } };
  x.plan.schema = 2; x.bump();

  a.equal(x.migrate(), true);
  a.equal(x.plan.schema, x.SCHEMA);

  // Biceps is on all three days, so the choice follows to all three.
  for (const d of ["mon", "wed", "fri"]) a.equal(x.plan.accPick[d].biceps, "ezcurl", `kept on ${d}`);
  // Carry is only on Friday, so it lands there and nowhere else.
  a.equal(x.plan.accPick.fri.carry, "suitcase");
  a.ok(!x.plan.accPick.mon.carry, "and not on a day that has no carry");
  a.equal(x.plan.accCycle[1].mon.triceps, "dip", "the cycle's picks move the same way");

  // Running it again leaves the already-converted shape alone.
  const before = JSON.stringify(x.plan.accPick);
  x.plan.schema = 2; x.bump();
  x.migrate();
  a.equal(JSON.stringify(x.plan.accPick), before, "it is not spread a second time");
});

// A month of identical days, so bodyweight and intake are established rather than
// guessed at. `bw` moves by `drift` pounds a week.
function fed(x, from, { bw = 185, drift = 0, kcal = 3000, macros = null, days = 28 } = {}) {
  const seed = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = x.addDays(from, -i);
    const w = Math.round((bw - (drift / 7) * i) * 10) / 10;
    seed[d] = { checkin: { bw: w, kcal, ...(macros || {}) } };
  }
  x.seed(seed); x.bump();
  return seed;
}

test("the macro target for building is the book's formula, to its own worked example", () => {
  const x = app({ now: "2026-10-15" });
  fed(x, "2026-10-15", { bw: 185 });
  x.plan.goal = "gain"; x.plan.proteinPerLb = 0; x.bump();

  // TB III p.108: bodyweight x 1.3 protein, x 2 carb, half for fat. The book works it
  // through for a 185 lb trainee and gets 240 and 370.
  const t = x.macroTarget("2026-10-15");
  a.equal(t.p, 240); a.equal(t.c, 370); a.equal(t.f, 95);
  a.equal(t.src, "tb3", "and it is the book's, not ours");
  a.equal(t.kcal, 240 * 4 + 370 * 4 + 95 * 9, "calories follow from the grams");
  a.deepEqual([x.MACRO.gain.p, x.MACRO.gain.c, x.MACRO.gain.f], [1.3, 2, 0.5]);

  // A protein setting of your own wins over the book's multiplier; the rest does not move.
  x.plan.proteinPerLb = 1; x.bump();
  const own = x.macroTarget("2026-10-15");
  a.equal(own.p, 185, "your own figure");
  a.equal(own.c, 370, "and the book's for everything else");

  // With nothing logged it uses the Setup figure, which is what everything else that
  // needs a bodyweight already does. With neither, it says so rather than guessing.
  const y = app({ now: "2026-10-15" });
  y.plan.goal = "gain"; y.plan.proteinPerLb = 0; y.plan.bodyweight = 185; y.bump();
  a.equal(y.macroTarget("2026-10-15").p, 240, "the Setup weight will do until one is logged");
  y.plan.bodyweight = null; y.bump();
  a.equal(y.macroTarget("2026-10-15"), null);
  a.match(y.macroCard("2026-10-15"), /Log your bodyweight/);
});

test("losing and holding are the app's own numbers, and say so", () => {
  const x = app({ now: "2026-10-15" });
  fed(x, "2026-10-15", { bw: 185, kcal: 3000 });
  for (const goal of ["lose", "maintain"]) {
    x.plan.goal = goal; x.plan.proteinPerLb = 0; x.bump();
    const t = x.macroTarget("2026-10-15");
    a.ok(t, goal + " has a target once there is a burn to work from");
    a.equal(t.src, "ours", goal + " is not in any of the books");
    // Protein and a fat floor off bodyweight; carbohydrate takes what is left.
    a.equal(t.p, Math.round(185 * x.MACRO[goal].p / 5) * 5);
    a.equal(t.f, Math.round(185 * x.MACRO[goal].f / 5) * 5);
    a.ok(Math.abs(t.kcal - x.kcalTarget("2026-10-15")) <= 30, goal + " splits up the calorie target");
    x.setMacroWhy(true);
    a.match(x.macroCard("2026-10-15"), /so these are ours/, goal + " says whose they are on the card");
    a.match(x.macroCard("2026-10-15"), /<span class="chip ">Ours<\/span>/, goal + " is badged as ours, not as the book's");
    x.setMacroWhy(false);
  }
  // Losing eats less than holding, which is the whole point of the goal setting.
  x.plan.goal = "lose"; x.bump(); const lose = x.macroTarget("2026-10-15");
  x.plan.goal = "maintain"; x.bump(); const hold = x.macroTarget("2026-10-15");
  a.ok(lose.kcal < hold.kcal, "a deficit is a deficit");
});

test("grams belong to the day they were eaten, not the day they were typed", () => {
  const x = app({ now: "2026-10-15" });
  // The check-in asks the morning after, so the 15th's entry is the 14th's eating --
  // the same offset the calories have, and the same trap.
  x.seed({ "2026-10-15": { checkin: { bw: 185, proG: 200, carbG: 300, fatG: 80 } } }); x.bump();
  a.equal(x.macroOn("2026-10-14", "proG"), 200, "attributed to the day before");
  a.equal(x.macroOn("2026-10-15", "proG"), null, "and not to the day it was entered");

  fed(x, "2026-10-15", { bw: 185, macros: { proG: 210, carbG: 320, fatG: 85 } });
  const m = x.macroMean("2026-10-15", 14);
  a.equal(m.p, 210); a.equal(m.c, 320); a.equal(m.f, 85);
  a.equal(m.days, 13, "thirteen of the fortnight have a morning-after entry");
});

test("the 500-calorie step is offered on evidence and applied in the book's ratio", () => {
  const x = app({ now: "2026-10-15" });
  x.plan.goal = "gain"; x.plan.proteinPerLb = 0;

  // Gaining as intended: nothing to say.
  fed(x, "2026-10-15", { bw: 185, drift: 1 });
  a.equal(x.macroAdvice("2026-10-15"), null, "it is working, leave it alone");

  // Flat for a fortnight is the book's trigger.
  fed(x, "2026-10-15", { bw: 185, drift: 0 });
  const adv = x.macroAdvice("2026-10-15");
  a.equal(adv.dir, 1);
  a.match(adv.text, /another 500 calories a day in the same ratio/);
  a.match(x.macroCard("2026-10-15"), /data-act="macrobump" data-v="1"/, "with a button to take it");

  // Applied, it moves every macro in proportion and lands near 500 more.
  const before = x.macroTarget("2026-10-15");
  x.mutatePlan((p) => { p.macroBump = 1 }); x.bump();
  const after = x.macroTarget("2026-10-15");
  // Not exactly 500: grams round to the nearest five, which is the right unit for a
  // food target and costs up to about fifty calories either way on a figure this size.
  a.ok(Math.abs(after.kcal - before.kcal - 500) <= 60, `about five hundred more, got ${after.kcal - before.kcal}`);
  // Every macro moves by the same proportion, which is what "in the same ratio" means.
  // Fat has the most slack because it is the smallest number, so rounding to five
  // grams is a larger share of it.
  const ratio = (k) => after[k] / before[k];
  for (const k of ["p", "c", "f"]) a.ok(ratio(k) > 1, k + " went up");
  a.ok(Math.abs(ratio("p") - ratio("c")) < 0.03, "protein and carbs move together");
  a.ok(Math.abs(ratio("c") - ratio("f")) < 0.06, "and fat with them, within gram rounding");
  a.match(x.macroCard("2026-10-15"), /incl\. \+500/, "and the total says it includes the step");

  // Holding is never nagged, and losing gets our wording rather than the book's.
  x.mutatePlan((p) => { p.macroBump = 0 });
  x.plan.goal = "maintain"; x.bump();
  a.equal(x.macroAdvice("2026-10-15"), null, "holding steady is the goal being met");
  x.plan.goal = "lose"; x.bump();
  a.match(x.macroAdvice("2026-10-15").text, /ours, not the book’s/);

  // One week of readings is noise, not a stall.
  const y = app({ now: "2026-10-15" });
  y.plan.goal = "gain";
  fed(y, "2026-10-15", { bw: 185, drift: 0, days: 5 });
  a.equal(y.macroAdvice("2026-10-15"), null, "not enough history to call it");
});

test("the macro boxes are in the check-in, carrying the target", () => {
  const x = app({ now: "2026-10-15" });
  fed(x, "2026-10-15", { bw: 185 });
  x.plan.goal = "gain"; x.plan.proteinPerLb = 0; x.sel = "2026-10-15"; x.bump();
  const html = x.vToday();
  for (const f of ["proG", "carbG", "fatG"]) a.match(html, new RegExp(`data-bind="checkin\\.${f}"`), f + " has a box");
  // The target is the placeholder, so the box tells you what it is for.
  a.match(html, /data-bind="checkin\.proG"[^>]*placeholder="240"/);
  a.match(html, /data-bind="checkin\.carbG"[^>]*placeholder="370"/);
  a.match(html, /data-bind="checkin\.fatG"[^>]*placeholder="95"/);
});

test("the coach calls the API the way the API is actually shaped", async () => {
  const x = app({ now: "2026-10-15" });
  // The one bug a server-side test cannot see: the client calling its own helper
  // wrongly. api() is api(method, path, body) and the body is an object it stringifies
  // -- getting that wrong produced a POST to /apiundefined with the method "coach".
  // Only the coach's own calls: the app syncs in the background and those land here too.
  const all = [], seen = [];
  global.fetch = (url, init) => {
    const c = { url, method: init.method, body: init.body ? JSON.parse(init.body) : null };
    all.push(c); if (String(url).startsWith("/api/coach")) seen.push(c);
    // A POST answers like the real endpoint, thread and all, or the client's handling
    // of the thread is never actually exercised.
    const body = init.method === "POST"
      ? { id: "t1", thread: "server-thread", answer: "Yes.", suggestions: [], cites: [], used: 1, cap: 300 }
      : { turns: [], thread: null, used: 0, cap: 300, configured: true };
    return Promise.resolve({ ok: true, status: 200, type: "basic", json: async () => body });
  };
  try {
    x.view = "coach"; x.loaded = true; x.render();            // triggers the history load
    await new Promise((r) => setImmediate(r));
    a.equal(seen.length, 1, "the history is fetched once, and from the coach route");
    a.ok(!all.some((c) => String(c.url).includes("undefined")), "no request to a route built from a bad argument");
    a.equal(seen[0].url, "/api/coach", "at the route the Worker serves");
    a.equal(seen[0].method, "GET");

    x.coach.q = "how much protein";
    a.equal(x.coachAsk(), true, "the ask goes out");

    // Checked before the reply lands: the question appears straight away with nothing
    // under it, so a slow answer reads as thinking rather than as nothing happening.
    a.equal(x.coach.q, "", "the box is cleared");
    const pend = x.coach.turns[x.coach.turns.length - 1];
    a.equal(pend.question, "how much protein");
    a.equal(pend.pending, true);
    a.match(x.dom.made.main.innerHTML, /Thinking/);

    await new Promise((r) => setImmediate(r));
    a.ok(!x.coach.turns.some((t) => t.pending), "and the placeholder is replaced by the answer");
    const post = seen[1];
    a.equal(post.url, "/api/coach");
    a.equal(post.method, "POST");
    a.deepEqual(post.body, { q: "how much protein" }, "a real object, stringified once");
    a.ok(!("web" in post.body), "the client no longer decides about searching");

    // A follow-up carries the thread so the server can replay the conversation.
    x.coach.thread = "abc-123"; x.coach.busy = false; x.coach.q = "why?";
    a.equal(x.coachAsk(), true);
    await new Promise((r) => setImmediate(r));
    a.deepEqual(seen[2].body, { q: "why?", thread: "abc-123" });
    await new Promise((r) => setImmediate(r));
    a.strictEqual(x.coach.thread, "server-thread", "the server's thread id is adopted");

    // New topic forgets the thread without touching the server.
    const sentSoFar = seen.length;
    x.coachNew();
    a.strictEqual(x.coach.thread, null, "the thread is dropped, so the next question starts fresh");
    a.deepEqual(x.coach.turns, []);
    a.equal(seen.length, sentSoFar, "and sends nothing");

    // Nothing to ask is not a request.
    const before = seen.length;
    x.coach.q = "   ";
    a.equal(x.coachAsk(), false);
    a.equal(seen.length, before, "and nothing was sent");
  } finally { global.fetch = () => new Promise(() => {}) }
});

test("the Admin tab is in the markup but hidden until the server says you are one", () => {
  const x = app({ now: "2026-10-07" });
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const nav = html.slice(html.indexOf('<nav id="nav"'), html.indexOf("</nav>"));

  a.match(nav, /data-view="admin"[^>]*hidden/, "it ships hidden, not absent");
  a.ok(!/data-act=/.test(nav), "the header navigates by view, never by action");
  const tabs = [...nav.matchAll(/data-view="([a-z]+)"/g)].map((m) => m[1]);
  // Guide is reference rather than a daily destination, so it moved to the account
  // menu to get the tab bar back under a thumb's width.
  a.deepEqual(tabs, ["today", "status", "plan", "history", "setup", "coach", "admin"], "admin is last");
  const acct = html.slice(html.indexOf('id="acct-m"'), html.indexOf('<nav id="nav"'));
  a.match(acct, /data-view="guide"/, "and the Guide is still reachable");

  // Every tab the nav offers has a view behind it.
  x.view = "admin"; x.amAdmin = true; x.loaded = true;
  a.doesNotThrow(() => x.render());
  a.match(x.dom.made.main.innerHTML, /People/, "the admin view renders for an admin");
  a.equal(x.dom.made["nav-admin"].hidden, false, "and the tab is revealed");

  // Not an admin: the tab goes back to hidden on the next render, it does not linger.
  x.amAdmin = false; x.view = "today"; x.render();
  a.equal(x.dom.made["nav-admin"].hidden, true, "and hidden again for anyone else");
});

test("a non-admin who lands on the admin view is put somewhere useful", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();

  // Stored from a previous session, or a different account on the same phone.
  x.view = "admin"; x.amAdmin = false; x.loaded = true;
  x.render();
  a.equal(x.view, "setup", "bounced rather than shown a screen that would only refuse");
  a.ok(!/People/.test(x.dom.made.main.innerHTML));

  // Before the server has answered, nothing is assumed either way: an admin reopening
  // the app should not be thrown off their own tab by a slow network.
  x.view = "admin"; x.amAdmin = false; x.loaded = false;
  x.render();
  a.equal(x.view, "admin", "left alone until we actually know");

  // And Setup no longer carries a second way in, so there is one entry point.
  x.amAdmin = true; x.loaded = true;
  a.ok(!/Open administration/.test(x.vSetup()), "no duplicate entry point in Setup");
});

test("the audit log shows what happened, and can be refreshed after it happens", () => {
  const x = app({ now: "2026-10-07" });
  x.view = "admin"; x.amAdmin = true; x.loaded = true;
  x.admin = { me: "me@example.com", list: [], log: [
    { at: Date.parse("2026-10-07T20:04:59Z"), actor: "me@example.com", action: "export", subject: "them@example.com", detail: "" },
    { at: Date.parse("2026-10-07T20:10:00Z"), actor: "me@example.com", action: "delete", subject: "gone@example.com",
      detail: JSON.stringify({ docs: 11, backups: 3, calendar: true, alerts: true }) },
  ] };

  const h = x.vAdmin();
  a.match(h, /<h2>Audit log<\/h2>/, "named for what it is");
  a.ok(!/What administrators have done/.test(h));

  a.match(h, /Exported<\/b> them@example\.com/, "an export reads as an export");
  a.match(h, /Removed<\/b> gone@example\.com/, "and a removal as a removal");
  a.match(h, /11 documents, 3 backups, calendar feed, alerts/, "with what a removal actually took");
  a.match(h, /by me@example\.com/, "and who did it");

  // The old version loaded once and had no way back; an export is a plain download the
  // app never sees, so a refresh has to be reachable at all times.
  a.match(h, /data-act="adminlog"[^>]*>Refresh/, "refreshable");

  // Nothing logged yet says so, rather than looking broken.
  x.admin = { me: "me@example.com", list: [], log: [] };
  a.match(x.vAdmin(), /Nothing yet/);

  // A server that cannot reach the table says so.
  x.admin = { me: "me@example.com", list: [], log: [], logErr: "No record table. Run npm run db:migrate:remote." };
  a.match(x.vAdmin(), /No record table/);
});

test("an input that survives a re-render has an id, or the caret jumps out of it", () => {
  // render() replaces the whole of #main, and renderMain restores focus and the caret
  // position by looking the element up by id. An input with no id is therefore unusable:
  // every keystroke re-renders, the element is replaced, and focus goes nowhere. That is
  // exactly what the admin confirmation box did.
  const files = fs.readdirSync(path.join(__dirname, "..", "src", "app")).filter((f) => f.endsWith(".js"));
  const src = files.map((f) => fs.readFileSync(path.join(__dirname, "..", "src", "app", f), "utf8")).join("\n");

  // Attributes whose handler calls render(). Keep this list in step with 22-events.js.
  const RERENDERS = ["data-bind", "data-pbind", "data-adminconfirm", "data-accnew", "data-suppnew", "data-cmax", "data-calc"];
  const bad = [];
  for (const tag of src.match(/<(?:input|select|textarea)\b[^>]*>/g) || []) {
    if (!RERENDERS.some((d) => tag.includes(d + "=") || tag.includes(d + " ") || tag.includes(d + ">"))) continue;
    if (!/\sid=/.test(tag)) bad.push(tag.replace(/\s+/g, " ").slice(0, 100));
  }
  a.deepEqual(bad, [], "these re-render on input but cannot be focused again afterwards");
});

test("typing in the admin confirmation keeps the caret, and only one box is ever open", () => {
  const x = app({ now: "2026-10-07" });
  x.view = "admin"; x.amAdmin = true; x.loaded = true;
  x.admin = { me: "me@example.com", log: [], list: [{ user: "them@example.com", docs: 2, logs: 1, bytes: 10, last: Date.now(), backups: 0, backupOk: null }] };

  // The removal confirmation.
  x.admin.confirm = "them@example.com"; x.admin.typed = "them@";
  const clear = x.vAdmin();
  a.match(clear, /id="admin-confirm-clear"[^>]*data-adminconfirm/, "it can be found again after a re-render");
  a.match(clear, /value="them@"/, "and keeps what has been typed so far");

  // The restore confirmation, with its own id so the two never collide.
  x.admin.confirm = null; x.admin.bkFor = "them@example.com";
  x.admin.bk = [{ name: "2026-10-04", logs: 3, bytes: 2048 }];
  x.admin.rsFor = "them@example.com|2026-10-04"; x.admin.typed = "them@ex";
  const rs = x.vAdmin();
  a.match(rs, /id="admin-confirm-restore"[^>]*data-adminconfirm/);
  a.ok(!/admin-confirm-clear/.test(rs), "and the other one is not also on screen");

  // Both ids are distinct wherever they appear, so focus restoration is unambiguous.
  a.equal((rs.match(/id="admin-confirm-restore"/g) || []).length, 1);
});

test("Silent stops the beep, not every way of telling you the rest is over", () => {
  const x = app({ now: "2026-10-07" });
  const buzzes = () => global.navigator.__buzzes;
  buzzes().length = 0;

  // Sound on: it buzzes (and would beep, with an AudioContext to beep through).
  x.plan.soundMode = "duck"; x.bump();
  x.beep();
  a.equal(buzzes().length, 1, "a buzz with sound on");

  // Silent on: still buzzes. Silent exists so iOS does not take the audio session off
  // your music; vibration never touches audio, so there is no reason to suppress it.
  x.plan.soundMode = "silent"; x.bump();
  x.beep();
  a.equal(buzzes().length, 2, "and a buzz with sound off");
  a.deepEqual(buzzes()[1], [200, 100, 200], "the same pattern either way");

  a.equal(x.quiet(), true, "while the sound itself is genuinely off");
});

test("a silenced rest timer says so, and offers one tap to turn sound back on", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.soundMode = "silent"; x.bump();
  x.startRest("squat", "Squat · set 2", 180, "Rest");
  x.showRest();
  a.equal(x.dom.made["rest-quiet"].hidden, false, "the tag is up while Silent is on");

  x.plan.soundMode = "duck"; x.bump();
  x.showRest();
  a.equal(x.dom.made["rest-quiet"].hidden, true, "and gone when it is not");

  // Tapping the tag turns sound back on, and the tag goes with it.
  x.plan.soundMode = "silent"; x.bump();
  x.startRest("squat", "Squat \u00b7 set 2", 180, "Rest");
  x.showRest();
  a.equal(x.dom.made["rest-quiet"].hidden, false);
  x.unquiet();
  a.equal(x.quiet(), false, "sound is back on");
  a.equal(x.quiet(), false);
  a.equal(x.dom.made["rest-quiet"].hidden, true, "and the tag has gone");

  // Setup is honest about what Silent costs on an iPhone.
  x.plan.soundMode = "silent"; x.bump();
  const setup = x.vSetup();
  a.match(setup, /no way to vibrate/i, "it says Safari cannot vibrate");
  a.ok(!/the countdown, the vibration and the screen still work/i.test(setup),
    "and no longer promises vibration as though it were universal");
});

test("session mode walks the accessories one at a time, like the working sets", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  Object.assign(x.plan.maxes, { squat: 315, bench: 225, pull: 180, ohp: 135, dead: 405 });
  x.bump();
  const mon = "2026-09-07";

  const steps = x.lsSteps(mon).filter((s) => s.type === "acc");
  a.deepEqual(steps.map((s) => s.slot), x.accSlots("mon"), "one step per job, in the day's order");
  a.ok(steps.length >= 4, `and there are several: ${steps.length}`);

  // They count towards the session's progress rather than sitting outside it.
  const counted = x.lsSteps(mon).filter((s) => ["warm", "work", "test", "pullups", "acc"].includes(s.type));
  a.ok(counted.length > x.lsSteps(mon).filter((s) => s.type === "work").length, "progress includes them");
});

test("an accessory step logs weight and reps, and knows when it is finished", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07", slot = x.accSlots("mon")[0];
  x.ls = { date: mon, i: 0, warm: false };   // lsStepDone reads the open session's date

  a.equal(x.accDone(mon, slot), false);
  a.equal(x.lsStepDone({ type: "acc", slot }), false, "the stepper agrees it is not done");

  x.setLog(mon, "acc.sets." + slot, [{ w: 40, r: 12 }, { w: 40, r: 10 }]);
  a.equal(x.lsStepDone({ type: "acc", slot }), true, "logging a set finishes it");
  a.deepEqual(x.accSets(mon, slot), [{ w: 40, r: 12 }, { w: 40, r: 10 }]);
});

test("the accessory step offers the swap and the sets, not just a tick", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07";
  x.setLog(mon, "acc.sets.biceps", [{ w: 35, r: 12 }]);
  x.ls = { date: mon, i: 0, warm: false };
  const i = x.lsSteps(mon).findIndex((s) => s.type === "acc" && s.slot === "biceps");
  a.ok(i >= 0, "biceps is a step");
  x.ls.i = i;
  x.lsRender();
  const h = x.dom.made["ls-in"].innerHTML;

  a.match(h, /Biceps/, "it says which job");
  a.match(h, /data-lsaccex="biceps"/, "with a picker to swap today's movement");
  a.match(h, /Barbell curl/, "showing what is currently doing it");
  a.match(h, /data-lsacc="biceps\|0\|w"/, "a weight box");
  a.match(h, /data-lsacc="biceps\|0\|r"/, "and a reps box");
  a.match(h, /value="35"/, "carrying what is already logged");
  a.match(h, /data-ls="accadd"/, "a way to add another set");
  a.match(h, /data-ls="accrest"[^>]*>Rest 90s/, "and a rest timer, defaulting to 90 seconds");

  // Every input in the overlay can be found again, same rule as the main view.
  for (const tag of h.match(/<input\b[^>]*>/g) || []) a.match(tag, /\sid=/, `needs an id: ${tag.slice(0, 80)}`);
});

test("you pick up to three things that matter, and only three", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07";

  a.match(x.aimsCard(mon), /pick up to 3/);
  a.deepEqual(x.aimsOn(mon), []);

  x.setLog(mon, "aims", ["sets", "technique", "mob"]);
  a.equal(x.aimsOn(mon).length, 3);
  a.match(x.aimsCard(mon), /Three is the limit/, "and it says why there is a cap");
  a.match(x.aimsCard(mon), /disabled/, "the rest cannot be added");

  // The cap is enforced where it is decided, not only in the markup.
  x.setLog(mon, "aims", []);
  for (const id of ["sets", "warmup", "technique"]) a.equal(x.pickAim(mon, id), true, id);
  a.equal(x.pickAim(mon, "mob"), false, "a fourth is refused");
  a.deepEqual(x.aimsOn(mon), ["sets", "warmup", "technique"], "and does not sneak in");
  a.equal(x.pickAim(mon, "warmup"), true, "but you can always drop one");
  a.deepEqual(x.aimsOn(mon), ["sets", "technique"]);
  a.equal(x.pickAim(mon, "nosuchaim"), false, "and an unknown id is not an aim");

  // Rating only takes the three answers it offers, and tapping again clears it.
  x.rateAim(mon, "technique", "part");
  a.equal(x.aimRating(mon, "technique"), "part");
  x.rateAim(mon, "technique", "nonsense");
  a.equal(x.aimRating(mon, "technique"), "part", "rubbish is ignored");
  x.rateAim(mon, "technique", "part");
  a.equal(x.aimRating(mon, "technique"), null, "tapping the same one clears it");

  x.setLog(mon, "aims", ["sets", "technique", "mob"]);
  // Rubbish in the stored list is ignored rather than rendering a blank row.
  x.setLog(mon, "aims", ["sets", "nosuchaim", null]);
  a.deepEqual(x.aimsOn(mon), ["sets"]);

  // Every aim is either scorable or self-rated, and all have a label.
  for (const aim of [...x.AIMS_LIFT, ...x.AIMS_COND]) {
    a.ok(aim.id && aim.label, "an aim needs both");
    a.ok(aim.check === undefined || typeof aim.check === "function");
  }
  a.equal(x.AIM_MAX, 3);

  // Rest days are not something you set an aim for.
  const sun = x.addDays(mon, 6);
  a.equal(x.dayPlan(sun).t, "off");
  a.equal(x.aimsCard(sun), "");
});

test("the report scores what it can see and asks about what it cannot", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  Object.assign(x.plan.maxes, { squat: 315, bench: 225, pull: 180, ohp: 135, dead: 405 });
  x.bump();
  const mon = "2026-09-07";

  x.setLog(mon, "aims", ["sets", "short", "technique"]);
  x.setLog(mon, "done", true);
  const wk = x.weekOf(mon), need = x.rx(wk, "squat", mon).s;
  x.setLog(mon, "lifts.squat.sets", Array(need).fill(true));
  x.setLog(mon, "lifts.bench.grinder", true);

  const h = x.aimsCard(mon);
  a.match(h, /How it went/, "it becomes the report once the day is done");
  a.match(h, /of \d+\./, "the sets aim is counted, not asked about");
  a.match(h, /✗ Stop short of failure/, "a grinder fails that aim");
  a.match(h, /Bench.*ground/, "and names what ground");
  a.match(h, /data-act="aimrate" data-id="technique"/, "technique asks you, because nothing logged can tell it");
  a.ok(!/data-act="aimrate" data-id="sets"/.test(h), "and what can be counted is never asked");

  // Your note, with the reason for writing it.
  a.match(h, /data-bind="notes"/);
  a.match(h, /shown to you before your next/i);
});

test("a note written after one session greets you before the next comparable one", () => {
  const x = app({ now: "2026-09-09" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-09-07", tue = "2026-09-08", wed = "2026-09-09";
  a.equal(x.dayPlan(mon).t, "lift");
  a.equal(x.dayPlan(wed).t, "lift");

  x.seed({
    [mon]: { date: mon, done: true, notes: "Left hip tight on squats." },
    [tue]: { date: tue, done: true, notes: "Bike felt easy." },
  });
  x.bump();

  const n = x.lastNote(wed);
  a.equal(n.date, mon, "the last lifting note, not yesterday's bike session");
  a.equal(n.same, true);
  a.match(x.noteCard(wed), /Left hip tight on squats/);
  a.match(x.noteCard(wed), /From your last Op 1/i, "labelled with where it came from");

  // Dismissed, and it stays dismissed.
  x.setLog(wed, "noteSeen", true);
  a.equal(x.noteCard(wed), "");

  // Once the session is done the note is history, not a prompt.
  x.setLog(wed, "noteSeen", null); x.setLog(wed, "done", true);
  a.equal(x.noteCard(wed), "");

  // With no comparable session it falls back to the most recent of any kind.
  const x2 = app({ now: "2026-09-08" });
  x2.plan.startMonday = "2026-09-07"; x2.plan.bridge = false;
  x2.seed({ [mon]: { date: mon, done: true, notes: "Only note there is." } }); x2.bump();
  const n2 = x2.lastNote(tue);
  a.equal(n2.date, mon);
  a.equal(n2.same, false, "and says it is not a like-for-like");
});

test("a focus that keeps slipping is pointed out, once there is a pattern", () => {
  const x = app({ now: "2026-09-21" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = (n) => x.addDays("2026-09-07", n);

  // One bad session is not a pattern.
  x.seed({ [d(0)]: { date: d(0), done: true, aims: ["technique"], aimsRated: { technique: "no" } } });
  x.bump();
  a.equal(x.aimPattern(d(14), "technique"), "", "one is nothing");

  // Two out of three is.
  x.seed({
    [d(2)]: { date: d(2), done: true, aims: ["technique"], aimsRated: { technique: "yes" } },
    [d(4)]: { date: d(4), done: true, aims: ["technique"], aimsRated: { technique: "part" } },
  });
  x.bump();
  const p = x.aimPattern(d(14), "technique");
  a.match(p, /sessions running/);
  a.match(p, /the weight, not the focus/, "with the advice that fits that aim");

  // It only looks at sessions where the aim was actually picked and rated.
  a.equal(x.aimPattern(d(14), "unhurried"), "", "nothing to say about one you never chose");
});

test("hill sprints are an activity of their own, with elevation and a warm-up", () => {
  const x = app({ now: "2026-10-08" });
  const m = x.MOD.hill;
  a.ok(m, "it exists");
  a.equal(m.name, "Hill sprints");
  a.equal(m.elev, true, "elevation counts, as it does for trail, ruck and hike");
  a.ok(m.wu && m.tip, "with a warm-up and the thing worth knowing");

  // Distance on a hard day; nothing to measure on an easy one, so it asks for minutes
  // instead of inventing a number, exactly as Other does.
  a.deepEqual(x.metricFor("hill", "map"), ["dist", "yd"]);
  a.equal(x.metricFor("hill", "liss"), null);
  a.equal(x.metricFor("other", "liss"), null, "the same shape that already works");

  // It is offered wherever the other activities are.
  const setup = x.vSetup();
  a.match(setup, /<option value="hill"[^>]*>Hill sprints/, "as a default activity");
  a.match(setup, /value="hill"/, "and as a benchmark activity");

  // Every activity is well formed, hill included.
  for (const [k, v] of Object.entries(x.MOD)) {
    a.ok(v.name, `${k} has a name`);
    for (const f of ["hic", "liss"]) {
      a.ok(v[f] === null || v[f] === undefined || (Array.isArray(v[f]) && v[f].length === 2), `${k}.${f} is a metric or nothing`);
    }
  }
});

test("a hill sprint session logs and reads back like any other", () => {
  const x = app({ now: "2026-10-08" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  // Find a hard conditioning day and run it on the hill.
  const d = [...Array(14)].map((_, i) => x.addDays("2026-09-28", i)).find((dd) => {
    const p = x.dayPlan(dd); return p && p.fmt && p.fmt !== "liss";
  });
  a.ok(d, "there is a hard conditioning day");

  x.seed({ [d]: { date: d, hic: { mod: "hill", format: x.dayPlan(d).fmt, dist: 900, elev: 120, min: 28 } } });
  x.bump();
  a.equal(x.modOf(d), "hill", "the day knows what it was done on");
  const sess = x.hicSessions(true).find((s) => s.d === d);
  a.ok(sess, "it shows up as a logged session");
  a.equal(sess.mod, "hill");
  a.equal(sess.v, 900, "with its distance");
  a.equal(sess.elev, 120, "and its climb");
});

test("a distance you measure yourself follows the units you chose", () => {
  const x = app({ now: "2026-10-08" });
  const unit = (mod, fmt) => { const m = x.metricFor(mod, fmt); return m ? m[1] : null };

  x.plan.unit = "lb"; x.bump();
  for (const mod of ["run", "trail", "hill"]) a.equal(unit(mod, "map"), "yd", `${mod} on imperial`);
  for (const mod of ["run", "trail", "ruck", "hike"]) a.equal(unit(mod, "liss"), "mi", `${mod} LISS on imperial`);

  x.plan.unit = "kg"; x.bump();
  for (const mod of ["run", "trail", "hill"]) a.equal(unit(mod, "map"), "m", `${mod} on metric`);
  for (const mod of ["run", "trail", "ruck", "hike"]) a.equal(unit(mod, "liss"), "km", `${mod} LISS on metric`);

  // Elevation already followed the setting; distance now matches it.
  x.plan.unit = "lb"; x.bump(); a.equal(x.elevUnit(), "ft");
  x.plan.unit = "kg"; x.bump(); a.equal(x.elevUnit(), "m");

  // Some units are not a preference. The ergs read metres on their own displays and a
  // pool is measured in metres, whatever you have the app set to. `fixedUnit` says so.
  for (const unitSet of ["lb", "kg"]) {
    x.plan.unit = unitSet; x.bump();
    a.equal(unit("rower", "liss"), "m", `rower stays metres on ${unitSet}`);
    a.equal(unit("ski", "liss"), "m", `ski erg stays metres on ${unitSet}`);
    a.equal(unit("swim", "liss"), "m", `swimming stays metres on ${unitSet}`);
    a.equal(unit("swim", "map"), "m", `swim intervals too, on ${unitSet}`);
  }

  // The conversion works from either side, so a new activity can be declared in
  // whichever unit is natural to write and still follow the setting. Nothing in MOD is
  // currently declared in metric, so without this the imperial half is never exercised.
  x.MOD.__probe = { name: "Probe", hic: ["dist", "m"], liss: ["dist", "km"] };
  try {
    x.plan.unit = "lb"; x.bump();
    a.equal(unit("__probe", "map"), "yd", "metres declared, yards shown on imperial");
    a.equal(unit("__probe", "liss"), "mi", "and kilometres become miles");
    x.plan.unit = "kg"; x.bump();
    a.equal(unit("__probe", "map"), "m", "unchanged on metric");
    a.equal(unit("__probe", "liss"), "km");

    x.MOD.__probe.fixedUnit = true;
    x.plan.unit = "lb"; x.bump();
    a.equal(unit("__probe", "map"), "m", "and fixedUnit pins it whichever way it is declared");
  } finally { delete x.MOD.__probe }

  // Every distance is either pinned by fixedUnit or declared so the setting reaches it.
  // Without this, the next activity added could quietly be stuck in one system.
  for (const [k, v] of Object.entries(x.MOD)) {
    for (const f of ["hic", "liss"]) {
      if (!v[f] || v[f][0] !== "dist") continue;
      if (v.fixedUnit) { a.equal(v[f][1], "m", `${k}.${f} is pinned, so it should be metres`); continue }
      a.ok(["mi", "yd"].includes(v[f][1]), `${k}.${f} must be declared imperial to convert, got ${v[f][1]}`);
    }
  }
});

test("two strength-endurance circuits may be put together, and the app says so", () => {
  const x = app({ now: "2026-10-08" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.inserts = { "2026-10-12": "bb" }; x.bump();
  const bb = x.weeks(30).find((w) => w.kind === "bb");
  a.ok(bb, "a Base Building block is scheduled");

  // Block I's own week still spreads them: three days between the two circuits.
  const kinds = [...Array(7)].map((_, i) => x.sessKind(x.dayPlan(x.addDays(bb.monday, i))));
  a.equal(kinds.filter((k) => k === "se").length, 2, "two circuits");
  a.ok(!kinds.some((k, i) => i && k === "se" && kinds[i - 1] === "se"), "not next to each other by default");

  // But putting them together is allowed. TB II's guidelines for Block I are weekly
  // counts and a rest day -- "2-3 Strength-Endurance circuits per week", "Rest
  // completely at least one day per week" -- and say nothing about which days.
  const bad = [0, 3, 1, 2, 4, 5, 6];
  a.equal(x.sessKind(x.dayPlanSlot(bb.monday, bad[0])), "se");
  a.equal(x.sessKind(x.dayPlanSlot(bb.monday, bad[1])), "se", "now back to back");
  a.deepEqual(x.orderIssues(bb.monday, bad), [], "which is not a clash");
  // It is still worth remarking on, which is a different thing from refusing it.
  const near = x.orderCrowding(bb.monday, bad);
  a.ok(near.some((i) => i.kind === "se"), `reported as crowding: ${JSON.stringify(near)}`);
  a.equal(x.kindName("se"), "strength-endurance", "and named in words");
});
test("a retest splits the cluster across two days once it is bigger than a pair", () => {
  const x = app({ now: "2026-10-08" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.l3 = { on: { pull: true, ohp: true, wpu: true }, mode: "alt-day", primary: "pull" };
  x.bump();
  const t = x.weeks(60).find((w) => w.kind === "test");
  a.ok(t, "a retest week exists");

  const days = [...Array(7)].map((_, i) => x.dayPlan(x.addDays(t.monday, i)));
  const tests = days.map((p, i) => ({ i, p })).filter(({ p }) => p.t === "test");
  a.equal(tests.length, 3, "Thursday, Friday and Saturday");
  for (const { i, p } of tests) a.ok(p.lifts.length <= 2, `day ${i} tests ${p.lifts.length} lifts, not more`);

  // Every lift in the cluster is still tested exactly once, and the apply card is last.
  const all = tests.flatMap(({ p }) => p.lifts);
  a.deepEqual([...all].sort(), ["bench", "dead", "ohp", "pull", "squat", "wpu"].sort());
  a.equal(new Set(all).size, all.length, "nothing tested twice");
  a.equal(days[5].apply, true, "results are fed forward from Saturday");
  a.equal(days[5].pullups, true);

  // A small cluster still fits in two days, with Friday left off as before.
  x.plan.l3 = { on: { pull: true, ohp: false, wpu: false }, mode: "same", primary: "pull" }; x.bump();
  const t2 = x.weeks(60).find((w) => w.kind === "test");
  const d2 = [...Array(7)].map((_, i) => x.dayPlan(x.addDays(t2.monday, i)));
  a.equal(d2.filter((p) => p.t === "test").length, 2, "two test days");
  a.equal(d2[4].t, "off", "Friday stays off when it is not needed");
});

test("the week you are in cannot be turned into a different kind of week", () => {
  const x = app({ now: "2026-11-18" });            // a Wednesday
  Object.assign(x.plan.maxes, { squat: 300, bench: 200, pull: 180, ohp: 135, dead: 400 });
  x.bump();
  const mon = x.mondayOf("2026-11-18");
  const was = x.weekOf(mon);
  x.freezePast();

  a.ok(x.plan.frozen[mon], "the current week is recorded");
  a.equal(x.plan.frozen[mon].soft, true, "but only softly: its identity, not its numbers");

  x.plan.deloadEvery = 1; x.plan.testEvery = 1; x.bump();
  const now = x.weekOf(mon);
  a.equal(now.kind, was.kind, "still the same kind of week");
  a.equal(now.cycle, was.cycle);
  a.equal(now.w, was.w);

  // The numbers are not frozen: Setup promises the wave applies from this week on.
  x.plan.waves.operator[was.w - 1].p = 62; x.bump();
  a.equal(x.rx(x.weekOf(mon), "squat").p, 62, "the edited wave reaches the week you are in");

  // And Setup says which is which rather than promising the old behaviour.
  a.match(x.vSetup(), /takes effect from <b>next<\/b> week/);
  a.match(x.vSetup(), /wave and your maxes still apply from this week/);
});

test("the shared catalogue adds to the built-in list for everyone", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  a.ok(!x.accFor("biceps").includes("cat-spider-curl"));

  x.catalog = [{ id: "cat-spider-curl", slot: "biceps", name: "Spider curl", gear: "EZ bar", hidden: false }];
  x.bump();
  a.ok(x.accFor("biceps").includes("cat-spider-curl"), "offered to everyone");
  a.equal(x.accName("cat-spider-curl"), "Spider curl");
  a.equal(x.accEx("cat-spider-curl").shared, true, "and marked as a shared addition");

  x.plan.accPick = { mon: { biceps: "cat-spider-curl" } }; x.bump();
  a.equal(x.accName(x.accOn("2026-09-07", "biceps")), "Spider curl", "and usable like any other");
});

test("retiring a movement stops it being offered but leaves it with whoever has it", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.accPick = { mon: { biceps: "bbcurl" } };          // this person is mid-cycle on it
  x.catalog = [{ id: "bbcurl", slot: "biceps", name: "", gear: "", hidden: true }];
  x.bump();
  const mon = "2026-09-07";

  // Still resolves, still named, still theirs.
  a.equal(x.accName("bbcurl"), "Barbell curl", "a retired movement keeps its name");
  a.equal(x.accEx("bbcurl").hidden, true);
  a.equal(x.accName(x.accOn(mon, "biceps")), "Barbell curl", "and they keep doing it");

  // Not offered to anyone choosing fresh.
  a.ok(!x.accFor("biceps").includes("bbcurl"), "nobody new is offered it");
  // But it stays in the picker of the person who has it, or their dropdown would lie.
  a.ok(x.accFor("biceps", "bbcurl").includes("bbcurl"), "their own picker still shows it");

  // Someone who had not chosen it gets the default, not a blank.
  const other = app({ now: "2026-09-07" });
  other.plan.startMonday = "2026-09-07"; other.plan.bridge = false;
  other.catalog = [{ id: "bbcurl", slot: "biceps", name: "", gear: "", hidden: true }];
  other.bump();
  a.ok(other.accName(other.accOn(mon, "biceps")), "they still have something to do");
});

test("a shared movement that is deleted outright falls back rather than breaking", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.catalog = [{ id: "cat-gone", slot: "biceps", name: "Gone curl", hidden: false }];
  x.plan.accPick = { mon: { biceps: "cat-gone" } }; x.bump();
  a.equal(x.accName(x.accOn("2026-09-07", "biceps")), "Gone curl");

  x.catalog = []; x.bump();   // the admin removed it entirely
  a.equal(x.accEx("cat-gone"), null, "it is gone");
  a.equal(x.accName(x.accOn("2026-09-07", "biceps")), "Barbell curl", "and the slot falls back to its default");
  a.ok(x.accFor("biceps").length > 0, "the picker still has options");
});

test("a personal addition from before the shared list still works, and is named as such", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.accCustom = [{ id: "mine-old", slot: "biceps", name: "My old curl", gear: "" }];
  x.plan.accPick = { mon: { biceps: "mine-old" } }; x.bump();

  a.equal(x.accName(x.accOn("2026-09-07", "biceps")), "My old curl");
  a.equal(x.accEx("mine-old").mine, true);
  a.match(x.vSetup(), /of your own from before the list was shared/);
  a.ok(!/Add it<\/button>/.test(x.vSetup()), "and Setup no longer offers to add more");

  // A shared entry wins if an id ever collides, since that is the curated one.
  x.catalog = [{ id: "mine-old", slot: "biceps", name: "Curated version", hidden: false }]; x.bump();
  a.equal(x.accName("mine-old"), "Curated version");
});

test("each kind of day gets its own questions, and some get none", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const day = (i) => x.addDays("2026-09-07", i);
  const ids = (d) => x.aimSet(d).map((a) => a.id);

  for (const i of [0, 2, 4]) {
    a.equal(x.dayPlan(day(i)).t, "lift");
    a.ok(ids(day(i)).includes("sets"), `day ${i} asks about sets`);
    a.ok(!ids(day(i)).some((v) => v.startsWith("c")), "and nothing about rounds");
  }
  for (const i of [1, 3, 5]) {
    a.notEqual(x.dayPlan(day(i)).t, "lift");
    const got = ids(day(i));
    a.ok(got.length, `day ${i} has questions of its own`);
    a.ok(got.every((v) => v.startsWith("c")), `day ${i} asks only conditioning ones: ${got}`);
    a.match(x.aimsCard(day(i)), /What matters today/);
  }

  // Rest days, test days and circuits get none: there is no set that fits them.
  a.equal(x.aimsCard(day(6)), "", "not a rest day");
  const x2 = app({ now: "2026-09-14" });
  x2.plan.startMonday = "2026-09-07"; x2.plan.bridge = true; x2.bump();
  const br = x2.weeks(10).find((w) => w.kind === "bridge");
  for (let i = 0; i < 7; i++) {
    const d = x2.addDays(br.monday, i);
    if (["rm5", "test"].includes(x2.dayPlan(d).t)) a.equal(x2.aimsCard(d), "", "a test day sets no aims");
  }

  // The note loop is not lifting-only.
  x.seed({ [day(1)]: { date: day(1), done: true, notes: "Bike seat too low." } }); x.bump();
  a.match(x.noteCard(day(3)), /Bike seat too low/, "it reaches the next conditioning day");
  a.equal(x.noteCard(day(6)), "", "but not a rest day");
});

test("a question that cannot apply to the day is not offered", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const day = (i) => x.addDays("2026-09-07", i);
  const ids = (d) => x.aimSet(d).map((a) => a.id);

  const hard = day(1);
  a.ok(x.ivRounds(hard) > 0, "Tuesday is intervals");
  a.ok(ids(hard).includes("crounds") && ids(hard).includes("ceasy"));
  a.ok(ids(hard).includes("cwarm"), "and a warm-up to tick");

  // A steady session has no rounds and no easy periods, so it is not asked about them.
  const easy = day(5);
  x.setLog(easy, "hic.format", "liss"); x.bump();
  a.equal(x.effFmt(easy), "liss");
  a.equal(x.ivRounds(easy), 0);
  const e = ids(easy);
  a.ok(!e.includes("crounds"), "no rounds to hit");
  a.ok(!e.includes("ceasy"), "no easy periods to keep easy");
  a.ok(!e.includes("cwarm"), "and no separate warm-up on a steady day");
  a.ok(e.includes("cspare") && e.includes("clog"), "but the ones that still apply remain");
});

test("the conditioning report counts what was logged and asks about the pacing", () => {
  const x = app({ now: "2026-09-08" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = "2026-09-08";
  const want = x.ivRounds(d);
  a.ok(want > 0);

  x.setLog(d, "aims", ["crounds", "cwarm", "cpace"]);
  x.setLog(d, "hic.rounds", want);
  x.setLog(d, "hic.iv.warm", true);
  x.setLog(d, "done", true);

  const h = x.aimsCard(d);
  a.match(h, /How it went/);
  a.match(h, /\u2713 Hit every round as prescribed/, "rounds are counted, not asked about");
  a.match(h, new RegExp(want + " of " + want));
  a.match(h, /\u2713 Warm up properly/);
  a.match(h, /data-act="aimrate" data-id="cpace"/, "pacing is a judgement, so it asks");
  a.ok(!/data-act="aimrate" data-id="crounds"/.test(h));

  x.setLog(d, "hic.rounds", 1);
  a.match(x.aimsCard(d), /\u2717 Hit every round/, "falling short says so");

  // Nothing logged is not the same as nothing to report: an unlogged session must not
  // be counted as a success just because there is no number to argue with.
  x.setLog(d, "hic.rounds", null);
  const none = x.aimsCard(d);
  a.match(none, /\u2717 Hit every round/, "unlogged is not a pass");
  a.match(none, /No rounds logged/);

  // The same for the warm-up and for the number itself.
  x.setLog(d, "aims", ["cwarm", "clog"]);
  x.setLog(d, "hic.iv.warm", null);
  const h2 = x.aimsCard(d);
  a.match(h2, /\u2717 Warm up properly/, "an unticked warm-up is not a pass either");
  a.match(h2, /\u2717 Log the number/, "nor is a session with no number on it");
});

test("a conditioning focus that keeps slipping gets conditioning advice", () => {
  const x = app({ now: "2026-09-29" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const d = (n) => x.addDays("2026-09-08", n * 7);     // successive Tuesdays
  x.seed({
    [d(0)]: { date: d(0), done: true, aims: ["cpace"], aimsRated: { cpace: "no" } },
    [d(1)]: { date: d(1), done: true, aims: ["cpace"], aimsRated: { cpace: "part" } },
  });
  x.bump();
  const p = x.aimPattern(d(3), "cpace");
  a.match(p, /sessions running/);
  a.match(p, /too hard on the first rounds/, "advice about pacing, not about the weight");
  a.ok(!/the weight, not the focus/.test(p), "the lifting advice does not leak across");
});

test("plyos move around the week on their own, a week at a time", () => {
  const x = app({ now: "2026-10-19" });        // Monday, cycle 1 week 3
  const mon = "2026-10-19";
  const on = () => [0, 1, 2, 3, 4, 5, 6].filter((d) => !!x.dayPlan(x.addDays(mon, d)).plyo);

  a.deepEqual(on(), [3], "Thursday unless you say otherwise");
  // The label says so, so the week strip and the calendar feed carry it too.
  a.equal(x.dayPlan(x.addDays(mon, 3)).short, "Plyo+HIC");

  a.equal(x.setPlyoDay(mon, 5), true);
  a.deepEqual(on(), [5], "moved to Saturday, and only one day holds them");
  a.equal(x.plyoMoved(mon), true);
  a.equal(x.dayPlan(x.addDays(mon, 3)).t, "hic", "Thursday keeps the session it always had");
  a.equal(x.dayPlan("2026-10-26").plyo, undefined, "next week is untouched");
  a.equal(x.plyoDow("2026-10-26"), 3);

  // Choosing the usual day again clears the override rather than pinning it.
  a.equal(x.setPlyoDay(mon, 3), true);
  a.equal(x.plyoMoved(mon), false);
  a.deepEqual(on(), [3]);

  // Days gone by are not on offer: not in a week that has passed, nor earlier in this one.
  x.setToday("2026-10-22");                    // Thursday
  a.equal(x.plyoDayOpen(mon, 1), false, "Tuesday has been and gone");
  a.equal(x.setPlyoDay(mon, 1), false);
  a.deepEqual(on(), [3], "so nothing moved");
  a.equal(x.plyoDayOpen(mon, 4), true, "tomorrow is fine");
  a.equal(x.setPlyoDay("2026-10-12", 4), false, "and last week is closed");

  a.equal(x.setPlyoDay(mon, 7), false, "7 is not a day");
  a.equal(x.setPlyoDay(mon, "nope"), false);

  // A bridge week runs no plyos, so there is no day to put them on.
  const bridge = x.weeks().find((w) => w.kind === "bridge");
  x.setToday(bridge.monday);
  a.equal(x.setPlyoDay(bridge.monday, 2), false);
  a.equal(x.plyoMoved(bridge.monday), false, "and nothing is written for it");
});

test("a moved plyo day shows the plyos and keeps what was already on it", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  const wk = x.weekOf(mon);

  // Onto Monday, which lifts: plyos first, then the lifting, and the week header says so.
  a.equal(x.setPlyoDay(mon, 0), true);
  x.sel = mon;
  const dp = x.dayPlan(mon);
  a.equal(dp.t, "lift", "still a lifting day");
  a.equal(dp.short, "Plyo+Op 1", "named on the week strip as both");
  a.equal(x.dayPlan(x.addDays(mon, 3)).short, "HIC", "and Thursday is plain again");
  const h = x.sessionHtml(wk, dp);
  a.match(h, /Plyos ·/, "with the plyos on it");
  a.match(h, /before you lift/, "told in the right order");
  a.ok(h.indexOf("Plyos ·") < h.indexOf("Working weight"), "and drawn before the lifts");
  a.match(x.vToday(), /Plyo: Extensive/, "named on the week header");

  // Onto Sunday, which is a rest day: the plyos are the session, so no rest-day copy.
  a.equal(x.setPlyoDay(mon, 6), true);
  x.sel = x.addDays(mon, 6);
  const sun = x.dayPlan(x.sel);
  a.equal(sun.t, "off");
  a.equal(sun.short, "Plyo", "a day with nothing else on it is just the plyos");
  const hs = x.sessionHtml(wk, sun);
  a.match(hs, /Plyos ·/);
  a.doesNotMatch(hs, /Full rest/, "it is not a rest day any more");

  // Thursday, now plyo-free, is a plain conditioning day again.
  x.sel = x.addDays(mon, 3);
  const thu = x.dayPlan(x.sel);
  a.equal(!!thu.plyo, false);
  a.doesNotMatch(x.sessionHtml(wk, thu), /Plyos ·/);
  a.doesNotMatch(x.vToday(), /Plyo:/);
});

test("the move sheet offers the plyo day only where plyos happen", () => {
  const x = app({ now: "2026-10-21" });        // Wednesday
  const sheet = x.moveCard();
  a.match(sheet, /Plyometrics/);
  for (const d of ["Mon", "Thu", "Sun"]) a.match(sheet, new RegExp(`data-act="plyoday"[^>]*>${d}<`));
  a.match(sheet, /data-act="plyoday" data-d="3"[^>]*aria-pressed="true"/, "Thursday is the one marked");
  a.match(sheet, /data-act="plyoday" data-d="0"[^>]*disabled/, "Monday has gone, so it is closed off");
  a.doesNotMatch(sheet, /data-act="plyoday" data-d="4"[^>]*disabled/, "Friday is still open");

  // A bridge week has no plyo phase, so it is not offered one.
  const bridge = x.weeks().find((w) => w.kind === "bridge");
  a.equal(x.plyoMovePicker(bridge.monday), "");
});

test("ramp rests set below a minute are raised to 90 s once", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.warmRest = { squat: 30, bench: 45, dead: 120, ohp: 90 };
  x.plan.schema = 3; x.outbox = {}; x.bump();

  a.equal(x.migrate(), true);
  a.equal(x.plan.schema, x.SCHEMA);
  a.equal(x.plan.warmRest.squat, 90, "30 s was the old floor, not a choice");
  a.equal(x.plan.warmRest.bench, 90);
  a.equal(x.plan.warmRest.dead, 120, "a longer rest is someone's decision and stays");
  a.equal(x.plan.warmRest.ohp, 90);
  a.ok("plan/main" in x.outbox, "and the change is saved");
});

test("the warm-up checklist times its own holds, without the guided run-through", () => {
  const x = app({ now: "2026-10-19" });        // Monday, a lifting day
  x.lsStart();
  const st = x.lsSteps("2026-10-19");
  a.equal(st[0].type, "gwarm", "session mode opens on the warm-up");
  x.ls.i = 0;
  x.lsRender();
  const h = x.dom.made["ls-in"].innerHTML;

  a.match(h, /data-ls="guide"/, "the guided run is still offered");
  // "4–5 min" on the bike and "45–60 sec per side" on the couch stretch both get a clock.
const clock = (name) => {
    const i = x.WARMUP.findIndex((w) => w.n === name);
    a.match(h, new RegExp(`data-ls="hold" data-i="${i}"`), `${name} has a clock`);
    return i;
  };
  clock("Bike, rower or easy jog");
  clock("Couch stretch");
  // Rep-counted items have nothing to time, so they get no button.
  const rows = h.split('class="ls-wrow"').slice(1);
  const cat = rows.find((r) => r.includes("Cat / cow"));
  a.ok(cat, "the rep items are still listed");
  a.doesNotMatch(cat, /data-ls="hold"/, "but not given a timer");

  // Through the dispatcher the ⏱ is actually wired to.
  const ci = x.WARMUP.findIndex((w) => w.n === "Couch stretch");
  x.ls.i = 0;
  x.lsAct("hold", { dataset: { i: String(ci) } });
  a.ok(x.rest, "tapping the clock starts a timer");
  a.equal(x.rest.lbl, "Couch stretch");
  a.equal(x.guide, null, "and not the guided overlay");
  x.stopRest();

  // Tapping one starts the shared rest/hold timer rather than opening the overlay.
  a.equal(x.lsHold("warmup", ci), true);
  a.equal(x.guide, null, "no guided overlay");
  a.equal(x.rest.lbl, "Couch stretch");
  a.equal(x.rest.dur, 60, "the dose read off the item itself");
  a.equal(x.rest.sides, 2, "both sides");
  a.match(x.lsRestHtml(), /Couch stretch/, "and it shows inside session mode");
  // "4–5 min" on the bike is a timer too; a rep count is not.
  a.equal(x.lsHold("warmup", x.WARMUP.findIndex((w) => w.n === "Bike, rower or easy jog")), true);
  a.equal(x.rest.dur, 300);
  a.equal(x.lsHold("warmup", x.WARMUP.findIndex((w) => w.n === "Cat / cow")), false);
  a.equal(x.rest.dur, 300, "and the running clock is left alone");
  a.equal(x.lsHold("warmup", 999), false, "an index that is not on the list does nothing");

  // The short warm-up drops most of the list. Items are still addressed by their place in
  // WARMUP, not their place in what is shown, so the clock stays on the right movement.
  x.setLog("2026-10-19", "warmShort", true);
  const couch = x.WARMUP.findIndex((w) => w.n === "Couch stretch");
  a.ok(x.gdItems("warmup", "2026-10-19").length < x.WARMUP.length, "fewer items on offer");
  a.equal(x.lsHold("warmup", couch), true);
  a.equal(x.rest.lbl, "Couch stretch", "still the couch stretch, not whatever sits there now");
});

test("a ramp set nudges by the lift's increment and the whole step follows", () => {
  const x = app({ now: "2026-10-19" });
  x.lsStart();
  const mon = "2026-10-19";
  const first = () => x.lsSteps(mon).filter((s) => s.type === "warm" && s.k === "squat");
  const calc = first().map((s) => s.w);
  a.ok(calc.length >= 4, "squat ramps");

  // 45 lb bar, 5 lb increment: the bar set goes to 50, then 55.
  a.equal(x.adjustWarm(mon, "squat", 0, +1, calc[0]), calc[0] + 5);
  a.equal(x.adjustWarm(mon, "squat", 0, +1, calc[0]), calc[0] + 10, "and again from where it got to");
  a.equal(first()[0].w, calc[0] + 10, "the step itself carries the new weight");
  a.deepEqual(first().slice(1).map((s) => s.w), calc.slice(1), "the other ramp sets are untouched");

  // Down the way, and never below the bar.
  x.setLog(mon, "lifts.squat.warmup.0.w", x.plan.bar);
  a.equal(x.adjustWarm(mon, "squat", 0, -1, calc[0]), x.plan.bar, "an empty bar is the floor");

  // A lift with a different increment uses its own.
  x.plan.round = Object.assign({}, x.plan.round, { bench: 2.5 });
  x.bump();
  const b0 = x.lsSteps(mon).find((s) => s.type === "warm" && s.k === "bench").w;
  a.equal(x.adjustWarm(mon, "bench", 0, +1, b0), b0 + 2.5);

  // It is the same field the day's card writes to, so both screens agree.
  a.equal(x.wuList("bench")[0].w, b0 + 2.5);

  // Through the dispatcher the button actually goes to, not just the function behind it.
  x.ls.i = x.lsSteps(mon).findIndex((s) => s.type === "warm" && s.k === "squat");
  const now = () => x.lsSteps(mon)[x.ls.i].w;
  const was = now();
  x.lsAct("ww+", { dataset: {} });
  a.equal(now(), was + 5, "tapping + adds the increment");
  x.lsAct("ww-", { dataset: {} });
  a.equal(now(), was, "and − takes it back off");
  a.equal(x.ls.i, x.lsSteps(mon).findIndex((s) => s.type === "warm" && s.k === "squat"),
    "nudging the weight does not advance the step");

  // The buttons are on the ramp step and not on a working set.
  x.ls.i = x.lsSteps(mon).findIndex((s) => s.type === "warm");
  x.lsRender();
  a.match(x.dom.made["ls-in"].innerHTML, /data-ls="ww\+"/, "a ramp set can be nudged");
  x.ls.i = x.lsSteps(mon).findIndex((s) => s.type === "work");
  x.lsRender();
  const work = x.dom.made["ls-in"].innerHTML;
  a.doesNotMatch(work, /data-ls="ww\+"/, "a working set has its own control");
  a.match(work, /data-ls="w\+"/);
  // And that one moves the working weight, which is a different field from a ramp set's.
  const T = x.lsSteps(mon)[x.ls.i].w;
  x.lsAct("w+", { dataset: {} });
  a.equal(x.lsSteps(mon)[x.ls.i].w, T + 5, "the working weight goes up");
  a.equal(((x.logs[mon].lifts || {}).squat || {}).used, T + 5, "written as the day's working weight");
});

// Lets the resume's promise chain run: resume() is one microtask, beepTones' .then another.
const settle = () => new Promise((r) => setTimeout(r, 0));

test("the rest beep shares the speaker by default and seizes it only if asked", async () => {
  const x = app({ now: "2026-10-19" });
  a.equal(x.soundMode(), "duck", "sharing is the default");
  x.unlockAudio();
  await settle();                                  // the context resumes asynchronously
  a.equal(navigator.audioSession.type, "transient", "which is the mixable category");
  x.audio.tones.length = 0; x.audio.plays.length = 0; x.buzzes.length = 0;

  const r = x.beep();
  a.equal(r.vib, true, "it buzzes");
  a.deepEqual(x.buzzes, [[200, 100, 200]]);
  a.equal(x.audio.tones.length, 3, "three tones through Web Audio");
  a.deepEqual(x.audio.tones.map((t) => t.hz), [880, 880, 1320]);
  a.equal(x.audio.plays.length, 0,
    "and no media clip: playing one would take the speaker, which is what ducking avoids");

  // Taking over adds the clip, because beating the ring switch means holding the channel.
  x.setSoundMode("takeover");
  await settle();
  a.equal(navigator.audioSession.type, "playback");
  x.audio.tones.length = 0; x.audio.plays.length = 0; x.buzzes.length = 0;
  x.beep();
  a.equal(x.audio.tones.length, 3);
  a.equal(x.audio.plays.length, 1, "the clip goes out too");
  a.match(x.audio.plays[0], /^data:audio\/wav/);
  x.setSoundMode("duck");

  // Silent takes the sound, not the buzz.
  x.plan.soundMode = "silent";
  x.audio.tones.length = 0; x.audio.plays.length = 0; x.buzzes.length = 0;
  const q = x.beep();
  a.equal(q.vib, true, "a silent timer still buzzes, or it cannot tell you anything");
  a.equal(x.audio.tones.length, 0, "no tones");
  a.equal(x.audio.plays.length, 0, "and no clip");
});

test("a suspended channel is resumed before the tones are scheduled against its clock", async () => {
  const x = app({ now: "2026-10-19" });
  // Exactly the state after the phone has locked: a context whose clock is frozen.
  x.unlockAudio();
  a.equal(x.audioState().ctx, "suspended", "it starts suspended, as iOS leaves it");
  x.audio.tones.length = 0;

  const r = x.beep();
  a.equal(r.tones, "resuming");
  a.equal(x.audio.tones.length, 0, "nothing is scheduled while the clock is still stale");

  await settle();
  a.equal(x.audio.tones.length, 3, "the tones go out once the resume has landed");
  a.equal(x.audioState().ctx, "running", "and the channel is awake");
  // The clock jumps on resume. Reading it first would have queued all three in the past.
  const at = x.audio.tones.map((t) => t.at);
  a.ok(at[0] >= 5, `first tone at ${at[0]}, on the post-resume clock, not the frozen one`);
  a.deepEqual([at[1] - at[0], at[2] - at[0]].map((d) => Math.round(d * 100) / 100), [0.28, 0.56],
    "spaced as a three-note beep");
});

test("the sound mode picks the audio session, and only three modes exist", () => {
  const x = app({ now: "2026-10-19" });
  // iOS splits sessions into mixable and exclusive. That is the whole choice: a native
  // app can ask for playback *and* mixWithOthers, the web cannot ask for both.
  for (const [mode, want] of [["duck", "transient"], ["takeover", "playback"]]) {
    a.equal(x.setSoundMode(mode), true);
    x.unlockAudio();
    a.equal(navigator.audioSession.type, want, `${mode} asks for ${want}`);
    a.equal(x.beepDiag().session, want, "and the diagnostic reports it");
    a.equal(x.beepDiag().mode, mode);
  }
  a.equal(x.setSoundMode("silent"), true);
  a.equal(x.quiet(), true);
  a.equal(x.setSoundMode("loud"), false, "there is no fourth mode");
  a.equal(x.setSoundMode(""), false);
  a.equal(x.soundMode(), "silent", "and a bad value changes nothing");
});

test("an older plan's Silent switch becomes the three-way choice", () => {
  const x = app({ now: "2026-10-19" });
  delete x.plan.soundMode;
  x.plan.quietTimer = true; x.plan.schema = 5; x.outbox = {}; x.bump();
  a.equal(x.soundMode(), "silent", "read correctly even before the migration runs");
  a.equal(x.migrate(), true);
  a.equal(x.plan.soundMode, "silent");
  a.equal(x.plan.quietTimer, undefined, "the old flag is gone");

  const y = app({ now: "2026-10-19" });
  delete y.plan.soundMode;
  y.plan.quietTimer = false; y.plan.schema = 5; y.bump();
  y.migrate();
  a.equal(y.plan.soundMode, "duck", "someone who had sound on now shares the speaker");
});

test("one rest ending makes exactly one noise", async () => {
  const x = app({ now: "2026-10-19" });
  x.unlockAudio();
  await settle();
  x.startRest("squat", "set 2", 90, "Rest \u00b7 Squat");
  a.equal(x.rest.done, false);
  x.audio.tones.length = 0; x.audio.plays.length = 0; x.buzzes.length = 0;

  x.tickRest();
  a.equal(x.audio.tones.length, 0, "nothing while it is still counting");

  x.rest.end = Date.now() - 500;
  x.tickRest();
  await settle();
  a.equal(x.rest.done, true, "the rest is marked finished");
  a.equal(x.audio.tones.length, 3, "and it beeps");
  a.equal(x.buzzes.length, 1);

  // Every later tick is silent: a finished rest sits on screen until it is dismissed.
  x.tickRest(); x.tickRest();
  await settle();
  a.equal(x.audio.tones.length, 3, "it does not beep again");
  a.equal(x.buzzes.length, 1);
});

test("the beep test reports what it found and says what to try", () => {
  const x = app({ now: "2026-10-19" });
  a.equal(x.beepReport(), "No beep test run yet.");

  x.beepTest();
  a.ok(x.beepSeen, "the result is kept for the card");
  a.equal(x.beepSeen.silent, false);
  a.match(x.beepReport(), /beep test/);
  a.match(x.beepReport(), /audio session: transient/);
  a.equal(x.audioState().silent, false, "and reading the state does not need a beep");

  // Silent is a setting, not a fault, and the advice says so first.
  x.plan.soundMode = "silent";
  x.beepTest();
  a.match(x.beepAdvice(x.beepSeen)[0], /on purpose/);

  // An iPhone can never buzz, and that is worth saying rather than looking broken.
  const ip = { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
    mode: "duck", silent: false, canVibrate: false, vibrated: false, media: "skipped-duck",
    tones: "running", ctx: "running", session: "transient" };
  const adv = x.beepAdvice(ip).join(" ");
  a.match(adv, /no way to vibrate/);
  a.match(adv, /ring switch/, "and points at the thing that actually silences it");
  a.match(adv, /always be audible/, "with the way out named, since ducking cannot beat it");

  // On a phone set to take the speaker, that advice would be wrong and is not given.
  const over = x.beepAdvice(Object.assign({}, ip, { mode: "takeover", session: "playback" })).join(" ");
  a.doesNotMatch(over, /always be audible/);

  // A channel that never opened, and one the phone suspended, get their own advice.
  a.match(x.beepAdvice(Object.assign({}, ip, { ctx: "none" })).join(" "), /nothing has been tapped/);
  a.match(x.beepAdvice(Object.assign({}, ip, { ctx: "suspended" })).join(" "), /suspended/);

  // Nothing wrong that the app can see is its own answer, not silence.
  const ok = { ua: "Android Chrome", silent: false, canVibrate: true, vibrated: true,
    media: "played", tones: "running", ctx: "running", session: "unsupported" };
  a.match(x.beepAdvice(ok).join(" "), /came back fine/);
  a.equal(x.beepAdvice(ok).length, 1, "and it does not pile on advice that does not apply");
});

test("the Sound card offers the beep test and shows the result", () => {
  const x = app({ now: "2026-10-19" });
  x.view = "setup";
  const before = x.vSetup();
  a.match(before, /data-act="beeptest"/, "the button is there before any test");
  a.doesNotMatch(before, /data-act="beepcopy"/, "the report only appears once there is one");

  x.beepTest();
  const after = x.vSetup();
  a.match(after, /data-act="beepcopy"/, "with a way to send it on");
  a.match(after, /What the app saw/, "behind a disclosure");
  a.match(after, /channel (running|suspended)/, "with the raw facts in it");
  a.match(after, /session transient/);
});

test("the composed Operator week is exactly the week that used to be hardcoded", () => {
  const x = app({ now: "2026-10-19" });
  const wk = x.weeks().find((w) => w.kind === "cycle" && w.w % 2 === 1);
  const ev = x.weeks().find((w) => w.kind === "cycle" && w.w % 2 === 0);

  // The literal that lived in dayPlanSlot before templates existed, verbatim.
  const was = (week, date) => {
    const SBP = ["squat", "bench", x.l3For(date)], SBD = ["squat", "bench", "dead"];
    return [
      { t: "lift", day: 1, lifts: SBP, acc: "mon", short: "Op 1" },
      { t: "hic", fmt: "map", short: "HIC" },
      { t: "lift", day: 2, lifts: SBP, acc: "wed", short: "Op 2" },
      { t: "hic", fmt: "anaerobic", short: "HIC" },
      { t: "lift", day: 3, lifts: SBD, acc: "fri", short: "Op 3" },
      { t: "hic", fmt: week.w % 2 ? "threshold" : "long", short: "HIC", note: "Swap to LISS if the week has been heavy." },
      { t: "off", short: "Off" },
    ];
  };
  for (const week of [wk, ev]) {
    for (let d = 0; d < 7; d++) {
      const date = x.addDays(week.monday, d);
      a.deepEqual(x.composeSlot(date, week, d), was(week, date)[d],
        `week ${week.w} slot ${d} is unchanged`);
    }
  }
});

test("a week puts the lifting days where the book puts them, then fills around them", () => {
  const x = app({ now: "2026-10-19" });

  // Operator trains on days 1, 3 and 5, which with Black's three sessions alternates.
  a.deepEqual(x.weekShape([0, 2, 4], 3), ["S", "C", "S", "C", "S", "C", "R"]);

  // Fighter is days 1 and 4. Three conditioning sessions still fit without touching.
  a.deepEqual(x.weekShape([0, 3], 3), ["S", "C", "R", "S", "C", "R", "C"]);

  // Zulu's days 1, 2, 4 and 5 are deliberately paired — A and B work different lifts —
  // so the layout honours the template rather than prising them apart. The third
  // conditioning session will not fit in what is left, so it rides on the first lifting
  // day: this is TB II's own "Black + Zulu" week, day for day.
  a.deepEqual(x.weekShape([0, 1, 3, 4], 2), ["S", "S", "C", "S", "S", "C", "R"]);
  a.deepEqual(x.weekShape([0, 1, 3, 4], 3), ["SC", "S", "C", "S", "S", "C", "R"]);

  // Riding along beats two conditioning days back to back, and the rest day is kept.
  a.deepEqual(x.weekShape([0, 3], 4), ["SC", "C", "R", "S", "C", "R", "C"]);
  a.deepEqual(x.weekShape([0, 2, 4], 4), ["SC", "C", "S", "C", "S", "C", "R"]);

  // A template naming a day outside the week is ignored rather than losing the week.
  a.deepEqual(x.weekShape([0, 9, -1, 3], 1), ["S", "C", "R", "S", "R", "R", "R"]);

  // With nothing to ride on, the rest day is spent rather than a session dropped.
  a.deepEqual(x.weekShape([], 7), ["C", "C", "C", "C", "C", "C", "C"]);

  // Whatever the counts, it is seven days and never loses a session.
  for (const slots of [[], [0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 2, 4, 6]]) {
    for (let c = 0; c <= 5; c++) {
      const sh = x.weekShape(slots, c);
      a.equal(sh.length, 7, `${slots}+${c} is a week`);
      a.equal(sh.filter((v) => v === "S" || v === "SC").length, slots.length,
        `${slots}+${c} keeps every lifting day`);
      a.equal(sh.filter((v) => v === "C" || v === "SC").length, c,
        `${slots}+${c} keeps every conditioning session`);
      for (const i of slots) a.ok(sh[i] === "S" || sh[i] === "SC",
        `${slots}+${c}: day ${i} is where the template says`);
      // A week with a slot to spare keeps a rest day.
      if (slots.length && 7 - slots.length > 1) {
        a.ok(sh.includes("R"), `${slots}+${c}: ${sh.join("|")} keeps a rest day`);
      }
      // Conditioning days only touch when there is nothing left to ride on.
      if (slots.length) for (let i = 1; i < 7; i++) {
        if (sh[i] === "C" && sh[i - 1] === "C") {
          a.ok(sh.filter((v) => v === "SC").length === slots.length,
            `${slots}+${c}: ${sh.join("|")} doubled up with a lifting day still free`);
        }
      }
    }
  }

  // The real one has no clash, checked the way the Move tool checks it.
  const kinds = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const date = x.addDays("2026-10-19", d);
    return x.sessKind(x.dayPlanSlot(date, d));
  });
  for (let i = 1; i < kinds.length; i++) a.equal(x.clashes(kinds[i], kinds[i - 1]), false,
    `${kinds[i - 1]} then ${kinds[i]}`);
});

test("an unknown template or protocol falls back rather than emptying the week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "nope"; x.plan.cproto = "also-nope"; x.bump();
  const dp = x.dayPlan("2026-10-19");
  a.equal(dp.t, "lift", "a plan naming a template this build does not have still trains");
  a.equal(dp.short, "Op 1");
  a.equal(x.stemplOf().name, "Operator");
  a.equal(x.cprotoOf().name, "Black");
});

test("a protocol can name its own sessions, which is what E and SE days need", () => {
  const x = app({ now: "2026-10-19" });
  // Stand in a protocol of the shape Green needs: a hard session, an endurance session
  // that is not a HIC, and a strength-endurance circuit. Registered rather than shipped,
  // so this is a test of the extension point, not of a protocol.
  x.CPROTO.scratch = {
    name: "Scratch", book: "test",
    sessions: () => [
      { t: "hic", fmt: "map" },
      { t: "hic", fmt: "liss", short: "E 45m", note: "Conversational." },
      { t: "se", circuits: 3, reps: 20, short: "SE 3×20" },
    ],
  };
  x.plan.cproto = "scratch"; x.bump();

  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays("2026-10-19", d), d));
  const byShort = Object.fromEntries(days.filter((p) => p.short).map((p) => [p.short, p]));

  a.ok(byShort["E 45m"], "a session's own label is kept, not overwritten with HIC");
  a.equal(byShort["E 45m"].fmt, "liss");
  a.equal(byShort["E 45m"].note, "Conversational.");
  a.ok(byShort["SE 3×20"], "and a circuit stays a circuit");
  a.equal(byShort["SE 3×20"].t, "se", "its day type is its own, not forced to hic");
  a.equal(byShort["SE 3×20"].circuits, 3);
  a.equal(byShort["HIC"].fmt, "map", "a session that names nothing still gets the default label");

  // Three lifting days and three conditioning, so the week is still the alternating one.
  a.deepEqual(days.map((p) => p.t), ["lift", "hic", "lift", "hic", "lift", "se", "off"]);

  delete x.CPROTO.scratch;
});

test("Fighter is two lifting days on the book's days, with its own wave", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "fighter"; x.bump();
  const mon = "2026-10-19";
  const week = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d));

  a.deepEqual(week.map((p) => p.t), ["lift", "hic", "off", "lift", "hic", "off", "hic"],
    "days 1 and 4 lift, as TB1's Fighter table has it");
  a.deepEqual(week.filter((p) => p.t === "lift").map((p) => p.short), ["Ftr 1", "Ftr 2"]);
  a.deepEqual(week[0].lifts, ["squat", "bench", x.l3For(mon)], "first day is the press cluster");
  a.deepEqual(week[3].lifts, ["squat", "bench", "dead"], "second is the deadlift one");

  // Its own accessory jobs, because two days have to cover what three did.
  a.equal(week[0].acc, "f1");
  a.equal(week[3].acc, "f2");
  const jobs = [...x.accSlots("f1"), ...x.accSlots("f2")];
  for (const k of ["pullup", "carry", "core", "biceps", "triceps"]) {
    a.ok(jobs.includes(k), `${k} still has a day to live on`);
  }

  // Fighter's wave: 3-4 sets, a three-week block run twice.
  const pct = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1).map((w) => x.wkRx(w).p);
  a.deepEqual(pct, [75, 80, 90, 75, 80, 90], "two three-week blocks, not Operator's six");
  const w1 = x.weeks().find((w) => w.kind === "cycle" && w.w === 1);
  a.equal(x.rx(w1, "squat", mon).s, 3);
  a.equal(x.rx(w1, "squat", mon).sMax, 4, "the book's 3-4 sets is the existing ceiling");

  // Switching back leaves Operator exactly as it was.
  x.plan.stempl = "operator"; x.bump();
  a.deepEqual(x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1).map((w) => x.wkRx(w).p),
    [70, 80, 90, 75, 85, 95]);
  a.equal(x.dayPlanSlot(mon, 0).short, "Op 1");
});

test("each template keeps its own wave, and editing one leaves the other alone", () => {
  const x = app({ now: "2026-10-19" });
  a.deepEqual(x.waveOf().map((w) => w.p), [70, 80, 90, 75, 85, 95], "Operator's");
  a.deepEqual(x.waveOf("fighter").map((w) => w.p), [75, 80, 90, 75, 80, 90], "Fighter's");

  x.plan.waves.operator[0].p = 65; x.bump();
  a.equal(x.waveOf()[0].p, 65, "an edit sticks");
  a.equal(x.waveOf("fighter")[0].p, 75, "and does not reach the other template");

  // An unknown template reads the default rather than an empty wave.
  a.deepEqual(x.waveOf("nope").map((w) => w.p), [65, 80, 90, 75, 85, 95]);
});

test("a week already trained keeps the programme it was trained under", () => {
  const x = app({ now: "2026-11-16" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  x.freezePast();
  const past = "2026-10-19";
  a.ok(x.plan.frozen[past], "the week is frozen");
  a.equal(x.plan.frozen[past].tpl, "operator", "stamped with the template it ran under");

  const before = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(past, d), d).short);
  a.deepEqual(before, ["Op 1", "HIC", "Op 2", "HIC", "Op 3", "HIC", "Off"]);

  // Switch programme now. History must not be rewritten into something never done.
  x.plan.stempl = "fighter"; x.bump();
  const after = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(past, d), d).short);
  a.deepEqual(after, before, "October is still the Operator week it was");

  // The week you are in is not history yet: a programme switch reaches it, the same way
  // a changed wave or a changed max does. Only weeks fully past are stamped and kept.
  a.equal(x.plan.frozen["2026-11-16"].soft, true, "the current week is held loosely");
  a.equal(x.plan.frozen["2026-11-16"].tpl, undefined, "and is not stamped with a programme");
  a.equal(x.dayPlanSlot("2026-11-16", 0).short, "Ftr 1", "so it follows the switch");

  // The weeks ahead are the new programme.
  const soon = x.weeks().find((w) => w.kind === "cycle" && w.monday > "2026-11-16");
  a.ok(soon, "there is a cycle week still to come");
  a.equal(x.plan.frozen[soon.monday], undefined, "not frozen, so it follows the plan");
  a.equal(x.dayPlanSlot(soon.monday, 0).short, "Ftr 1", "and from here on it is Fighter");
});

test("an edited wave moves under the template it was edited for", () => {
  const x = app({ now: "2026-10-19" });
  // The 1.75 shape: one global wave, no templates.
  delete x.plan.waves;
  x.plan.wave = [{ s: 5, r: 5, p: 70 }, { s: 5, r: 5, p: 80 }, { s: 5, r: 3, p: 90 }];
  x.plan.schema = 4; x.outbox = {}; x.bump();

  a.equal(x.migrate(), true);
  a.equal(x.plan.schema, x.SCHEMA);
  a.equal(x.plan.wave, undefined, "the global wave is gone");
  a.deepEqual(x.plan.waves.operator.map((w) => w.s), [5, 5, 5], "and is Operator's now");
  a.equal(x.waveOf()[0].s, 5, "which is what the app reads");
  a.deepEqual(x.waveOf("fighter").map((w) => w.p), [75, 80, 90, 75, 80, 90], "Fighter is untouched");
  a.ok("plan/main" in x.outbox, "and it is saved");

  // A three-week wave means three-week cycles, derived rather than hardcoded at six.
  a.equal(x.cycleWeeks(), 3);
  a.deepEqual(x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1).map((w) => w.w), [1, 2, 3]);
});

test("Zulu runs half the cluster at a time, four days a week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "zulu"; x.bump();
  const mon = "2026-10-19";
  const week = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d));

  // TB II's own Black + Zulu week, day for day: lift, lift, HIC, lift, lift, E, rest —
  // with the third conditioning session riding on day 1 after the barbell work.
  a.deepEqual(week.map((p) => p.t), ["lift", "lift", "hic", "lift", "lift", "hic", "off"]);
  a.equal(week[0].cardio, true, "day 1 carries a conditioning session too");
  a.equal(week[0].short, "Zulu A + HIC");
  a.ok(!week[1].cardio && !week[3].cardio && !week[4].cardio, "the other lifting days do not");

  // A session that carries a note keeps it when it rides along, because Green's
  // endurance days say what they are for and that is most of their value.
  x.CPROTO.noted = { name: "Noted", book: "test",
    sessions: () => [{ t: "hic", fmt: "liss", short: "E 60m", note: "Keep it conversational." },
                     { t: "hic", fmt: "map" }, { t: "hic", fmt: "map" }] };
  x.plan.cproto = "noted"; x.bump();
  const ride = x.dayPlanSlot(mon, 0);
  a.equal(ride.cardio, true);
  a.equal(ride.fmt, "liss", "the session's own format, not a default");
  a.equal(ride.short, "Zulu A + E 60m", "and its own label");
  a.equal(ride.condNote, "Keep it conversational.");
  x.sel = mon;
  a.match(x.sessionHtml(x.weekOf(mon), ride), /Keep it conversational/, "shown on the day");
  delete x.CPROTO.noted;
  x.plan.cproto = "black"; x.bump();

  // And it is a card you can actually log, after the barbell work rather than before.
  x.sel = mon;
  const h = x.sessionHtml(x.weekOf(mon), week[0]);
  a.match(h, /Then, conditioning/, "the day says what comes next");
  a.match(h, /Interval timer/, "with the session on it to run and log");
  a.ok(h.indexOf("Working weight") < h.indexOf("Then, conditioning"), "lifting first");

  // The default split is the book's: bench and squat against deadlift and the press.
  a.deepEqual(week[0].lifts, ["squat", "bench"], "A");
  a.deepEqual(week[1].lifts, ["dead", x.l3For(x.addDays(mon, 1))], "B");
  a.deepEqual(week[3].lifts, week[0].lifts, "and each half runs twice");
  a.deepEqual(week[4].lifts, week[1].lifts);

  // Its wave: one prescription a week, 4×3 on the heavy weeks.
  const pct = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1).map((w) => x.wkRx(w).p);
  a.deepEqual(pct, [70, 80, 90, 75, 85, 90]);
  a.equal(x.wkRx(x.weeks().find((w) => w.kind === "cycle" && w.w === 3)).s, 4);
});

test("Zulu's paired days are the template, not a clash", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "zulu"; x.bump();
  const mon = "2026-10-19";

  // A and B work different lifts, so back to back is the point of the template.
  a.equal(x.sessKind(x.dayPlanSlot(mon, 0)), "strengthA");
  a.equal(x.sessKind(x.dayPlanSlot(x.addDays(mon, 1), 1)), "strengthB");
  a.equal(x.clashes("strengthA", "strengthB"), false, "different halves may touch");
  a.equal(x.clashes("strengthA", "strengthA"), true, "the same half may not");
  a.deepEqual(x.orderIssues(mon, [0, 1, 2, 3, 4, 5, 6]), [], "so the week reads clean");

  // Moving a day so the same half lands twice running is still reported.
  const bad = x.orderIssues(mon, [0, 3, 2, 1, 4, 5, 6]);
  a.ok(bad.length, "two A days in a row is a clash");
  a.equal(x.kindName(bad[0].kind), "strength", "and is named in words, not as a code");

  // Operator is unaffected: its days are plain strength and still must not touch.
  x.plan.stempl = "operator"; x.bump();
  a.equal(x.sessKind(x.dayPlanSlot(mon, 0)), "strength");
  a.deepEqual(x.orderIssues(mon, [0, 1, 2, 3, 4, 5, 6]), []);
});

test("the two halves can be rearranged, and neither can be emptied", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "zulu"; x.bump();
  const mon = "2026-10-19";
  a.deepEqual(x.halvesOf(), { a: ["squat", "bench"], b: ["dead", "l3"] }, "the book's split");

  // Move the deadlift across.
  a.equal(x.setHalf("dead", "a"), true);
  a.deepEqual(x.halvesOf().a, ["squat", "bench", "dead"]);
  a.deepEqual(x.halvesOf().b, ["l3"]);
  a.deepEqual(x.dayPlanSlot(mon, 0).lifts, ["squat", "bench", "dead"], "and the day follows");

  // Drop a lift out of both halves entirely.
  a.equal(x.setHalf("bench", ""), true);
  a.deepEqual(x.halvesOf().a, ["squat", "dead"]);

  // But not the last one in a half: an empty half is not a session.
  a.equal(x.setHalf("l3", "a"), false, "that would leave B with nothing");
  a.deepEqual(x.halvesOf().b, ["l3"], "so nothing moved");
  a.equal(x.setHalf("l3", ""), false);

  // Stored halves are data, and data can be junk: an older build, a hand-edited export,
  // a lift that no longer exists. Neither case may produce a day with no lifts on it.
  x.plan.halves = { a: ["squat", "banana"], b: ["dead"] }; x.bump();
  a.deepEqual(x.halvesOf().a, ["squat"], "a lift the app does not track is dropped");
  a.deepEqual(x.dayPlanSlot(mon, 0).lifts, ["squat"]);

  x.plan.halves = { a: [], b: ["dead"] }; x.bump();
  a.deepEqual(x.halvesOf().a, ["squat", "bench"], "an emptied half falls back to the default");
  a.ok(x.dayPlanSlot(mon, 0).lifts.length, "so the day is never blank");

  x.plan.halves = { a: ["banana"], b: ["kiwi"] }; x.bump();
  a.deepEqual(x.halvesOf(), { a: ["squat", "bench"], b: ["dead", "l3"] }, "and nonsense falls back whole");

  x.plan.halves = {}; x.bump();
  a.equal(x.setHalf("nope", "a"), false, "a lift the app does not track");
  a.equal(x.setHalf("squat", "c"), false, "and there is no third half");

  // Setup offers it only for a template that splits.
  x.view = "setup";
  a.match(x.vSetup(), /data-act="half" data-k="squat"/);
  x.plan.stempl = "operator"; x.bump();
  a.doesNotMatch(x.vSetup(), /data-act="half"/, "Operator has nothing to split");
});

test("Green is endurance-led: easy days, a circuit, and a hard one every other week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "fighter"; x.plan.cproto = "green"; x.bump();
  const mon = "2026-10-19";
  const week = (m) => [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(m, d), d));
  const w = week(mon);

  // The shape TB II's Green guidelines ask for: two lifting days, three easy aerobic
  // sessions, one circuit, one rest day — and nothing riding along, because it fits.
  a.deepEqual(w.map((p) => p.t), ["lift", "hic", "hic", "lift", "hic", "se", "off"]);
  a.equal(w.filter((p) => p.fmt === "liss").length, 3, "three easy sessions");
  a.ok(!w.some((p) => p.ride), "all on their own days");

  // Two easy days may sit next to each other — Green's own template does exactly that.
  a.equal(x.sessKind(w[1]), "easy");
  a.deepEqual(x.orderIssues(mon, [0, 1, 2, 3, 4, 5, 6]), [], "and that is not a clash");

  // The hard session arrives on even weeks only.
  const odd = x.weeks().find((k) => k.kind === "cycle" && k.w % 2 === 1);
  const even = x.weeks().find((k) => k.kind === "cycle" && k.w % 2 === 0);
  a.ok(!week(odd.monday).some((p) => p.fmt === "map"), `week ${odd.w} has no HIC`);
  a.ok(week(even.monday).some((p) => p.fmt === "map"), `week ${even.w} has one`);

  // The circuits climb over a three-week block and start again.
  const reps = x.weeks().filter((k) => k.kind === "cycle" && k.cycle === 1)
    .map((k) => week(k.monday).find((p) => p.t === "se").reps);
  a.deepEqual(reps, [30, 40, 50, 30, 40, 50]);
});

test("Green's Progressive SE does no barbell work, whatever template is set", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "zulu"; x.plan.cproto = "greense"; x.bump();
  const mon = "2026-10-19";
  const w = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d));

  // The book's Progressive SE week, day for day: three circuits, three easy sessions,
  // one rest — and no maximal strength, which it is explicit about.
  a.deepEqual(w.map((p) => p.t), ["se", "hic", "se", "hic", "se", "hic", "off"]);
  a.ok(!w.some((p) => p.t === "lift"), "Zulu's lifting days are set aside");

  // Its rep table, straight off the book's grid.
  const byWeek = (n) => {
    const k = x.weeks().filter((y) => y.kind === "cycle")[n - 1];
    return [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(k.monday, d), d))
      .filter((p) => p.t === "se").map((p) => p.circuits + "x" + p.reps);
  };
  a.deepEqual(byWeek(1), ["3x30", "3x30", "2x35"]);
  a.deepEqual(byWeek(2), ["3x40", "3x40", "2x45"]);
  a.deepEqual(byWeek(3), ["3x50", "3x50", "2x50"]);

  // Setup says the barbell work is parked rather than silently vanishing.
  x.view = "setup";
  a.match(x.vSetup(), /does no barbell work at all/);
  a.doesNotMatch(x.vSetup(), /data-act="half"/, "and the Zulu halves editor is out of the way");

  // Switching off it brings the lifting back.
  x.plan.cproto = "black"; x.bump();
  a.equal(x.dayPlanSlot(mon, 0).t, "lift");
});

test("a circuit that rides on a lifting day is drawn as a circuit, not a bike session", () => {
  const x = app({ now: "2026-10-19" });
  // Four lifting days and a protocol whose only session is a circuit: it has to ride.
  x.plan.stempl = "zulu"; x.bump();
  x.CPROTO.allse = { name: "All SE", book: "test",
    sessions: () => [{ t: "se", circuits: 3, reps: 20, short: "SE 3×20" },
                     { t: "se", circuits: 3, reps: 20, short: "SE 3×20" },
                     { t: "se", circuits: 2, reps: 25, short: "SE 2×25" },
                     { t: "se", circuits: 2, reps: 25, short: "SE 2×25" }] };
  x.plan.cproto = "allse"; x.bump();
  const mon = "2026-10-19";
  const d0 = x.dayPlanSlot(mon, 0);

  a.equal(d0.t, "lift", "still a lifting day");
  a.equal(d0.ride, "se", "with a circuit on it");
  a.equal(d0.circuits, 3);
  a.equal(d0.reps, 20);
  a.ok(!d0.cardio, "and it is not a conditioning-machine session");

  x.sel = mon;
  const h = x.sessionHtml(x.weekOf(mon), d0);
  a.match(h, /Then, conditioning/);
  a.doesNotMatch(h, /Interval timer/, "a circuit gets no interval timer");
  a.ok(h.indexOf("Working weight") < h.indexOf("Then, conditioning"), "lifting first");

  delete x.CPROTO.allse;
});

test("Tactical Barbell III's Base Building is six weeks of SE and E, and nothing else", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.inserts = { "2026-10-19": "bb" }; x.plan.bbVer = { "2026-10-19": "mass" }; x.bump();

  const bb = x.weeks().filter((w) => w.kind === "bb");
  a.equal(bb.length, 6, "six weeks, not TB II's eight");
  a.match(x.weekTitle(bb[0]).t, /Week 1 of 6/, "and the header counts to six");
  a.equal(x.bbLen("mass"), 6);
  a.equal(x.bbLen("standard"), 8, "TB II's is untouched");
  a.equal(x.bbLen("strength"), 8);
  a.equal(x.bbLen(undefined), 8, "and an unset version is the standard one");

  const day = (wk, d) => x.dayPlanSlot(x.addDays(wk.monday, d), d);
  for (const wk of bb) {
    const ds = [0, 1, 2, 3, 4, 5, 6].map((d) => day(wk, d));
    a.deepEqual(ds.map((p) => p.t), ["se", "hic", "se", "hic", "se", "hic", "off"], `week ${wk.w} shape`);
    a.ok(ds.filter((p) => p.t === "hic").every((p) => p.fmt === "liss" && p.eMin === 30 && p.eMax === 30),
      `week ${wk.w}: E is thirty minutes exactly, which the book means as a cap`);
    // No barbell strength week, no HIC, no recovery day: the three things TB II has.
    a.ok(!ds.some((p) => p.bbLift || p.bbHic || p.recovery), `week ${wk.w} has none of TB II's furniture`);
    a.equal(wk.rx, null, `week ${wk.w} takes no wave prescription, having no lifting day`);
  }

  // The book's SE table: reps climb inside the week, loads step up at week four.
  const pct = bb.map((wk) => [0, 2, 4].map((d) => day(wk, d).pct));
  const reps = bb.map((wk) => [0, 2, 4].map((d) => day(wk, d).reps));
  a.deepEqual(reps, Array(6).fill([10, 20, 30]), "ten, twenty, thirty, every week");
  a.deepEqual(pct, [[15, 20, 25], [15, 20, 25], [15, 20, 25], [20, 25, 30], [20, 25, 30], [20, 25, 30]]);
  a.ok(bb.every((wk) => [0, 2, 4].every((d) => day(wk, d).circuits === 3)), "three sets throughout");

  // The percentage reaches the card, because a range to guess at is not what this is.
  const d0 = x.addDays(bb[3].monday, 4); x.sel = d0; x.bump();
  const card = x.seCard(day(bb[3], 4));
  a.match(card, /3 circuits × 30 reps @ 30%/);
  a.match(card, /<b>30% of your one-rep max<\/b>/);
  a.ok(!/roughly 15–30%/.test(card), "the generic range gives way to the block's own number");
  // TB II's block has no percentage, so it keeps the range.
  x.plan.bbVer = { "2026-10-19": "standard" }; x.bump();
  const std = x.weeks().filter((w) => w.kind === "bb");
  a.equal(std.length, 8);
  a.equal(x.dayPlanSlot(std[0].monday, 0).pct, null, "TB II prescribes no percentage");

  // And the block hands back to the cycle after six weeks rather than eight.
  x.plan.bbVer = { "2026-10-19": "mass" }; x.bump();
  const after = x.weeks().filter((w) => w.kind !== "bb")[0];
  a.equal(after.kind, "cycle"); a.equal(after.w, 1);
  a.equal(x.weeks()[6].kind, "cycle", "week seven is the program again");
});

test("3-1-3-1 puts a recovery week after every third training week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false; x.plan.testEvery = 0; x.bump();
  const shape = () => x.weeks().slice(0, 8).map((w) => w.kind === "cycle" ? "w" + w.w : w.kind);

  a.deepEqual(shape(), ["w1", "w2", "w3", "w4", "w5", "w6", "w1", "w2"], "off by default");
  x.plan.recovery313 = true; x.bump();
  a.deepEqual(shape(), ["w1", "w2", "w3", "recovery", "w4", "w5", "w6", "recovery"],
    "six training weeks now take eight, which the book says is the point");
  a.equal(x.weeks()[8].kind, "cycle", "and then the next block starts");
  a.equal(x.weeks()[8].w, 1);

  // The recovery weeks are the back-off, so a scheduled deload on top is suppressed.
  x.plan.deloadEvery = 1; x.bump();
  a.equal(x.weeks().filter((w) => w.kind === "deload").length, 0, "no deload while this is on");
  x.plan.recovery313 = false; x.bump();
  a.ok(x.weeks().filter((w) => w.kind === "deload").length > 0, "and it comes back when this is off");
  x.plan.recovery313 = true; x.plan.deloadEvery = 0; x.bump();

  // What a recovery week is: no barbells, no HIC, two easy sessions, nothing else.
  const r = x.weeks().find((w) => w.kind === "recovery");
  a.equal(x.weekTitle(r).chip, "No barbells, no HIC");
  const ds = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(r.monday, d), d));
  a.ok(!ds.some((p) => p.t === "lift"), "no barbells");
  const cond = ds.filter((p) => p.t === "hic");
  a.equal(cond.length, 2, "two sessions, which is the book's cap");
  a.ok(cond.every((p) => p.fmt === "liss"), "and no HIC among them");
  a.ok(ds.every((p) => p.recovery), "every day knows what week it is in");
  a.ok(!x.weekHasPlyo(r), "and no plyos either, since the point is to recharge the CNS");
});

test("the in-block check is offered only where the book puts it", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.testEvery = 0; x.plan.recovery313 = true; x.bump();

  const flagged = [];
  for (const wk of x.weeks().filter((w) => w.kind === "cycle").slice(0, 6))
    for (let i = 0; i < 7; i++) { const d = x.addDays(wk.monday, i); if (x.inBlockCheck(d)) flagged.push([wk.w, i]) }
  a.deepEqual(flagged, [[3, 4], [6, 4]], "the last lifting day of the weeks a recovery week follows");

  // It is tied to the recovery weeks, so it is silent without them.
  x.plan.recovery313 = false; x.bump();
  a.equal(x.weeks().filter((w) => w.kind === "cycle").slice(0, 6)
    .some((wk) => [0, 1, 2, 3, 4, 5, 6].some((i) => x.inBlockCheck(x.addDays(wk.monday, i)))), false);

  x.plan.recovery313 = true; x.bump();
  const wk3 = x.weeks().filter((w) => w.kind === "cycle")[2];
  const d = x.addDays(wk3.monday, 4); x.sel = d; x.bump();
  const h = x.banners(wk3, x.dayPlanSlot(d, 4));
  a.match(h, /Last lifting day before a recovery week/);
  a.match(h, /heavy-ish single above 95%, or a rep max/);
});

test("Old Warhorse walks its four blocks down the book's volume table", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.stempl = "warhorse"; x.plan.testEvery = 0; x.bump();

  a.equal(x.STEMPL.warhorse.book, "Ageless Athlete");
  a.deepEqual(x.OW_BLOCKS.map((b) => [b.s, b.sMax]), [[5, 10], [4, 8], [4, 5], [3, 4]],
    "high, moderate, moderate, low");
  a.deepEqual(x.OW_BLOCKS.map((b) => b.ia), [true, true, false, false],
    "I/A for the light blocks, Standard Operator once it gets heavy");

  // The percentages stay Operator's; only the volume moves block to block.
  const first = (c) => { const wk = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === c)[0];
    return x.rx(wk, "squat", x.addDays(wk.monday, 0)) };
  for (let c = 1; c <= 4; c++) {
    const r = first(c), b = x.OW_BLOCKS[c - 1];
    a.equal(r.p, x.STEMPL.operator.wave[0].p, `block ${c} keeps Operator's percentage`);
    a.equal(r.s, b.s, `block ${c} sets`);
    a.equal(r.sMax, b.sMax, `block ${c} ceiling`);
    a.match(r.note, new RegExp("Block " + c + " of 4"), `block ${c} says where you are`);
  }
  a.equal(first(5).sMax, 10, "and block five starts the four over");
  // The training-max step is a judgment call in the book, so the app prompts rather
  // than inventing a number.
  a.match(first(2).note, /2 to 5%/);
  a.match(first(4).note, /3-rep max at 100 to 107%/);
});

test("Back Break works up to a best set rather than off a percentage", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false; x.bump();

  for (const [t, k, reps, down] of [["backsquat", "squat", [6, 5, 3], 3], ["backdead", "dead", [5, 4, 3], 2]]) {
    x.plan.stempl = t; x.bump();
    const wks = x.weeks().filter((w) => w.kind === "cycle");
    const lift = [0, 1, 2, 3, 4, 5, 6].map((i) => x.dayPlanSlot(x.addDays(wks[0].monday, i), i)).filter((p) => p.t === "lift");
    a.equal(lift.length, 3, t + ": three days, Operator's");
    a.equal(lift.filter((p) => p.lifts.includes(k)).length, 1, t + ": the lower-body lift runs once a week");
    a.ok(lift[2].lifts.includes(k), t + ": on the last day of the week");

    // Three weeks of top sets, run twice over the six-week block.
    for (let w = 0; w < 6; w++) {
      const wk = wks[w], d = x.addDays(wk.monday, 4), r = x.rx(wk, k, d);
      a.equal(r.top, true, `${t} week ${w + 1} is a top set`);
      a.equal(r.r, reps[w % 3], `${t} week ${w + 1} reps`);
      a.equal(r.down, down, `${t} down sets`);
      a.equal(r.downPct, [80, 85, 90][w % 3], `${t} week ${w + 1} down-set percentage`);
      // Upper body is untouched: it runs Operator's wave as the book says.
      a.equal(x.rx(wk, "bench", d).p, x.STEMPL.operator.wave[w].p, `${t} week ${w + 1} bench`);
      a.ok(!x.rx(wk, "bench", d).top, "and the bench is not a top-set lift");
    }

    // The card has to say so, because there is no percentage to work from.
    const wk = wks[0], d = x.addDays(wk.monday, 4); x.sel = d; x.bump();
    const card = x.liftCard(wk, k, x.dayPlanSlot(d, 4));
    a.match(card, new RegExp("Best " + reps[0] + " of the day"), t + ": the header");
    a.match(card, new RegExp("Work up to your best " + reps[0] + " for today"), t + ": the instruction");
    a.match(card, new RegExp("at 80% of what you just lifted"), t + ": the down sets are off today's set");
    a.ok(!/@ \d+%/.test(card.split("</span></div>")[0]), t + ": and no percentage of a 1RM in the header");
  }
});

test("the Ageless Athlete preset writes settings rather than hiding a mode", () => {
  const x = app({ now: "2026-10-19" });
  a.equal(x.agelessOn(), false);
  x.mutatePlan(x.agelessPreset); x.bump();
  a.equal(x.agelessOn(), true);
  a.equal(x.plan.recovery313, true, "recovery weeks on");
  a.equal(x.plan.basis, "tm", "training max rather than a true 1RM");
  a.equal(x.plan.tmPct, 90);
  a.equal(+x.plan.deloadEvery, 0, "and no scheduled deload, because the recovery weeks are it");

  // Every one of them is an ordinary setting, so undoing one undoes the preset.
  x.plan.recovery313 = false; x.bump();
  a.equal(x.agelessOn(), false, "nothing is locked in");
  a.match(x.vSetup(), /Set all three/, "and Setup offers it again");

  // A training max already lower than 90% is not raised to it.
  x.plan.tmPct = 85; x.mutatePlan(x.agelessPreset); x.bump();
  a.equal(x.plan.tmPct, 85, "a more conservative setting of your own survives");
});

test("TB III's named conditioning sessions are the ones the book provides", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false; x.plan.cproto = "massgreen"; x.bump();

  for (const f of ["predator", "sprints", "reset20", "hillsprint"]) {
    a.ok(x.HIC[f], f + " is a format");
    a.ok(x.IV[f], f + " can be run on the timer");
    const segs = x.ivSegments(f, { ...x.ivOpts("2026-10-20", f), warm: false, cool: false });
    a.ok(segs.length > 2, f + " builds a session");
    a.ok(segs.some((g) => g.k === "work"), f + " has work in it");
  }

  // The Black sessions are short and maximal, so the rests are long on purpose.
  a.equal(x.IV.reset20.work, 20); a.ok(x.IV.reset20.rest >= 120, "two to five minutes between efforts");
  a.deepEqual(x.IV.reset20.rounds, [3, 5]);
  a.deepEqual(x.IV.sprints.rounds, [5, 10]);
  a.deepEqual(x.IV.hillsprint.rounds, [3, 10]);

  // Endurance Predator is the same shape as a FOBBIT, and runs on the same machinery
  // with its own spec rather than a second copy of it.
  const o = x.ivOpts("2026-10-20", "predator");
  a.equal(o.count, "total"); a.equal(o.every, 300, "a sprint every five to ten minutes");
  a.equal(x.specEveryLabel(x.IV.predator), "5 min to 10 min");
  a.deepEqual(o.bouts.map((b) => b.name), ["Sprint 50 to 100 m"]);
  a.equal(o.mins, 45);
  a.equal(o.isE, true, "and at 45 minutes it is an E, which is what the book calls it");
  a.equal(x.hicWasHard({ f: "predator", min: 45 }), false, "so it does not eat a hard day");
  a.equal(x.hicWasHard({ f: "sprints", min: 20 }), true, "a Black session does");

  // It must not borrow the FOBBIT picker just because it reports no distance.
  x.sel = "2026-10-20";
  x.seed({ "2026-10-20": { date: "2026-10-20", hic: { format: "predator", mod: "run" } } }); x.bump();
  const card = x.hicCard({ t: "hic", fmt: "predator" }, "");
  a.ok(!/data-act-fob/.test(card), "no FOBBIT picker on a session that is not a FOBBIT");
  a.ok(!/Pick which FOBBIT/.test(card), "and no invitation to pick one");
  a.match(card, /Hold an easy aerobic base/, "but it still explains the shape");
});

test("TB III's Green and Black protocols respect the book's own limits", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false;

  // Green: no more than three a week, all of them easy, none of them intervals.
  x.plan.stempl = "mass"; x.plan.cproto = "massgreen"; x.bump();
  const g = x.CPROTO.massgreen.sessions({ w: 1 });
  a.equal(g.length, 3, "three, which is the book's cap");
  a.ok(g.every((p) => p.t === "hic"), "all conditioning");
  a.ok(g.every((p) => p.fmt === "liss" || p.fmt === "predator"), "nothing lactic in Green");
  a.ok(g.some((p) => p.mod === "ruck"), "one of them is the ruck");

  // Black: no more than two, and both must stay off lifting days.
  x.plan.cproto = "massblack";
  for (const t of ["specalpha", "specbravo"]) {
    x.plan.stempl = t; x.bump();
    a.equal(x.CPROTO.massblack.sessions({ w: 1 }).length, 2, "two, which is the book's cap");
    const w = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d));
    const cond = w.filter((p) => p.t === "hic");
    a.equal(cond.length, 2, t + ": both scheduled");
    a.ok(!w.some((p) => p.t === "lift" && p.ride), t + ": and neither rides along on a lifting day, which the book forbids");
    a.ok(cond.every((p) => ["sprints", "reset20", "hillsprint"].includes(p.fmt)), t + ": Black sessions only");
  }

  // The second Black session alternates, so both of the book's options get used.
  const seen = new Set();
  for (let w = 1; w <= 4; w++) seen.add(x.CPROTO.massblack.sessions({ w })[1].fmt);
  a.deepEqual([...seen].sort(), ["hillsprint", "reset20"], "RESET-20 and Hill Sprints take turns");
});

test("the Mass template's own layout does not read as a clash", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false; x.plan.stempl = "mass"; x.bump();

  // The book puts the deadlift day straight after day 5. Those are different sessions,
  // so the adjacency rule has to see them as different -- it used to warn about the
  // template's own table, on every protocol.
  const w = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d)).filter((p) => p.t === "lift");
  a.equal(w.length, 4, "four lifting days in a non-peak week");
  a.deepEqual(w.map((p) => p.half), ["a", "a", "a", "b"], "three main days and the deadlift day");
  for (const c of Object.keys(x.CPROTO)) {
    x.plan.cproto = c; x.bump();
    a.deepEqual(x.orderIssues(mon, [0, 1, 2, 3, 4, 5, 6]), [], "mass + " + c);
  }
});

test("TB III's bridge week is a week off, with testing offered rather than imposed", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.inserts = { "2026-11-16": "bridge3" }; x.bump();

  const wk = x.weeks().find((w) => w.kind === "bridge3");
  a.ok(wk, "it can be inserted like any other week");
  a.match(x.weekTitle(wk).t, /Bridge week · TB III/);
  a.equal(x.weekTitle(wk).chip, "A week off");

  const ds = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(wk.monday, d), d));
  a.deepEqual(ds.map((p) => p.t), ["off", "off", "off", "test", "test", "off", "off"],
    "light days, two optional test days on 4 and 5, rest");
  a.ok(ds.every((p) => p.bridge3), "every day knows which week it is in");

  // No training. The book bans weights, HIC and E for the week.
  a.ok(!ds.some((p) => p.t === "lift" || p.t === "hic" || p.t === "se"), "nothing to train");
  for (const p of ds.filter((q) => q.short === "Light")) {
    a.match(p.note, /Light activity only/);
    a.match(p.note, /No weights, no HIC, no E/);
  }
  // The test days say outright that they are optional, because the book does.
  for (const p of ds.filter((q) => q.t === "test")) a.match(p.note, /[Oo]ptional/);
  a.deepEqual(ds[3].lifts, ["squat", "bench"]);
  a.ok(ds[4].lifts.includes("dead"), "and the rest of the cluster on day 5");
  a.equal(ds[4].apply, true, "day 5 is where new maxes get applied");

  // It is one week, inserted, and the program picks up straight after.
  a.equal(x.weeks().filter((w) => w.kind === "bridge3").length, 1);
  a.equal(x.weeks().find((w) => w.monday > wk.monday).kind, "cycle");

  // And it is distinct from the app's own calibration bridge, which is not the book's.
  x.plan.inserts = {}; x.plan.bridge = true; x.bump();
  const own = x.weeks().find((w) => w.kind === "bridge");
  a.ok(own && own.kind !== "bridge3", "two different weeks, not one renamed");
  a.match(x.weekTitle(own).chip, /Calibration/);
});

test("the book's own SE cluster for the TB III block is on offer", () => {
  const x = app({ now: "2026-10-19" });
  a.ok(x.SE_CLUSTERS.mass, "a cluster for it");
  a.deepEqual(x.SE_CLUSTERS.mass.ex, ["Bench press", "Squat", "Romanian deadlift", "Abs"],
    "the General Mass lifts, with the RDL standing in for the deadlift");
  a.match(x.SE_CLUSTERS.mass.note, /conventional deadlift/, "and it says why the deadlift is not in it");
});

test("Specificity Alpha is half maximal strength and half hypertrophy, on the book's table", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.stempl = "specalpha"; x.plan.cproto = "black"; x.bump();

  a.equal(x.cycleWeeks(), 3, "a Specificity block is three weeks");
  const wks = x.weeks().filter((w) => w.kind === "cycle").slice(0, 4);
  const lift = (wk) => [0, 1, 2, 3, 4, 5, 6].map((i) => [i, x.dayPlanSlot(x.addDays(wk.monday, i), i)])
    .filter(([, p]) => p.t === "lift");

  // Days 1, 2, 4 and 5, which is what the book's table shows.
  a.deepEqual(lift(wks[0]).map(([i]) => i), [0, 1, 3, 4]);
  a.deepEqual(lift(wks[0]).map(([, p]) => p.short.replace(/ \+ .*/, "")), ["Spec MS", "Spec H1", "Spec MS", "Spec H2"]);

  // MS days: bench, squat, deadlift. H days: no barbell work at all, just the cluster.
  const [ms1, h1, ms2, h2] = lift(wks[0]).map(([, p]) => p);
  a.deepEqual(ms1.lifts, ["bench", "squat", "dead"], "the standard MS cluster, in the book's order");
  a.deepEqual(ms2.lifts, ["bench", "squat", "dead"]);
  a.deepEqual(h1.lifts, [], "a hypertrophy day has no barbell prescription");
  a.equal(h1.acc, "sp1", "its session is the first half of the H cluster");
  a.equal(h2.acc, "sp2", "and the second half on the other day");
  a.ok(!ms1.acc, "the MS days carry no supplementary work in Alpha");

  // The three-week wave, read off the book's table: 3x6/75, 3x5/80, 3x3/85.
  const want = [[3, 6, 75], [3, 5, 80], [3, 3, 85]];
  const wantDL = [[1, 5, 75], [1, 4, 80], [1, 3, 85]];
  for (let w = 0; w < 3; w++) {
    const wk = wks[w], [i] = lift(wk)[0], d = x.addDays(wk.monday, i);
    for (const k of ["bench", "squat"]) {
      const r = x.rx(wk, k, d);
      a.deepEqual([r.s, r.r, r.p], want[w], `week ${w + 1} ${k}`);
    }
    // The deadlift has its own programming in this block: one work set per session.
    const dl = x.rx(wk, "dead", d);
    a.deepEqual([dl.s, dl.r, dl.p], wantDL[w], `week ${w + 1} deadlift is one work set`);
    // And the H cluster's own numbers.
    a.deepEqual([x.accRxFor(wk).s, x.accRxFor(wk).r, x.accRxFor(wk).p], [[4, 12, 65], [4, 10, 70], [4, 8, 75]][w]);
  }
  // Week four starts the block again rather than running off the end of the table.
  const wk4 = wks[3], d4 = x.addDays(wk4.monday, 0);
  a.deepEqual([x.rx(wk4, "bench", d4).s, x.rx(wk4, "bench", d4).r, x.rx(wk4, "bench", d4).p], [3, 6, 75]);
});

test("Specificity Bravo drops the barbell work and runs its back half heavier", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.stempl = "specbravo"; x.plan.cproto = "black"; x.bump();

  const wks = x.weeks().filter((w) => w.kind === "cycle").slice(0, 3);
  const days = (wk) => [0, 1, 2, 3, 4, 5, 6].map((i) => x.dayPlanSlot(x.addDays(wk.monday, i), i)).filter((p) => p.t === "lift");

  const ds = days(wks[0]);
  a.equal(ds.length, 4, "four days a week");
  a.ok(ds.every((p) => !(p.lifts || []).length), "and not one of them lifts a barbell, which is the point");
  a.deepEqual(ds.map((p) => p.acc), ["sp1", "sp2", "sp1", "sp2"], "each half trained twice a week");

  // The book's table: 50/55, 60/65, 70/75, four to five sets throughout.
  const want = [[12, 50, 55], [10, 60, 65], [8, 70, 75]];
  for (let w = 0; w < 3; w++) {
    const wk = wks[w], [reps, early, late] = want[w];
    const got = days(wk).map((p) => x.accRxFor(wk, p.day));
    a.deepEqual(got.map((r) => r.r), [reps, reps, reps, reps], `week ${w + 1} reps`);
    a.deepEqual(got.map((r) => r.p), [early, early, late, late], `week ${w + 1} runs the back half five percent heavier`);
    a.ok(got.every((r) => r.s === 4 && r.sMax === 5), "four to five sets, the ceiling being yours to take");
  }

  // The day card has to show the ceiling, or the prescription silently loses the "to 5".
  const d = x.addDays(wks[0].monday, 3); x.sel = d; x.bump();
  const card = x.accCard(wks[0], x.dayPlanSlot(d, 3));
  a.match(card, /4–5 × 12 @ 55%/, "the set ceiling and the heavier back half both reach the card");
  a.match(card, /4 or 5 sets of 12/);
});

test("a Specificity hypertrophy day is a session even though it lifts no barbell", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-10-19"; x.plan.bridge = false;
  x.plan.cproto = "black";

  for (const t of ["specalpha", "specbravo"]) {
    x.plan.stempl = t; x.bump();
    const d = x.addDays("2026-10-19", 1); x.sel = d; x.bump();
    const wk = x.weekOf(d), dp = x.dayPlanSlot(d, 1);
    a.equal(dp.t, "lift", t + ": it is a training day");
    a.deepEqual(dp.lifts, [], t + ": with no barbell lifts");
    a.ok(x.accSlots(dp.acc).length >= 4, t + ": and a cluster to work through");
    const card = x.accCard(wk, dp);
    a.match(card, /Supplementary/, t + ": the card prescribes it rather than calling it optional");
    a.ok(!/No accessory slots/.test(card), t + ": and it is not empty");
    // The session view renders without a single liftCard, which is the part most likely
    // to assume a lifting day has lifts.
    a.ok(x.sessionHtml(wk, dp).length > 200, t + ": the day still renders");
  }

  // Two training days back to back is the book's layout, so it must not read as a clash.
  for (const t of ["specalpha", "specbravo"]) {
    x.plan.stempl = t; x.bump();
    a.deepEqual(x.orderIssues("2026-10-19", [0, 1, 2, 3, 4, 5, 6]), [], t + " has no clash");
  }
});

test("Setup counts a template's days even when they depend on the week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "mass"; x.bump();
  const h = x.vSetup();
  // `days` is a function on Mass and Grey Man, so reading `.length` off it gave the
  // function's arity -- every one of them listed as a one-day template.
  for (const [k, n] of [["operator", 3], ["mass", 4], ["greyman", 3], ["specalpha", 4], ["specbravo", 4]]) {
    a.match(h, new RegExp(`<option value="${k}"[^>]*>[^<]*· ${n} days?`), `${k} is listed as ${n} days`);
    a.equal(x.tplDays(x.STEMPL[k], { w: 1 }).length, n);
  }
  a.ok(!/· 1 day ·/.test(h), "and nothing claims to be a one-day template");
});

test("every template and protocol pairing gives a legal week", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  // Start the plan here, so every template is in week 1 of a cycle and showing its
  // fullest week. Without this the matrix ran against a plan that had not begun, Mass
  // never reached its four-day layout, and a clash in it went unseen.
  x.plan.startMonday = mon; x.plan.bridge = false;
  for (const t of Object.keys(x.STEMPL)) for (const c of Object.keys(x.CPROTO)) {
    x.plan.stempl = t; x.plan.cproto = c; x.bump();
    a.equal(x.weekOf(mon).kind, "cycle", `${t} + ${c}: a real training week`);
    const w = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d));
    const tag = `${t} + ${c}`;

    a.equal(w.length, 7, tag);
    a.ok(w.some((p) => p.t === "off"), `${tag} keeps a rest day`);
    // A lifting day must have something to do. Usually that is barbell lifts; on a
    // Specificity hypertrophy day the whole session is the cluster, so an accessory
    // day counts. What is banned is a training day with neither.
    a.ok(!w.some((p) => p.t === "lift" && !(p.lifts || []).length && !p.acc), `${tag}: no empty lifting day`);
    // Every session the protocol asked for is somewhere, on its own day or riding along.
    const want = x.CPROTO[c].sessions({ w: 1 }).length;
    const got = w.filter((p) => p.t === "hic" || p.t === "se" || p.ride).length;
    a.equal(got, want, `${tag} keeps all ${want} conditioning sessions`);
    // And nothing the Move tool would call a clash.
    a.deepEqual(x.orderIssues(mon, [0, 1, 2, 3, 4, 5, 6]), [], `${tag} has no clash`);
  }
});

test("a stale phone cannot overwrite the server just by migrating", () => {
  const x = app({ now: "2026-10-12" });
  // Exactly what happened on 2026-10-12: a device still holding a 30 September plan
  // opened the build that bumped the schema, and uploaded it over eight days of newer
  // prescription. The maxes are the real ones, before and after the bridge week.
  const stale = { schema: 4, startMonday: "2026-09-28", bridge: true,
    maxes: { squat: null, bench: null, pull: 170, ohp: 135, wpu: null, dead: null } };
  const fresh = { schema: 4, startMonday: "2026-09-28", bridge: true,
    maxes: { squat: 255, bench: 235, pull: 165, ohp: 135, wpu: null, dead: 315 } };

  // Boot the way the app boots: off the phone's cached copy. It migrates so the screen
  // is right...
  x.dom.store["ob.cache"] = JSON.stringify({ plan: stale, logs: {}, programs: {} });
  x.outbox = {}; x.plan = x.clone(x.DEF); x.bump();
  a.equal(x.loadLocal(), true, "the cache is loaded");
  a.equal(x.plan.schema, x.SCHEMA);
  // ...but nothing is queued, so it has not claimed the right to win.
  a.deepEqual(Object.keys(x.outbox), [], "and nothing is queued off a cache alone");
  a.equal(x.pending("plan/main"), false);

  // The server answers with the newer plan, which is therefore adopted.
  x.applyState({ plan: fresh, logs: {}, programs: {} });
  a.equal(x.plan.maxes.squat, 255, "the server's maxes survive");
  a.equal(x.plan.maxes.bench, 235);
  a.equal(x.plan.maxes.dead, 315);
  a.equal(x.plan.schema, x.SCHEMA, "and the adopted plan is migrated in turn");
  a.ok("plan/main" in x.outbox, "now it is written back, carrying the right numbers");
  a.equal(JSON.parse(JSON.stringify(x.outbox["plan/main"])).maxes.squat, 255,
    "what goes up is the server's plan, not the phone's");
});

test("an unsent edit still beats the server, which is the point of pending", () => {
  const x = app({ now: "2026-10-12" });
  const server = { schema: x.SCHEMA, maxes: { squat: 255, bench: 235, pull: 165, ohp: 135, wpu: null, dead: 315 } };
  x.plan = x.deepMerge(x.clone(x.DEF), server);
  x.outbox = {}; x.bump();

  // A real change made on this phone and not yet sent.
  x.setPlan("maxes.squat", 275);
  a.equal(x.pending("plan/main"), true, "it is queued");

  // The server's older copy must not wipe it.
  x.applyState({ plan: server, logs: {}, programs: {} });
  a.equal(x.plan.maxes.squat, 275, "the edit you made here is kept");
});

test("the week you were in gets its stamp once it has passed", () => {
  // Monday of cycle 1 week 2, the shape a real account was found in.
  const x = app({ now: "2026-10-12" });
  x.plan.startMonday = "2026-09-28"; x.plan.bridge = true; x.bump();
  x.freezePast();

  const w2 = x.plan.frozen["2026-10-12"];
  a.equal(w2.soft, true, "the week under way is held loosely");
  a.equal(w2.rx, undefined, "so its numbers still follow the plan");
  a.equal(w2.tpl, undefined);

  // Freezing is idempotent: nothing to write on a second pass, or every render would
  // queue one and the app would talk to the server forever.
  a.equal(x.freezePast(), false, "a second pass finds nothing to do");
  a.equal(x.plan.frozen["2026-10-12"].soft, true, "and the current week is still loose");

  const w1 = x.plan.frozen["2026-10-05"];
  a.ok(w1 && !w1.soft, "last week is history");
  a.ok(w1.rx, "and carries the prescription it was trained at");
  a.equal(w1.tpl, "operator", "and the programme it was trained under");

  // Roll on a week. The week that was current has now passed and must gain its stamp —
  // it used to only have `soft` removed, and went on following whatever the plan said.
  x.setToday("2026-10-19");
  x.bump();
  a.equal(x.freezePast(), true, "there is something to write");
  const was = x.plan.frozen["2026-10-12"];
  a.equal(was.soft, undefined, "no longer loose");
  a.ok(was.rx, "it now carries its own prescription");
  a.equal(was.tpl, "operator");
  a.equal(was.cpr, "black");
  a.ok(was.l3, "and which Lift 3 each session used");
  a.equal(was.w, 2, "while keeping what it always was");
  a.equal(was.cycle, 1);

  // Which means changing the plan now cannot rewrite it.
  const before = JSON.stringify(x.plan.frozen["2026-10-12"].rx);
  x.plan.waves.operator[1] = { s: 9, r: 9, p: 99 };
  x.plan.stempl = "fighter"; x.bump();
  a.equal(JSON.stringify(x.plan.frozen["2026-10-12"].rx), before, "the stamp holds");
  a.equal(x.dayPlanSlot("2026-10-12", 0).short, "Op 1", "and the week still reads as Operator");
  a.equal(x.wkRx(x.weekOf("2026-10-12")).p, JSON.parse(before).p, "at the numbers it was done at");
});

test("a cycle's maxes lock on its own last week, not on a hardcoded six", () => {
  const x = app({ now: "2026-10-12" });
  // A three-week wave: cycle 1 ends at week 3, and that is when its maxes lock.
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.waves.operator = [{ s: 3, r: 5, p: 70 }, { s: 3, r: 5, p: 80 }, { s: 3, r: 3, p: 90 }];
  x.bump();
  a.equal(x.cycleWeeks(), 3);

  x.freezePast();
  const last = x.weeks().find((w) => w.kind === "cycle" && w.cycle === 1 && w.w === 3);
  a.ok(last.monday < "2026-10-12", "cycle 1 is behind us");
  a.ok(x.plan.lockedMax[1], "so its maxes are locked");
  a.ok(Object.keys(x.plan.lockedMax[1]).length, "with numbers in them");

  // And it is the week's own wave that decides, not whatever is selected today.
  // Switching to a six-week template must not unlock a cycle that already ended.
  x.plan.lockedMax = {};
  x.plan.stempl = "fighter"; x.bump();
  a.equal(x.waveOf().length, 6, "today's template runs six");
  a.equal(x.plan.frozen[last.monday].tpl, "operator", "but that week ran a three-week one");
  x.freezePast();
  a.ok(x.plan.lockedMax[1], "so cycle 1 still locks on its own last week");
});

test("Fighter HT runs TB III's table, which is per day and not per week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "fighterht"; x.bump();
  const cyc = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1);
  a.equal(cyc.length, 3, "three-week blocks, off the wave's own length");

  const dayOf = (wk, n) => {
    for (let d = 0; d < 7; d++) {
      const date = x.addDays(wk.monday, d), p = x.dayPlanSlot(date, d);
      if (p.t === "lift" && p.day === n) return { date, p };
    }
  };
  const got = (wk, n, k) => { const { date } = dayOf(wk, n); const r = x.rx(wk, k, date);
    return r.s + "x" + r.r + "@" + r.p + (r.amrap ? "+" : ""); };

  // Squat and bench twice a week, deadlift on its own day.
  a.deepEqual(dayOf(cyc[0], 1).p.lifts, ["squat", "bench"]);
  a.deepEqual(dayOf(cyc[0], 2).p.lifts, ["squat", "bench"]);
  a.deepEqual(dayOf(cyc[0], 3).p.lifts, ["dead"]);

  // Week 1: everything the same. Week 2: the deadlift day drops to fives.
  a.equal(got(cyc[0], 1, "squat"), "5x8@60");
  a.equal(got(cyc[0], 3, "dead"), "5x8@60");
  a.equal(got(cyc[1], 1, "squat"), "5x6@70");
  a.equal(got(cyc[1], 3, "dead"), "5x5@70", "the deadlift day runs its own numbers");

  // Week 3 finishes on an all-out set of whichever lift the day is named for.
  a.equal(got(cyc[2], 1, "squat"), "5x3@80+", "squat on day 1");
  a.equal(got(cyc[2], 1, "bench"), "5x3@80", "but not the bench beside it");
  a.equal(got(cyc[2], 2, "bench"), "5x3@80+", "bench on day 2");
  a.equal(got(cyc[2], 2, "squat"), "5x3@80");
  a.equal(got(cyc[2], 3, "dead"), "1x3@80");
  a.match(x.rx(cyc[2], "dead", dayOf(cyc[2], 3).date).note, /ten sets of three/);

  // The generic "deadlift is one to three sets" rule is Operator's, and must not reach
  // a template that prescribes the deadlift itself.
  a.equal(x.rx(cyc[0], "dead", dayOf(cyc[0], 3).date).s, 5);
  a.equal(x.rx(cyc[0], "dead", dayOf(cyc[0], 3).date).sMax, 5);

  // It shows on the card, not just in the data.
  x.sel = dayOf(cyc[2], 1).date;
  const h = x.sessionHtml(cyc[2], dayOf(cyc[2], 1).p);
  a.match(h, /as many reps as you can/i);
});

test("a template without its own table still runs off the wave", () => {
  const x = app({ now: "2026-10-19" });
  for (const t of ["operator", "fighter", "zulu"]) {
    x.plan.stempl = t; x.bump();
    const wk = x.weeks().find((w) => w.kind === "cycle" && w.w === 1);
    const v = x.wkRx(wk);
    const date = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(wk.monday, d))
      .find((dt) => x.dayPlan(dt).t === "lift");
    const r = x.rx(wk, "squat", date);
    a.equal(r.p, v.p, `${t} takes its percentage from the wave`);
    a.equal(r.r, v.r);
    a.equal(r.amrap, false, `${t} has no all-out set`);
    a.equal(r.note, null);
    // And Operator's deadlift rule still applies where no template overrides it.
    const dd = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(wk.monday, d))
      .find((dt) => (x.dayPlan(dt).lifts || []).includes("dead"));
    if (dd) a.equal(x.rx(wk, "dead", dd).s, 1, `${t} keeps one required deadlift set`);
  }
});

test("a template's own table does not reach into a deload or a retest week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "fighterht";
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  const mon = "2026-10-19";
  x.plan.inserts = { [mon]: "deload" }; x.bump();

  const wk = x.weekOf(mon);
  a.equal(wk.kind, "deload");
  const date = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(mon, d))
    .find((dt) => x.dayPlan(dt).t === "lift");
  const r = x.rx(wk, "squat", date);
  a.equal(r.p, x.plan.deload.p, "a deload is a deload, whatever the template prescribes");
  a.equal(r.r, x.plan.deload.r);
  a.equal(r.amrap, false, "and carries no all-out set");
});

test("a frozen week keeps reading the table it was trained under", () => {
  const x = app({ now: "2026-10-26" });
  x.plan.stempl = "fighterht";
  x.plan.startMonday = "2026-09-28"; x.plan.bridge = false; x.bump();
  x.freezePast();

  // Week 2's deadlift day is where Fighter HT diverges from its own wave, so it is the
  // day that tells the two apart.
  const w2 = x.weeks().find((w) => w.kind === "cycle" && w.w === 2);
  a.ok(w2.monday < "2026-10-26", "it is behind us");
  a.equal(x.plan.frozen[w2.monday].tpl, "fighterht");
  const dd = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(w2.monday, d))
    .find((dt) => (x.dayPlanSlot(dt, x.slotOf(dt)).lifts || []).includes("dead"));
  const before = x.rx(x.weekOf(dd), "dead", dd);
  a.equal(before.s + "x" + before.r, "5x5", "the deadlift day's own numbers");

  // Switch to a template with no table of its own. History must not start reading it.
  x.plan.stempl = "operator"; x.bump();
  const after = x.rx(x.weekOf(dd), "dead", dd);
  a.equal(after.s + "x" + after.r, "5x5", "still Fighter HT's, because that is what was done");
});

test("Grey Man alternates A-B-A then B-A-B, with its own supplementary numbers", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "greyman"; x.bump();
  const cyc = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1);
  a.equal(cyc.length, 3, "three-week blocks");

  const week = (wk) => [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(wk.monday, d), d))
    .filter((p) => p.t === "lift");

  // The book's GM exercise schedule: the pair that opens the week swaps every week.
  a.deepEqual(week(cyc[0]).map((p) => p.short), ["GM A", "GM B", "GM A"]);
  a.deepEqual(week(cyc[1]).map((p) => p.short), ["GM B", "GM A", "GM B"], "swapped over");
  a.deepEqual(week(cyc[2]).map((p) => p.short), ["GM A", "GM B", "GM A"], "and back");
  a.deepEqual(week(cyc[0])[0].lifts, ["bench", "squat"]);
  a.deepEqual(week(cyc[0])[1].lifts, ["ohp", "dead"]);

  // Main lifts and supplementary work run different numbers, both off the book's table.
  const main = cyc.map((wk) => { const v = x.wkRx(wk); return v.s + "-" + v.sMax + "x" + v.r + "@" + v.p });
  a.deepEqual(main, ["4-5x8@70", "4-5x6@75", "4-5x3@80"]);
  const supp = cyc.map((wk) => { const v = x.accRxFor(wk); return v.s + "x" + v.r + "@" + v.p });
  a.deepEqual(supp, ["4x12@55", "4x10@60", "4x8@65"]);

  // Each day's supplementary cluster is its own list, and A days share one.
  a.equal(week(cyc[0])[0].acc, "gm1");
  a.equal(week(cyc[0])[1].acc, "gm2");
  a.equal(week(cyc[0])[2].acc, "gm1", "both A days draw on the same cluster");
});

test("a prescribed supplementary cluster is not skipped on a heavy week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "greyman"; x.bump();
  // The book's Grey Man tops out at 80%, which is not a heavy week by the app's
  // reckoning — but the wave is yours to edit, so this is reachable by anyone who
  // pushes week 3 up, and silently dropping their programmed work would be wrong.
  x.plan.waves.greyman = x.clone(x.STEMPL.greyman.wave);
  x.plan.waves.greyman[2].p = 90; x.bump();
  const heavy = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1)[2];
  a.equal(x.tier(+x.wkRx(heavy).p), "heavy", "week 3 is now a heavy week");

  const date = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(heavy.monday, d))
    .find((dt) => x.dayPlan(dt).t === "lift");
  x.sel = date;
  const card = x.accCard(heavy, x.dayPlan(date));
  a.doesNotMatch(card, /Skip them/, "Grey Man programmes it, so it happens");
  a.match(card, /Supplementary/, "and it is called what the book calls it");
  a.match(card, /4 × 8 @ 65%/, "with the numbers on it");
  // And no note weighing up whether to drop them: the book programmed this work, so
  // there is nothing for the reader to judge and nothing for us to say about it.
  a.doesNotMatch(card, /Heavy week\./, "a programmed template is told nothing about cutting back");

  // Operator's accessories are the unprogrammed kind. They used to be hidden on a
  // heavy week on our say-so; no book says that, so they are shown with what the book
  // does say and the decision is left where TB1 leaves it.
  x.plan.stempl = "operator"; x.bump();
  const oh = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "heavy");
  const od = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(oh.monday, d))
    .find((dt) => x.dayPlan(dt).t === "lift");
  x.sel = od;
  const ocard = x.accCard(oh, x.dayPlan(od));
  a.doesNotMatch(ocard, /Skip them\. Heavy week/, "the week does not decide any more");
  a.match(ocard, /Heavy week\./, "it is still flagged as one");
  a.match(ocard, /affecting your main lifts/, "with TB1's actual test");
  a.match(ocard, /<b>Ours:<\/b>/, "and our part of it labelled as ours");
  a.match(ocard, /data-act="accskip"/, "and one tap to skip if the test is failed");
  a.match(ocard, /acc-slot/, "the accessories themselves are there to do");
  a.equal(x.accRxFor(oh), null, "because it prescribes nothing");
});

test("the accessory editor lists each cluster once, not once per day", () => {
  const x = app({ now: "2026-10-19" });
  for (const [t, want] of [["operator", 3], ["fighter", 2], ["zulu", 2], ["greyman", 2], ["fighterht", 2]]) {
    x.plan.stempl = t; x.bump();
    const card = x.accSetupCard();
    const keys = [...card.matchAll(/data-act-accadd="(\w+)"/g)].map((m) => m[1]);
    a.equal(keys.length, want, `${t} shows ${want} cluster(s)`);
    a.equal(new Set(keys).size, keys.length, `${t} shows no cluster twice`);
  }
});

test("the supplementary table belongs to the week that ran it", () => {
  const x = app({ now: "2026-10-26" });
  x.plan.stempl = "greyman";
  x.plan.startMonday = "2026-09-28"; x.plan.bridge = false; x.bump();
  x.freezePast();

  // Week 2's supplementary numbers differ from week 1's, so it tells the two apart.
  const w2 = x.weeks().find((w) => w.kind === "cycle" && w.w === 2);
  a.ok(w2.monday < "2026-10-26", "it is behind us");
  a.equal(x.plan.frozen[w2.monday].tpl, "greyman");
  a.equal(x.accRxFor(w2).r, 10, "week 2 is four sets of ten");

  // Switch to a template with no supplementary programming. History keeps its own.
  x.plan.stempl = "operator"; x.bump();
  a.equal(x.accRxFor(x.weekOf(w2.monday)).r, 10, "still Grey Man's, because that is what was done");

  // And a week that is not part of a cycle has no supplementary table to read: a deload
  // has no week number, and reading one off it would hand back week one's numbers.
  x.plan.stempl = "greyman";
  x.plan.inserts = { "2026-11-02": "deload" }; x.bump();
  const dl = x.weekOf("2026-11-02");
  a.equal(dl.kind, "deload");
  a.equal(dl.w, undefined, "with no week number of its own");
  a.equal(x.accRxFor(dl), null, "so it is given none");
  a.equal(x.accRxFor(null), null);
});

test("the Copenhagen plank is a core option, loaded by bodyweight", () => {
  const x = app({ now: "2026-10-19" });
  a.equal(x.ALIB.copen.slot, "core", "it fills the core job");
  a.ok(x.accFor("core").includes("copen"), "and is offered wherever core is");
  a.equal(x.accAll().copen.name, "Copenhagen plank");
  // Held against a bench, not loaded, so the weight field should not ask for a number.
  a.equal(x.isBWAcc("copen"), true);

  // It can be picked and logged like any other.
  const mon = "2026-10-19";
  x.setPlan("accPick.mon.core", "copen"); x.bump();
  a.equal(x.accOn(mon, "core"), "copen");
  x.sel = mon;
  a.match(x.accSlotRow(mon, "core"), /Copenhagen plank/);
  x.setLog(mon, "acc.sets.core", [{ r: 30 }]);
  a.match(x.accSlotRow(mon, "core"), /placeholder="bw"/, "weight reads as bodyweight");
});

test("a context another app interrupted is woken, not left asleep", async () => {
  const x = app({ now: "2026-10-19" });
  x.unlockAudio();
  await settle();
  a.equal(x.audio.ctx.state, "running");

  // What starting Spotify does on a phone: WebKit moves the page's context to a state
  // of its own that is neither running nor suspended. Checking only for "suspended"
  // left it there, and the beep went nowhere for the rest of the session.
  x.audio.ctx.state = "interrupted";
  x.audio.tones.length = 0;
  const r = x.beep();
  a.equal(r.tones, "resuming", "it is woken rather than written off");
  a.equal(x.audio.tones.length, 0, "and nothing is scheduled against the stale clock");
  await settle();
  a.equal(x.audio.ctx.state, "running", "it comes back");
  a.equal(x.audio.tones.length, 3, "and the beep goes out");

  // The same for the check that runs when the app returns to the foreground.
  x.audio.ctx.state = "interrupted";
  a.equal(x.audioAwake(), true);
  await settle();
  a.equal(x.audio.ctx.state, "running");
  a.equal(x.audioAwake(), true, "and an already-running context is simply fine");
});

test("the Silent tag hands back the speaker-sharing mode, not the seizing one", () => {
  const x = app({ now: "2026-10-07" });
  x.plan.soundMode = "silent"; x.bump();
  x.startRest("squat", "Squat · set 2", 180, "Rest");
  x.unquiet();
  a.equal(x.soundMode(), "duck",
    "the tap means 'let me hear it', not 'stop my music'");
});

test("reverse hyper, Cossack squat and the RDL that was already there", () => {
  const x = app({ now: "2026-10-19" });
  a.equal(x.ALIB.revhyper.slot, "pchain", "reverse hyper is posterior-chain work");
  a.equal(x.ALIB.cossack.slot, "sleg", "a Cossack squat is single-leg work");
  a.equal(x.ALIB.rdl.slot, "pchain", "and the RDL was there all along");
  a.equal(x.ALIB.slrdl.slot, "sleg", "single-leg version too");
  for (const id of ["revhyper", "cossack", "rdl"]) {
    a.ok(x.accFor(x.ALIB[id].slot).includes(id), `${id} is offered`);
    a.ok(x.accAll()[id].gear, `${id} says what it needs`);
  }
});

test("bands are a list you keep, because a colour is not a number", () => {
  const x = app({ now: "2026-10-19" });
  a.deepEqual(x.bands(), [], "nothing assumed to start with");
  // A brand that is not on file adds nothing, rather than quietly seeding some other.
  a.equal(x.bandSeed("nope"), 0);
  a.equal(x.bandSeed(), 0);
  a.deepEqual(x.bands(), [], "still nothing");

  a.equal(x.bandAdd("Red", 35), true);
  a.equal(x.bandAdd("Red", 40), false, "no two bands by the same name");
  a.equal(x.bandAdd("", 35), false);
  a.equal(x.bandAdd("Blue", 0), false, "and a band has to weigh something");
  a.deepEqual(x.bands(), [{ n: "Red", w: 35 }]);
  a.equal(x.bandRemove("Red"), true);
  a.equal(x.bandRemove("Red"), false);

  // Seeding uses a maker's own chart. Rogue lists Red twice, which is exactly why the
  // number lives beside the colour rather than being looked up from it.
  a.equal(x.bandSeed("rogue"), 8);
  const reds = x.bands().filter((b) => /Red/.test(b.n));
  a.equal(reds.length, 2, "two different Reds");
  a.notEqual(reds[0].w, reds[1].w, "at very different weights");
  a.equal(x.bandSeed("rogue"), 0, "seeding twice adds nothing");

  // Three makers, and every band names its brand so two charts can live side by side.
  a.deepEqual(Object.keys(x.BAND_PRESETS), ["rogue", "elitefts", "westside"]);
  a.equal(x.bandSeed("elitefts") > 0, true);
  a.equal(x.bandSeed("westside") > 0, true);
  const names = x.bands().map((b) => b.n);
  a.equal(new Set(names).size, names.length, "no two bands share a name across brands");
  for (const want of ["Rogue", "elitefts", "Westside"]) {
    a.ok(names.some((v) => v.startsWith(want)), `${want} bands are labelled as theirs`);
  }

  // elitefts and Westside publish ranges, not figures. A range is not a log entry, so
  // the midpoint is seeded and the range is what the card shows.
  const mini = x.BAND_PRESETS.westside.bands.find((b) => b.n === "Westside Mini");
  a.equal(mini.w, undefined, "no single published figure");
  a.equal(x.bandPresetW(mini), 50, "the middle of 30 to 70");
  a.equal(x.bandPresetLabel(mini), "30\u201370", "and the range is what is shown");
  a.equal(x.bandPresetLabel(x.BAND_PRESETS.rogue.bands[0]), "9", "Rogue's is a figure");

  // In kg the chart is converted, because it is published in pounds and this is new
  // data being made, not a stored number being rewritten.
  const k = app({ now: "2026-10-19" });
  k.plan.unit = "kg"; k.bump();
  k.bandSeed("rogue");
  a.equal(k.bands()[0].w, Math.round(9 * 0.4536 * 2) / 2);
  a.ok(k.bands()[7].w < 110, "and the heaviest is a kg number, not a pound one");
});

test("a band fills the weight on a band exercise, and leaves typed numbers alone", () => {
  const x = app({ now: "2026-10-19" });
  a.equal(x.isBandEx("pullapart"), true, "gear says Band");
  a.equal(x.isBandEx("facepull"), true, "cable or band counts");
  a.equal(x.isBandEx("bbcurl"), false);

  x.bandAdd("Green", 40);
  const mon = "2026-10-19";
  x.setPlan("accPick.mon.rdelt", "pullapart"); x.bump();
  x.sel = mon;
  a.match(x.accSlotRow(mon, "rdelt"), /data-act-band="rdelt"/, "the picker is offered");
  a.match(x.accSlotRow(mon, "rdelt"), /Green · 40/);

  // Nothing offered where there are no bands on file, or the movement uses none.
  x.setPlan("accPick.mon.biceps", "bbcurl"); x.bump();
  a.doesNotMatch(x.accSlotRow(mon, "biceps"), /data-act-band/, "a barbell curl needs no band");
});

test("two accessory jobs can be supersetted, and only in ways that make sense", () => {
  const x = app({ now: "2026-10-19" });
  const day = "mon", slots = x.accSlots(day);
  a.deepEqual(x.accGroups(day), slots.map((s) => [s]), "one at a time by default");

  // Pair the last two.
  const [a1, b1] = slots.slice(-2);
  a.equal(x.accSuperToggle(day, a1), true);
  a.deepEqual(x.accGroups(day).slice(-1), [[a1, b1]]);
  a.equal(x.accIsSuper(day, a1), true);
  a.equal(x.accIsSuper(day, b1), false, "the second half is not itself a pair");

  // The last job has nothing after it, and a job already in a pair cannot start another.
  a.equal(x.accCanSuper(day, b1), false);
  a.equal(x.accSuperToggle(day, b1), false);
  // Nor can the one before, because that would quietly steal the first half of a pair.
  a.equal(x.accCanSuper(day, slots[slots.length - 3]), false);
  a.equal(x.accSuperToggle(day, slots[slots.length - 3]), false);
  a.deepEqual(x.accGroups(day).slice(-1), [[a1, b1]], "so the pair is untouched");

  // Unpairing works and puts both back on their own.
  a.equal(x.accSuperToggle(day, a1), true);
  a.deepEqual(x.accGroups(day), slots.map((s) => [s]));

  // Removing a job cannot leave a pair pointing at nothing: it is positional.
  x.accSuperToggle(day, a1);
  x.setPlan("accSlots.mon", slots.slice(0, -1)); x.bump();
  a.ok(x.accGroups(day).every((g) => g.every(Boolean)), "no hole where the pair was");
  a.deepEqual(x.accGroups(day).slice(-1), [[a1]], "and the survivor stands alone");
});

test("a superset is one step in session mode, finished when both jobs are", () => {
  const x = app({ now: "2026-09-07" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  const mon = "2026-09-07", slots = x.accSlots("mon");
  const [a1, b1] = slots.slice(-2);
  x.accSuperToggle("mon", a1);
  x.ls = { date: mon, i: 0, warm: false };

  const steps = x.lsSteps(mon).filter((s) => s.type === "acc");
  a.equal(steps.length, slots.length - 1, "the pair is one step, not two");
  const pair = steps.find((s) => s.slot === a1);
  a.equal(pair.pair, b1);

  x.ls.i = x.lsSteps(mon).findIndex((s) => s.type === "acc" && s.slot === a1);
  x.lsRender();
  const h = x.dom.made["ls-in"].innerHTML;
  a.match(h, /Superset/);
  a.match(h, new RegExp(`data-lsaccex="${a1}"`), "both jobs on the one screen");
  a.match(h, new RegExp(`data-lsaccex="${b1}"`));

  // Not done until both are.
  a.equal(x.lsStepDone(pair), false);
  x.setLog(mon, "acc.done." + a1, true);
  a.equal(x.lsStepDone(pair), false, "half a superset is not a superset");
  x.setLog(mon, "acc.done." + b1, true);
  a.equal(x.lsStepDone(pair), true);

  // Done marks both, and writes nothing to the lifts.
  x.setLog(mon, "acc.done." + a1, null); x.setLog(mon, "acc.done." + b1, null);
  x.lsAct("done", { dataset: {} });
  a.equal(x.accDone(mon, a1), true);
  a.equal(x.accDone(mon, b1), true, "both, from one tap");
  a.equal(((x.logs[mon].lifts || {}).undefined), undefined, "and no phantom lift was logged");
});

test("every template reaches the posterior chain somewhere in its week", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  for (const t of Object.keys(x.STEMPL)) {
    x.plan.stempl = t; x.bump();
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(mon, d), d))
      .filter((p) => p.t === "lift");
    const jobs = new Set();
    for (const p of days) for (const sl of (p.acc ? x.accSlots(p.acc) : [])) jobs.add(sl);
    const lifts = new Set(days.flatMap((p) => p.lifts || []));
    // Either a hamstring job, or the deadlift itself — Fighter HT gives the deadlift a
    // session of its own, which is the same need met a different way.
    a.ok(jobs.has("pchain") || lifts.has("dead"),
      `${t} trains the posterior chain: jobs ${[...jobs]}, lifts ${[...lifts]}`);
  }

  // The two that had neither now have the job, on the day that lacks a hinge.
  a.ok(x.accSlots("z1").includes("pchain"), "Zulu's squat-and-bench day");
  a.ok(!x.accSlots("z2").includes("pchain"), "and not the day that already deadlifts");
  a.ok(x.accSlots("gm1").includes("pchain"), "Grey Man's bench-and-squat day");
  a.ok(!x.accSlots("gm2").includes("pchain"), "and not its overhead-and-deadlift day");

  // The book caps Grey Man's supplementary clusters at four to six exercises, and that
  // cap is the thing to honour when something has to give.
  const gm = x.accSlots("gm1").length + x.accSlots("gm2").length;
  a.ok(gm >= 4 && gm <= 6, `Grey Man runs ${gm} supplementary exercises, the book says 4 to 6`);
  a.ok(!x.accSlots("gm1").includes("sleg"), "single-leg gave way to it: Grey Man squats that day");
});

test("Mass runs three sessions and a deadlift day, and drops one in the peak week", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.l3 = { on: { pull: true, ohp: true, wpu: true }, primary: "pull" };
  x.plan.maxes.wpu = 45;
  x.plan.stempl = "mass"; x.bump();
  const cyc = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1);
  a.equal(cyc.length, 3);
  const lifts = (wk) => [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlanSlot(x.addDays(wk.monday, d), d))
    .filter((p) => p.t === "lift");

  // Bench, squat and the weighted pull-up three times a week; the deadlift on its own.
  a.equal(lifts(cyc[0]).length, 4, "four lifting days");
  a.deepEqual(lifts(cyc[0])[0].lifts, ["bench", "squat", "wpu"]);
  a.deepEqual(lifts(cyc[0])[3].lifts, ["dead"], "the deadlift gets a day to itself");

  // Week three drops the third session: the book's table leaves that cell empty.
  a.equal(lifts(cyc[2]).length, 3, "three in the peak week");
  a.deepEqual(lifts(cyc[2]).map((p) => p.short), ["Mass 1", "Mass 2", "Mass DL"]);

  const got = (wk, n, k) => {
    const day = lifts(wk)[n - 1];
    const date = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays(wk.monday, d))
      .find((dt) => x.dayPlanSlot(dt, x.slotOf(dt)).short === day.short);
    const r = x.rx(wk, k, date);
    return r.s + "x" + r.r + "@" + r.p + (r.amrap ? "+" : "");
  };
  a.equal(got(cyc[0], 1, "squat"), "4x8@65");
  a.equal(got(cyc[0], 4, "dead"), "4x5@65", "the deadlift day runs fives, not eights");
  a.equal(got(cyc[1], 4, "dead"), "4x5@75");
  a.equal(got(cyc[2], 1, "squat"), "4x3@80+", "squat peaks on day one");
  a.equal(got(cyc[2], 1, "bench"), "4x3@80", "and only the squat");
  a.equal(got(cyc[2], 2, "bench"), "4x3@80+", "bench on day two");
  a.equal(got(cyc[2], 3, "dead"), "1x3@80");
});

test("Mass takes the weighted pull-up when you have one and a pull when you do not", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "mass";
  // The book: weighted pull-ups if you can do twelve bodyweight, otherwise a row, an
  // RDL "or some other pull". Never the overhead press — every substitute it names pulls.
  x.plan.l3 = { on: { pull: true, ohp: true, wpu: false }, primary: "ohp" };
  x.bump();
  a.deepEqual(x.dayPlanSlot("2026-10-19", 0).lifts, ["bench", "squat", "pull"],
    "no weighted pull-up on file, so a pull stands in");

  x.plan.l3 = { on: { pull: false, ohp: false, wpu: true }, primary: "wpu" };
  x.bump();
  a.deepEqual(x.dayPlanSlot("2026-10-19", 0).lifts, ["bench", "squat", "wpu"]);
});

test("a template's lifting days can move week to week, not just what is on them", () => {
  const x = app({ now: "2026-10-19" });
  // Fixed slots stay fixed, however the week is numbered.
  a.deepEqual(x.tplSlots(x.STEMPL.operator, { w: 1 }), [0, 2, 4]);
  a.deepEqual(x.tplSlots(x.STEMPL.operator, { w: 3 }), [0, 2, 4]);
  // Mass's move, and the count matches the days it offers that week.
  a.deepEqual(x.tplSlots(x.STEMPL.mass, { w: 1 }), [0, 2, 4, 5]);
  a.deepEqual(x.tplSlots(x.STEMPL.mass, { w: 3 }), [0, 2, 5]);
  for (const w of [1, 2, 3, 4, 5, 6]) {
    const wk = { w };
    a.equal(x.tplSlots(x.STEMPL.mass, wk).length, x.tplDays(x.STEMPL.mass, wk).length,
      `week ${w}: a slot for every day`);
  }
  // A template that declares neither gets evenly spaced days rather than nothing.
  a.deepEqual(x.tplSlots({ days: [1, 2, 3] }, { w: 1 }, [1, 2, 3]), [0, 2, 4]);
});

test("Gladiator runs two pairs twice a week and peaks each lift once", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.stempl = "gladiator"; x.bump();
  const cyc = x.weeks().filter((w) => w.kind === "cycle" && w.cycle === 1);
  const days = (wk) => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, p: x.dayPlanSlot(x.addDays(wk.monday, d), d) }))
    .filter((o) => o.p.t === "lift");

  a.deepEqual(days(cyc[0]).map((o) => o.d), [0, 1, 3, 4], "the book's days 1, 2, 4 and 5");
  // Day 1 is the one the book names outright: squat and overhead press.
  a.deepEqual(days(cyc[0])[0].p.lifts, ["squat", "ohp"]);
  a.deepEqual(days(cyc[0])[1].p.lifts, ["bench", "dead"]);
  a.deepEqual(days(cyc[0])[2].p.lifts, ["squat", "ohp"], "each pair runs twice");
  a.deepEqual(days(cyc[0])[3].p.lifts, ["bench", "dead"]);

  // 4-5 sets in the build weeks, a flat 4 in the peak week.
  const r = (wk, i, k) => x.rx(wk, k, x.addDays(wk.monday, days(wk)[i].d));
  a.equal(r(cyc[0], 0, "squat").sMax, 5);
  a.equal(r(cyc[2], 0, "squat").sMax, 4, "no optional fifth set in the peak week");
  a.deepEqual(cyc.map((wk) => r(wk, 0, "squat").p), [60, 70, 80]);

  // Week three peaks one lift a session, and every lift in the cluster gets a turn.
  const peaked = [];
  for (let i = 0; i < 4; i++) for (const k of days(cyc[2])[i].p.lifts) {
    if (r(cyc[2], i, k).amrap) peaked.push(k);
  }
  a.deepEqual(peaked, ["squat", "bench", "ohp", "dead"], "one each, in the book's order");

  // Its paired days are the template, as Zulu's are, so the week reads clean.
  a.deepEqual(x.orderIssues(cyc[0].monday, [0, 1, 2, 3, 4, 5, 6]), []);

  // The deadlift is a programmed lift here, not Operator's one-to-three-set afterthought.
  a.equal(r(cyc[0], 1, "dead").s, 4);
});

test("onboarding describes every template and protocol and lets you pick", () => {
  const x = app({ now: "2026-10-19" });
  x.wz = x.wzNew(false);
  x.wz.step = 1;
  const h = x.vWelcome();

  // Every one of them is offered, named, and described rather than listed as a code.
  for (const [k, T] of Object.entries(x.STEMPL)) {
    a.match(h, new RegExp(`data-k="stempl" data-v="${k}"`), `${k} can be chosen`);
    a.ok(h.includes(x.esc(T.name)) && h.includes(x.esc(T.blurb)), `${k} is described`);
  }
  for (const [k, P] of Object.entries(x.CPROTO)) {
    a.match(h, new RegExp(`data-k="cproto" data-v="${k}"`), `${k} can be chosen`);
    a.ok(h.includes(x.esc(P.blurb)), `${k} is described`);
  }
  a.match(h, /Base Building/, "and Base Building is on offer at onboarding");
  a.match(h, /data-act-change="wzbb"/);

  // Seven steps, each reachable and none blank.
  a.equal(x.WZ_STEPS.length, 8);
  a.ok(x.WZ_STEPS.includes("Plyos"), "plyos get a step of their own");
  for (let i = 0; i < 8; i++) { x.wz.step = i; a.ok(x.vWelcome().length > 400, `step ${i} draws`) }
});

test("the books' own objections to a pairing are shown before you commit to it", () => {
  const x = app({ now: "2026-10-19" });
  const t = (st, cp, bb) => x.programWarnings(st, cp, bb).map((w) => w.k);

  a.deepEqual(t("operator", "black", false), [], "the default pairing has nothing to say");
  // TB II: "I don't recommend using TB Mass template here... no more than 2 HIC per week."
  a.deepEqual(t("mass", "black", false), ["mass-black"]);
  // TB II: "Gladiator template can be used, but I recommend using a training max."
  a.deepEqual(t("gladiator", "black", false), ["glad-black"]);
  // TB III: "Green is used alongside General Mass... Black is used during Specificity."
  a.deepEqual(t("fighterht", "black", false), ["mass-black-soft"]);
  a.deepEqual(t("greyman", "black", false), ["mass-black-soft"]);
  // TB II's Green guidelines ask for two strength sessions a week.
  a.deepEqual(t("zulu", "green", false), ["green-days"]);
  a.deepEqual(t("fighter", "green", false), [], "Fighter's two days are what Green asks for");
  // A protocol that does no barbell work at all, against any template.
  a.deepEqual(t("operator", "greense", false), ["nostrength"]);
  a.ok(t("operator", "black", true).includes("bb"), "and Base Building says what it displaces");

  // Text, not codes: every warning reads as a sentence and names the thing it is about.
  for (const w of x.programWarnings("mass", "black", true)) {
    a.ok(w.text.length > 60 && /\.$/.test(w.text.trim()), `${w.k} is a sentence`);
  }
  a.equal(x.programWarnings("nope", "black", false).length, 0, "an unknown template warns nothing");

  // Shown while choosing, and again on the summary, which is the last chance to notice.
  x.wz = x.wzNew(false); x.wz.stempl = "mass"; x.wz.cproto = "black";
  x.wz.step = 1; a.match(x.vWelcome(), /advises against Mass with Black/);
  x.wz.step = 7; a.match(x.vWelcome(), /advises against Mass with Black/);
  // And in Setup, because the pairing can be changed there too.
  x.plan.stempl = "mass"; x.plan.cproto = "black"; x.view = "setup"; x.bump();
  a.match(x.vSetup(), /advises against Mass with Black/);
});

test("onboarding can start you on Base Building, after the bridge week if there is one", () => {
  const x = app({ now: "2026-10-19" });
  x.wz = x.wzNew(false);
  x.wz.start = "2026-10-26"; x.wz.mode = "bridge"; x.wz.bb = true;
  x.wz.stempl = "fighter"; x.wz.cproto = "green";
  x.wzFinish();

  a.equal(x.plan.stempl, "fighter", "the template is saved");
  a.equal(x.plan.cproto, "green");
  a.equal(x.plan.bridge, true);
  // Base Building needs numbers for its two strength days, so it follows the bridge.
  a.equal(x.plan.inserts["2026-10-26"], undefined, "not on the bridge week");
  a.equal(x.plan.inserts["2026-11-02"], "bb", "the week after it");
  const wks = x.weeks();
  a.equal(wks.find((w) => w.monday === "2026-10-26").kind, "bridge");
  a.equal(wks.find((w) => w.monday === "2026-11-02").kind, "bb");
  a.equal(wks.filter((w) => w.kind === "bb").length, 8, "eight weeks of it");

  // With maxes already known there is no bridge, so it starts straight away.
  const y = app({ now: "2026-10-19" });
  y.wz = y.wzNew(false);
  y.wz.start = "2026-10-26"; y.wz.mode = "maxes"; y.wz.bb = true;
  y.wz.maxes = { squat: 300, bench: 200, dead: 400, pull: 180 };
  y.wzFinish();
  a.equal(y.plan.inserts["2026-10-26"], "bb");
  a.equal(y.weekOf("2026-10-26").kind, "bb");

  // Not asked for, not inserted.
  const z = app({ now: "2026-10-19" });
  z.wz = z.wzNew(false); z.wz.start = "2026-10-26"; z.wzFinish();
  a.deepEqual(Object.values(z.plan.inserts), []);
});

test("the app is written in American English", () => {
  const x = app({ now: "2026-10-19" });
  // Everything a person actually reads: the views, the guide, the release notes.
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  // The rendered views only reach the screens this test happens to draw, so the source
  // itself is what gets scanned: every string the app can ever show, plus the release
  // notes and the markup.
  const src = fs.readdirSync(path.join(__dirname, "..", "src", "app"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => fs.readFileSync(path.join(__dirname, "..", "src", "app", f), "utf8"))
    .join("\n")
    // Comments are written for whoever is building, not shown to anyone training, so
    // they are stripped: this is a test about what the app says, not about prose.
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")
    // One deliberate exception in the code itself: the pre-1.92 spelling is kept as a
    // lookup alias so a mobility list edited before then still resolves. Never shown.
    .replace(/'knee to wall ankle mobilisation'/g, "''");
  const seen = [src, fs.readFileSync(path.join(__dirname, "..", "public", "releases.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8")].join(" ");

  const british = [
    [/\bprogramme/i, "programme"], [/\bcolour/i, "colour"], [/\bbehaviour/i, "behaviour"],
    [/\bfavour/i, "favour"], [/\bmetres?\b/i, "metre"], [/\bcentres?\b/i, "centre"],
    [/\bcancelled/i, "cancelled"], [/\blabelled/i, "labelled"], [/\bwhilst/i, "whilst"],
    [/\bamongst/i, "amongst"], [/\btowards\b/i, "towards"], [/\bneighbour/i, "neighbour"],
    [/\bmobilisation/i, "mobilisation"], [/\bemphasis(e|ing)\b/i, "emphasise"],
    [/\bmaths\b/i, "maths"], [/\bgreyed/i, "greyed"],
  ];
  for (const [re, word] of british) {
    const m = seen.match(re);
    a.equal(m, null, m ? `"${word}" found: ${seen.slice(Math.max(0, seen.indexOf(m[0]) - 50), seen.indexOf(m[0]) + 40)}` : "");
  }

  // Grey Man is the book's name for a template, not a colour, so it stays.
  a.equal(x.STEMPL.greyman.name, "Grey Man");
  a.match(x.vSetup(), /Grey Man/);

  // Someone who edited their mobility list before 1.92 has the old spelling saved in it,
  // and it still has to find the movement it names.
  a.ok(x.mlibEntry("Knee-to-wall ankle mobilisation"), "the old spelling still resolves");
  a.equal(x.mlibEntry("Knee-to-wall ankle mobilisation").name,
          x.mlibEntry("Knee-to-wall ankle mobilization").name, "to the same entry");
});

test("setup asks whether you want plyos at all, and which day", () => {
  const x = app({ now: "2026-10-19" });
  x.wz = x.wzNew(false);
  a.equal(x.wz.plyo, true, "on by default, as the program has always had them");
  a.equal(x.wz.plyoDow, 3, "Thursday by default");

  x.wz.step = 5;
  const h = x.vWelcome();
  a.match(h, /data-act-change="wzplyo"/, "it is a question, not an assumption");
  for (let i = 0; i < 7; i++) a.match(h, new RegExp(`data-act="wzplyoday" data-v="${i}"`), `day ${i} offered`);

  // Turned off, the day picker goes with it.
  x.wz.plyo = false;
  a.doesNotMatch(x.vWelcome(), /data-act="wzplyoday"/, "no day to pick when there are no plyos");
  x.wz.step = 7;
  a.match(x.vWelcome(), /<dt>Plyos<\/dt><dd>none<\/dd>/, "and the summary says so");

  // And it is saved.
  x.wz.plyo = false; x.wz.mode = "maxes"; x.wzFinish();
  a.equal(x.plan.plyoOn, false);
  // A cycle week, not the bridge week: a bridge week never has plyos anyway, so
  // checking one proves nothing about the setting.
  const cyc = x.weeks().find((k) => k.kind === "cycle");
  a.ok(![0, 1, 2, 3, 4, 5, 6].some((d) => x.dayPlan(x.addDays(cyc.monday, d)).plyo),
    "no plyo day anywhere in a cycle week");
  x.plan.plyoOn = true; x.bump();
  a.ok([0, 1, 2, 3, 4, 5, 6].some((d) => x.dayPlan(x.addDays(cyc.monday, d)).plyo),
    "and turning it back on brings them back");

  const y = app({ now: "2026-10-19" });
  y.wz = y.wzNew(false); y.wz.plyo = true; y.wz.plyoDow = 5; y.wzFinish();
  a.equal(y.plan.plyoOn, true);
  a.equal(y.plan.plyoDow, 5);
  a.equal(y.plyoDow(y.mondayOf("2026-10-19")), 5, "and that is where they land");
});

test("plyo placement warns about what is already on the day, and only then", () => {
  const x = app({ now: "2026-10-19" });
  const w = (d, cardio) => x.plyoWarnings("operator", "black", d, cardio || "echo").map((v) => v.k);

  // Operator and Black alternate lift / conditioning, with Sunday off.
  a.deepEqual(x.weekRolesFor("operator", "black"), ["S", "C", "S", "C", "S", "C", "R"]);
  a.deepEqual(w(3), [], "Thursday, the default, is a conditioning day and warns nothing");
  a.deepEqual(w(1), [], "nor any other conditioning day");
  a.deepEqual(w(0), ["lift"], "Monday lifts");
  a.deepEqual(w(6), ["rest"], "Sunday is the only rest day");
  a.deepEqual(w(3, "run"), ["impact"], "running is landing work of its own");
  a.deepEqual(w(0, "run"), ["lift"], "but that only matters on a conditioning day");
  a.deepEqual(w(7), [], "a day outside the week warns nothing");

  // Fighter and Black leave two days clear, so spending one on plyos costs no rest day.
  a.deepEqual(x.weekRolesFor("fighter", "black"), ["S", "C", "R", "S", "C", "R", "C"]);
  a.deepEqual(x.plyoWarnings("fighter", "black", 2, "echo").map((v) => v.k), [],
    "a spare day is a fine place for them");

  // A warning that would be true of every option is no warning at all: in an alternating
  // week every conditioning day follows a lifting day, so that is left to the plyo card.
  for (let d = 0; d < 7; d++) a.ok(!w(d).includes("after-lift"));

  // Setup asks the same question and shows the same warnings.
  x.view = "setup";
  a.match(x.vSetup(), /data-act="plyodow" data-v="5"/);
  a.match(x.vSetup(), /data-pbind="plyoOn"/);
  x.plan.plyoDow = 0; x.bump();
  a.match(x.vSetup(), /already lifts/, "and it says so when the day has lifting on it");
});

test("plyos can run twice a week, splitting the week's contacts rather than doubling them", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const mon = "2026-10-19", wk = x.weekOf(mon);
  const ph = x.plyoPhase(wk);

  a.equal(x.plyoPerWeek(), 1, "one a week unless asked");
  a.deepEqual(x.plyoDows(mon), [3], "Thursday");
  const oneSets = ph.ex.map((e) => x.plyoSets(e, false));

  x.plan.plyoPerWeek = 2; x.bump();
  a.deepEqual(x.plyoDows(mon), [3, 6], "and the second falls 72 hours later by default");
  a.equal(x.plyoGap(3, 6), 3);

  // The week's work is the same, split in two. Not two full sessions.
  const twoSets = ph.ex.map((e) => x.plyoSets(e, false));
  for (let i = 0; i < oneSets.length; i++) {
    a.ok(twoSets[i] <= Math.ceil(oneSets[i] / 2) && twoSets[i] >= 1,
      `${ph.ex[i].label}: ${twoSets[i]} is about half of ${oneSets[i]}, never more`);
  }

  // Both days carry plyos, numbered, and say which session they are.
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlan(x.addDays(mon, d))).filter((p) => p.plyo);
  a.equal(days.length, 2);
  a.deepEqual(days.map((p) => p.plyoN), [1, 2]);
  a.ok(days.every((p) => /Plyo [12]/.test(p.short)), "and are labelled apart");

  // Back to one and the labels lose the number again.
  x.plan.plyoPerWeek = 1; x.bump();
  a.ok(/Plyo(\+|$)/.test(x.dayPlan(x.addDays(mon, 3)).short));
});

test("a second plyo session is warned about when it is too close to the first", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.plyoPerWeek = 2; x.plan.plyoDow = 3; x.bump();
  const k = (d2) => { x.plan.plyoDow2 = d2; x.bump();
    return x.plyoWarnings("operator", "black", 3, "echo").map((w) => w.k) };

  a.deepEqual(k(6), [], "three days apart is fine");
  a.deepEqual(k(1), [], "and so is the other way round");
  a.deepEqual(k(4), ["gap"], "back to back is not");
  a.deepEqual(k(2), ["gap"], "in either direction");
  a.deepEqual(k(3), ["same"], "and the same day is not two sessions at all");

  // With one session a week there is nothing to space out.
  x.plan.plyoPerWeek = 1; x.plan.plyoDow2 = 4; x.bump();
  a.deepEqual(x.plyoWarnings("operator", "black", 3, "echo").map((w) => w.k), []);

  // The week is a loop: Monday and Sunday are next to each other.
  x.plan.plyoPerWeek = 2; x.plan.plyoDow = 0; x.plan.plyoDow2 = 6; x.bump();
  a.equal(x.plyoGap(0, 6), 1, "one day apart, across the week boundary");
  a.deepEqual(x.plyoWarnings("operator", "black", 0, "echo").map((w) => w.k).filter((v) => v === "gap"),
    ["gap"], "and it is flagged as back to back");

  // Both sessions on one day is one session, so only one day carries them.
  x.plan.plyoDow = 3; x.plan.plyoDow2 = 3; x.bump();
  a.deepEqual(x.plyoDows("2026-10-19"), [3], "listed once, not twice");
  a.equal([0, 1, 2, 3, 4, 5, 6].filter((d) => x.dayPlan(x.addDays("2026-10-19", d)).plyo).length, 1);

  x.plan.plyoDow = 3;
  // plyoDow2 unset must not read as Monday: `+null` is 0, which it once did.
  x.plan.plyoPerWeek = 2; x.plan.plyoDow2 = null; x.bump();
  a.equal(x.plyoDow2(), 6, "unset means three days on from the first, not day zero");
  x.plan.plyoDow2 = ""; x.bump();
  a.equal(x.plyoDow2(), 6);
});

test("plyo settings live in Setup, with the rest of the program", () => {
  const x = app({ now: "2026-10-19" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.view = "setup"; x.bump();

  const h = x.vSetup();
  a.match(h, /<h2>Plyometrics<\/h2>/, "a card of its own in Setup");
  a.match(h, /data-pbind="plyoOn"/, "on or off");
  a.match(h, /data-act="plyoper" data-v="2"/, "one session or two");
  a.match(h, /data-act="plyodow" data-v="3"/, "and which day");

  // The reference material is not duplicated here: the Guide has the phases, the
  // exercises and the pull-back rules, and Status has the jump trend.
  a.match(x.vGuide(), /Plyometrics/);
  a.match(x.vGuide(), /Every rep maximal/);
  a.doesNotMatch(h, /Every rep maximal/, "Setup is settings, not a second copy of the Guide");

  // One row of days, with every chosen one lit.
  const lit = (html) => [...html.matchAll(/data-act="plyodow" data-v="(\d)" aria-pressed="true"/g)].map((m) => +m[1]);
  a.deepEqual(lit(h), [3], "one session, one day lit");
  x.plan.plyoPerWeek = 2; x.plan.plyoDow = 3; x.plan.plyoDow2 = 6; x.bump();
  a.deepEqual(lit(x.vSetup()), [3, 6], "two sessions, both lit");

  // Off, and the schedule goes with it.
  x.plan.plyoOn = false; x.bump();
  const off = x.vSetup();
  a.match(off, /data-pbind="plyoOn"/, "still togglable");
  a.doesNotMatch(off, /data-act="plyoper"/, "nothing to schedule when there is none");
});

test("the wizard's plyo step carries both sessions through to the plan", () => {
  const x = app({ now: "2026-10-19" });
  x.wz = x.wzNew(false);
  a.equal(x.wz.plyoPer, 1, "one a week to start");
  a.equal(x.wz.plyoDow2, 6, "with the second day three days on if it is turned on");

  x.wz.step = 5;
  const lit = () => [...x.vWelcome().matchAll(/data-act="wzplyoday" data-v="(\d)" aria-pressed="true"/g)]
    .map((m) => +m[1]);
  a.deepEqual(lit(), [3], "one session, one day lit");
  x.wz.plyoPer = 2;
  a.deepEqual(lit(), [3, 6], "two sessions, both lit at once");

  // It warns off its own unsaved choices, not off whatever the plan happens to hold.
  x.plan.plyoPerWeek = 1; x.plan.plyoDow2 = null; x.bump();
  x.wz.plyoDow = 3; x.wz.plyoDow2 = 4;
  a.match(x.vWelcome(), /back to back/, "the wizard asks about what you just picked");
  x.wz.plyoDow2 = 6;
  a.doesNotMatch(x.vWelcome(), /back to back/);

  // Saved, both of them.
  x.wz.mode = "maxes"; x.wzFinish();
  a.equal(x.plan.plyoOn, true);
  a.equal(x.plan.plyoPerWeek, 2);
  a.equal(x.plan.plyoDow, 3);
  a.equal(x.plan.plyoDow2, 6);
  const cyc = x.weeks().find((k) => k.kind === "cycle");
  a.deepEqual(x.plyoDows(cyc.monday), [3, 6], "and the week runs both");

  // Turned off, neither day nor count is written over what was there.
  const y = app({ now: "2026-10-19" });
  y.plan.plyoPerWeek = 2; y.plan.plyoDow = 1; y.bump();
  y.wz = y.wzNew(false); y.wz.plyo = false; y.wz.mode = "maxes"; y.wzFinish();
  a.equal(y.plan.plyoOn, false);
  a.equal(y.plan.plyoDow, 1, "your old day is still there if you turn them back on");
});

test("a day you tap in the wizard actually looks chosen", () => {
  const x = app({ now: "2026-10-19" });
  x.wz = x.wzNew(false); x.wz.step = 5;
  const lit = () => [...x.vWelcome().matchAll(/data-act="wzplyoday" data-v="(\d)" aria-pressed="true"/g)]
    .map((m) => +m[1]);

  a.deepEqual(lit(), [3], "Thursday starts chosen");

  // A dataset value is a string, and the comparison is against a number. This is the
  // bug: tapping set plyoDow to "5" and "5" === 5 is false, so nothing ever lit up.
  x.wzSet("plyoDow", "5");
  a.strictEqual(x.wz.plyoDow, 5, "stored as a number, not a string");
  a.deepEqual(lit(), [5], "and the day you tapped is the one that looks chosen");

  // The string keys must stay strings.
  x.wzSet("unit", "kg");
  a.strictEqual(x.wz.unit, "kg");
  x.wzSet("deload", "4");
  a.strictEqual(x.wz.deload, 4, "the numeric ones that already worked still do");
});

test("with two sessions both days stay lit, and a third replaces the older", () => {
  const x = app({ now: "2026-10-19" });

  // One session: a tap simply moves it.
  a.deepEqual(x.plyoPick([3], 1, 5), [5]);
  a.deepEqual(x.plyoPick([3], 1, 3), [3], "tapping the chosen day changes nothing");

  // Two: the pair slides, oldest out.
  a.deepEqual(x.plyoPick([3, 6], 2, 0), [6, 0], "Thursday drops, Sunday and Monday remain");
  a.deepEqual(x.plyoPick([6, 0], 2, 2), [0, 2]);
  a.deepEqual(x.plyoPick([3, 6], 2, 3), [3, 6], "tapping a chosen day leaves the pair alone");
  a.deepEqual(x.plyoPick([3], 2, 6), [3, 6], "and a half-set pair just fills up");

  // The week runs them in weekday order whichever order they were picked.
  x.plan.plyoPerWeek = 2; x.plan.plyoDow = 6; x.plan.plyoDow2 = 2; x.bump();
  a.deepEqual(x.plyoDows("2026-10-19"), [2, 6], "sorted, so Plyo 1 is the earlier one");
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => x.dayPlan(x.addDays("2026-10-19", d)))
    .filter((p) => p.plyo);
  a.deepEqual(days.map((p) => p.plyoN), [1, 2], "numbered in the order you meet them");

  // Tapping through Setup writes both days back.
  x.plan.plyoDow = 3; x.plan.plyoDow2 = 6; x.bump();
  x.view = "setup";
  const lit = () => [...x.vSetup().matchAll(/data-act="plyodow" data-v="(\d)" aria-pressed="true"/g)]
    .map((m) => +m[1]);
  a.deepEqual(lit(), [3, 6]);
});

test("a session can be moved onto another day and done after it", () => {
  const x = app({ now: "2026-10-22" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.plyoOn = false; x.bump();
  const thu = "2026-10-22", fri = "2026-10-23";
  a.equal(x.dayPlan(thu).t, "hic", "Thursday conditions");
  a.equal(x.dayPlan(fri).t, "lift", "Friday lifts");

  a.equal(x.setStack(thu, fri), true);

  // The day it came from reads as moved, not as missed.
  const gone = x.dayPlan(thu);
  a.equal(gone.t, "off");
  a.equal(gone.movedTo, fri);
  a.match(gone.note, /being done on Fri/);

  // The day it lands on lifts first and conditions after — the book's order.
  const both = x.dayPlan(fri);
  a.equal(both.t, "lift", "still a lifting day at heart");
  a.equal(both.stacked, thu);
  a.equal(both.ride, "hic");
  a.equal(both.cardio, true);
  a.equal(both.fmt, x.dayPlanSlot(thu, x.slotOf(thu)).fmt, "and it is Thursday's session, not a new one");
  a.match(both.short, /Op 3 \+ Thu/);

  x.sel = fri;
  const h = x.sessionHtml(x.weekOf(fri), both);
  a.ok(h.indexOf("Working weight") < h.indexOf("Then, conditioning"), "lifting first");
  a.match(h, /Interval timer/, "and the conditioning is there to run and log");

  // The other way round too: a lift moved onto a conditioning day. Whichever was moved,
  // the lifting is the base and the conditioning rides on it, because the book asks for
  // the strength work first either way.
  x.clearStack(thu);
  const mon = "2026-10-19", tue = "2026-10-20";
  a.equal(x.dayPlan(mon).t, "lift");
  a.equal(x.dayPlan(tue).t, "hic");
  a.equal(x.setStack(mon, tue), true);
  const merged = x.dayPlan(tue);
  a.equal(merged.t, "lift", "the lift is the session, not the thing riding along");
  a.deepEqual(merged.lifts, x.dayPlanSlot(mon, x.slotOf(mon)).lifts, "Monday's lifts");
  a.equal(merged.ride, "hic", "with Tuesday's conditioning after it");
  a.equal(merged.fmt, x.dayPlanSlot(tue, x.slotOf(tue)).fmt);
  a.equal(x.dayPlan(mon).t, "off");
  x.clearStack(mon);
  x.setStack(thu, fri);

  // Undo puts it back.
  a.equal(x.clearStack(thu), true);
  a.equal(x.dayPlan(thu).t, "hic");
  a.equal(x.dayPlan(fri).ride, undefined);
  a.equal(x.clearStack(thu), false, "and undoing twice does nothing");
});

test("stacking refuses the combinations that are a different program, and says why", () => {
  const x = app({ now: "2026-10-22" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.plyoOn = false; x.bump();
  const mon = "2026-10-19", wed = "2026-10-21", thu = "2026-10-22", fri = "2026-10-23", sun = "2026-10-25";

  a.equal(x.stackWhyNot(thu, fri), null, "conditioning onto a lifting day is the whole point");
  a.equal(x.stackWhyNot(thu, sun), null, "and onto an empty day is just rescheduling");
  a.match(x.stackWhyNot(mon, wed), /different program/, "two lifting days in one is not");
  a.match(x.stackWhyNot(thu, thu), /onto itself/);
  a.match(x.stackWhyNot(sun, fri), /nothing on it to move/, "a rest day has nothing to give");
  a.match(x.stackWhyNot(thu, "2026-10-30"), /same week/, "and it does not reach across weeks");

  // One at a time: a day that has already taken a session cannot take another.
  x.setStack(thu, fri);
  a.match(x.stackWhyNot("2026-10-24", fri), /already has a session moved onto it/);
  a.match(x.stackWhyNot(fri, sun), /already has another session on it/);
  a.equal(x.setStack("2026-10-24", fri), false, "and refusing means refusing");
  a.equal(x.dayPlan(fri).stacked, thu, "the first move stands");
});

test("the move sheet offers the stack, with the warning the book's caution is about", () => {
  const x = app({ now: "2026-10-22" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.plyoOn = false;
  x.sel = "2026-10-22"; x.bump();

  const sheet = x.moveCard();
  a.match(sheet, /Two in one day/);
  a.match(sheet, /data-act="stack"[^>]*data-to="2026-10-23"(?![^>]*disabled)/, "Friday is offered");
  // From a conditioning day every other day is a legal target, so nothing is refused.
  a.doesNotMatch(sheet, /data-act="stack"[^>]*disabled/);

  // From a lifting day, the other lifting days are offered but refused rather than
  // silently missing — you can see that the app considered them.
  x.sel = "2026-10-19";
  const liftSheet = x.moveCard();
  a.match(liftSheet, /data-act="stack"[^>]*data-to="2026-10-21"[^>]*disabled/, "Wednesday lifts too");
  a.match(liftSheet, /data-act="stack"[^>]*data-to="2026-10-20"(?![^>]*disabled)/, "Tuesday conditions");
  x.sel = "2026-10-22";
  a.match(sheet, /lifting comes first/, "it says what order to do them in");
  a.match(sheet, /not worth planning every week/, "and that this is for rescuing a session");

  // Once stacked, both days offer the undo rather than another move.
  x.setStack("2026-10-22", "2026-10-23");
  a.match(x.moveCard(), /data-act="unstack"/);
  x.sel = "2026-10-23";
  const onto = x.moveCard();
  a.match(onto, /has been moved onto this day/);
  a.match(onto, /data-act="unstack"/);
});

test("the stair machine logs floors, and floors are not a distance", () => {
  const x = app({ now: "2026-10-13" });
  a.equal(x.MOD.stair.name, "Stair machine");
  a.deepEqual(x.metricFor("stair", "map"), ["floors", "floors"], "hard sessions count floors");
  a.deepEqual(x.metricFor("stair", "liss"), ["floors", "floors"], "and so does easy work");
  a.equal(x.metricLabel(x.metricFor("stair", "map")), "Floors",
    "labelled as floors, not as 'Distance (floors)'");

  // A floor is a floor in both unit systems — nothing to convert.
  x.plan.unit = "kg"; x.bump();
  a.deepEqual(x.metricFor("stair", "map"), ["floors", "floors"]);
  x.plan.unit = "lb"; x.bump();

  // It is a conditioning machine, so it carries no load or elevation fields and is not
  // treated as impact work the way running and rucking are.
  a.ok(!x.MOD.stair.load && !x.MOD.stair.elev);
  a.deepEqual(x.plyoWarnings("operator", "black", 3, "stair").map((w) => w.k), [],
    "no landing-work warning: it is low impact");
  a.deepEqual(x.plyoWarnings("operator", "black", 3, "run").map((w) => w.k), ["impact"]);

  // It shows up everywhere activities are offered, without being listed by hand.
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.plyoOn = false; x.bump();
  const hicDay = [0, 1, 2, 3, 4, 5, 6].map((d) => x.addDays("2026-10-12", d))
    .find((dt) => x.dayPlan(dt).t === "hic");
  x.sel = hicDay;
  a.match(x.hicCard(x.dayPlan(hicDay), ""), /data-act="mod" data-v="stair"/);
  x.wz = x.wzNew(false); x.wz.step = 4;
  a.match(x.vWelcome(), /data-v="stair"/, "and in the setup wizard");

  // Logging one reads back as floors.
  x.setLog(hicDay, "hic.mod", "stair");
  x.setLog(hicDay, "hic.floors", 42);
  a.equal(x.modOf(hicDay), "stair");
  a.match(x.hicCard(x.dayPlan(hicDay), ""), /value="42"/);
});

test("FOBBITs are a catalog of whole sessions, not one hardcoded pair", () => {
  const x = app({ now: "2026-10-14" });
  const ids = Object.keys(x.FOBBIT);
  a.ok(ids.length >= 10, "several to choose from");
  a.ok(ids.includes("kb"), "the kettlebell one the app already had");
  // Four sandbag sessions that are genuinely four sessions. Shouldering it, carrying it,
  // throwing it over a bar and throwing it over your shoulder are different movements,
  // and the easiest mistake here would be to let them collapse into each other.
  const bags = ids.filter((k) => /sandbag/.test(k));
  a.ok(bags.length >= 4, "several sandbag ones");
  a.equal(new Set(bags.map((k) => x.fobLine(k))).size, bags.length, "each prescribing something different");
  a.match(x.fobLine("sandbagbar"), /over the bar/);
  a.match(x.fobLine("sandbagtoss"), /Over-the-shoulder toss/);
  a.ok(!/over the bar/.test(x.fobLine("sandbagtoss")), "the toss is not the over-the-bar one");
  a.equal(x.fobBouts("sandbagtoss", false).length, 1, "the toss is the whole chain, so it stands alone");
  a.equal(x.fobBouts("sandbagtoss", true)[0].reps, "5", "and halves like any other rep count");

  // Every entry is a distinct session: a catalog of one rotation repeated is not one.
  const lines = ids.filter((k) => x.fobDef(k)).map((k) => x.fobLine(k) + "|" + x.fobEveryLabel(k));
  a.equal(new Set(lines).size, lines.length, "no two prescribe the same thing");

  for (const [k, F] of Object.entries(x.FOBBIT)) {
    a.ok(F.name, `${k} has a name`);
    a.ok(x.FOB_SRC[F.src], `${k} says where it came from`);
    a.ok(F.mins.includes(F.def), `${k} defaults to one of its own lengths`);
    a.ok(["base", "total"].includes(x.fobCount(k)), `${k} says what its minutes measure`);
    a.ok(x.fobEvery(k) > 0, `${k} has a base interval`);
    if (k === "other") { a.equal(F.mv, null, "the free-text one prescribes nothing"); continue }
    a.ok(F.gear, `${k} says what kit it needs`);
    a.ok(F.mv.length >= 1, `${k} has at least one movement`);
    for (const [nm, dose] of F.mv) {
      a.ok(nm, `${k} names each movement`);
      a.ok(typeof dose === "string" || typeof dose === "object", `${k} doses each one`);
    }
    a.ok(x.fobLine(k).includes(F.mv[0][0]), `${k} reads as a line`);
  }

  // The original is untouched, so a session logged before any of this still reads right.
  a.equal(x.fobLine("kb"), "Kettlebell swing × 20, then kettlebell snatch × 10 / arm");
  a.equal(x.FOB_SRC[x.FOBBIT.kb.src], "Tactical Barbell II");
  a.equal(x.fobLine("other"), "", "nothing to print for the free-text one");
  a.equal(x.fobLine("nope"), "");

  // Provenance is recorded, because most of the catalog is ours and the Guide says so.
  a.equal(x.fobSrcLabel("kb"), "Tactical Barbell II");
  a.equal(x.fobSrcLabel("massfob"), "Mass Protocol");
  a.equal(x.fobSrcLabel("sandbagbar"), "Ours");
  a.equal(x.fobSrcLabel("nope"), "Ours", "an unknown one is not credited to a book");
  // The whole point of recording a source is that it cannot drift. Anything added from
  // here is ours until somebody has actually found it in a book.
  a.deepEqual(Object.keys(x.FOBBIT).filter((k) => x.FOBBIT[k].src !== "ours").sort(),
    ["combat", "kb", "massfob", "maxstrength", "se", "seamrap"],
    "exactly these six come from a source");
  for (const k of ["maxstrength", "se", "seamrap", "combat"]) a.match(x.fobSrcLabel(k), /^TB article, Mod #[123]$/, k);
});
test("a FOBBIT is chosen per session, over a default, like the activity is", () => {
  const x = app({ now: "2026-10-14" });
  x.plan.startMonday = "2026-09-28"; x.plan.bridge = true; x.bump();
  const d = [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays("2026-10-12", i))
    .find((dt) => x.dayPlan(dt).t === "hic");

  a.equal(x.defFob(), "kb", "kettlebells unless you say otherwise");
  a.equal(x.fobOf(d), "kb");

  // A plan default.
  x.plan.fobbit = "sandbag"; x.bump();
  a.equal(x.fobOf(d), "sandbag");
  x.plan.fobbit = "nonsense"; x.bump();
  a.equal(x.defFob(), "kb", "and a default that is not on the list falls back");

  // A single session can differ from it.
  x.plan.fobbit = "kb"; x.bump();
  x.setLog(d, "hic.fob", "sandbagheavy");
  a.equal(x.fobOf(d), "sandbagheavy");
  a.equal(x.defFob(), "kb", "without changing the default");
  x.setLog(d, "hic.fob", "rubbish");
  a.equal(x.fobOf(d), "kb", "a stored value that is not on the list falls back too");

  // Choosing through the picker: only a real difference from the default is stored, so
  // changing the default later still moves the sessions that never disagreed with it.
  a.equal(x.setFob(d, "sandbag"), true);
  a.equal(((x.logs[d] || {}).hic || {}).fob, "sandbag");
  a.equal(x.setFob(d, "kb"), true, "picking the default again");
  a.equal(((x.logs[d] || {}).hic || {}).fob, null, "clears the swap rather than pinning it");
  a.equal(x.setFob(d, "nope"), false, "and a value that is not on the list is refused");
  a.equal(((x.logs[d] || {}).hic || {}).fob, null, "with nothing written");

  // It shows on the day, with the movements spelled out rather than typed by hand.
  x.sel = d;
  x.setLog(d, "hic.format", "fobbit");
  x.setLog(d, "hic.fob", "sandbag");
  const card = x.hicCard(x.dayPlan(d), "");
  a.match(card, /data-act-fob/, "a picker on the session");
  a.match(card, /Bear-hug squat|bear-hug squat/, "and the movements it prescribes");
  a.doesNotMatch(card, /placeholder="e\.g\. sandbag clean/, "no free-text box when it is prescribed");

  // Except for the one that is deliberately free text.
  x.setLog(d, "hic.fob", "other");
  a.match(x.hicCard(x.dayPlan(d), ""), /placeholder="e\.g\. sandbag clean/);

  // Setup carries the default, and the Guide lists them all.
  x.view = "setup";
  a.match(x.vSetup(), /data-pbind="fobbit"/);
  const g = x.vGuide();
  for (const [k, F] of Object.entries(x.FOBBIT)) {
    if (F.a) a.ok(g.includes(x.esc(F.name)), `${k} is in the Guide`);
  }
});

test("goals are written once in Setup and kept out of the way", () => {
  const x = app({ now: "2026-10-16" });
  x.plan.programGoals = { aim: "315 squat", by: "2027-03-01", sticking: { bench: "off the chest" }, notes: "bad left wrist" };
  x.bump();
  const h = x.vSetup();
  a.match(h, /<h2>Goals<\/h2>/);
  a.match(h, /data-pbind="programGoals\.aim"[^>]*value="315 squat"/);
  a.match(h, /data-pbind="programGoals\.by"[^>]*value="2027-03-01"/);
  a.match(h, /data-pbind="programGoals\.notes"/);
  // One box per lift you actually train, so the form matches the program.
  for (const k of x.activeLifts()) a.match(h, new RegExp(`data-pbind="programGoals\\.sticking\\.${k}"`), k);
  a.match(h, /value="off the chest"/);
  // It is explicit that nothing here reschedules anything.
  a.match(h, /Nothing here changes the program/);

  // The date is turned into something readable, and a date gone by says so.
  a.match(h, /weeks away\./);
  x.plan.programGoals.by = "2026-01-01"; x.bump();
  a.match(x.vSetup(), /That date has passed\./);
  a.equal(x.weeksUntil("2026-10-16"), "That is today.");
  a.equal(x.weeksUntil("2026-10-20"), "4 days away.");
  a.equal(x.weeksUntil(""), "");

  // And `programGoals` is not the nutrition `goal`, which is a different setting that
  // happens to be spelled almost the same.
  a.equal(typeof x.plan.goal, "string");
  a.equal(typeof x.plan.programGoals, "object");
});

test("a day dropped on another offers three things, and says why not", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false; x.plan.stempl = "operator"; x.plan.cproto = "black"; x.bump();
  // Operator + Black: lift, HIC, lift, HIC, lift, HIC, off.
  const day = (i) => x.addDays(mon, i);
  const opt = (a, b) => Object.fromEntries(x.calOptions(day(a), day(b)).map((o) => [o.k, o]));

  // Two conditioning days: everything is on the table.
  let o = opt(1, 3);
  a.ok(o.swap.ord, "swap works between two like days");
  a.equal(o.swap.moved, 2, "and moves only the two");
  a.ok(o.shift.ord, "so does shifting");
  a.equal(o.stack.stack, true, "and they can share a day");

  // Two lifting days: the first two work, combining does not, and it says why.
  o = opt(0, 2);
  a.ok(o.swap.ord); a.ok(o.shift.ord);
  a.ok(!o.stack.stack, "two lifting sessions cannot be combined");
  a.match(o.stack.why, /Two lifting sessions in one day/);

  // A swap that would put two hard days together is refused with the rule it breaks,
  // not silently greyed out -- in a full week that is most straight swaps.
  o = opt(0, 1);
  a.ok(!o.swap.ord, "lift onto the next day would clash");
  a.match(o.swap.why, /would put strength on/);
  a.match(o.swap.why, /Shifting the week around it would work/, "and points at the option that does");
  a.ok(o.shift.ord, "which it does");

  // Across weeks there is nothing to offer.
  a.equal(x.calOptions(day(0), x.addDays(mon, 7)), null);

  // A day already gone this week is not a candidate at either end: the session was
  // either done or missed, and moving it now would rewrite history.
  const y = app({ now: x.addDays(mon, 3) });            // it is Thursday
  y.plan.startMonday = mon; y.plan.bridge = false; y.bump();
  const past = (i, j) => Object.fromEntries(y.calOptions(y.addDays(mon, i), y.addDays(mon, j)).map((o) => [o.k, o]));
  a.match(past(1, 5).swap.why, /already passed/, "Tuesday cannot be dragged anywhere");
  a.match(past(5, 1).swap.why, /already passed/, "nor can anything be dropped on it");
  a.ok(past(5, 6).swap.ord, "but two days still ahead swap freely");
});

test("tapping and dragging reach the same three choices", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false; x.bump();
  x.calRe = true;

  // calTarget is the single entry point: the click handler calls it, and so does the
  // end of a drag. One set of rules rather than two.
  a.equal(x.calTarget(x.addDays(mon, 1)), true, "first tap picks a source");
  a.equal(x.calMove.from, x.addDays(mon, 1));
  a.ok(!x.calMove.to, "and nothing is chosen yet");

  a.equal(x.calTarget(x.addDays(mon, 3)), true, "second names the target");
  a.equal(x.calMove.to, x.addDays(mon, 3));
  a.ok(!x.calMove.mode, "still nothing applied");

  // Tapping the source again cancels.
  x.calMove = { from: x.addDays(mon, 1) };
  a.equal(x.calTarget(x.addDays(mon, 1)), true);
  a.equal(x.calMove, null);

  // A different week is refused rather than starting a cross-week move.
  x.calMove = { from: x.addDays(mon, 1) };
  a.equal(x.calTarget(x.addDays(mon, 8)), false);
  a.equal(x.calMove.to, undefined, "and nothing was set");

  // Nothing is written to the plan by any of this.
  a.deepEqual(x.plan.order || {}, {}, "choosing is not applying");
});

test("the chooser shows all three and disables what cannot be done", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false; x.bump();
  x.calRe = true;
  x.calMove = { from: mon, to: x.addDays(mon, 2) };        // lift onto lift
  const h = x.calChooser();
  for (const k of ["swap", "shift", "stack"]) a.match(h, new RegExp(`data-act="calmode" data-k="${k}"`), k + " is offered");
  // The one that cannot happen is disabled and carries the reason, not just dimmed.
  a.match(h, /data-k="stack"[^>]*disabled|disabled[^>]*data-k="stack"/, "combining is disabled");
  a.match(h, /Two lifting sessions in one day/);
  // And it closes without doing anything.
  a.match(h, /data-act="calcancel"/);
  // Once a mode is chosen the chooser gets out of the way for the preview.
  x.calMove = { from: mon, to: x.addDays(mon, 2), mode: "swap", ord: [2, 1, 0, 3, 4, 5, 6], moved: 2 };
  a.equal(x.calChooser(), "");
});

test("applying a choice does what the choice said, and nothing else", () => {
  const mon = "2026-10-19";
  const fresh = () => { const x = app({ now: mon }); x.plan.startMonday = mon; x.plan.bridge = false; x.calRe = true; x.bump(); return x };

  // Swap moves exactly two days and leaves the rest of the order alone.
  let x = fresh();
  const before = x.dayOrder(mon).slice();
  x.calMove = { from: x.addDays(mon, 1), to: x.addDays(mon, 3) };
  a.equal(x.calSetMode("swap"), true); a.equal(x.calApply(), true);
  const after = x.plan.order[mon];
  a.deepEqual([after[1], after[3]], [before[3], before[1]], "the two traded");
  a.deepEqual(after.filter((_, i) => i !== 1 && i !== 3), before.filter((_, i) => i !== 1 && i !== 3), "and nothing else moved");
  a.deepEqual(x.orderIssues(mon, after), [], "still a legal week");

  // Shifting is allowed to move more, which is the difference between the two.
  x = fresh();
  x.calMove = { from: mon, to: x.addDays(mon, 1) };
  a.equal(x.calSetMode("shift"), true); a.equal(x.calApply(), true);
  a.deepEqual(x.orderIssues(mon, x.plan.order[mon]), [], "and it is still legal");
  a.equal(x.slotOf(x.addDays(mon, 1)), 0, "the session landed where it was dropped");

  // Combining writes a stack, not an order, and the source day reads as moved.
  x = fresh();
  x.calMove = { from: x.addDays(mon, 1), to: x.addDays(mon, 3) };
  a.equal(x.calSetMode("stack"), true); a.equal(x.calApply(), true);
  a.equal((x.plan.order || {})[mon], undefined, "the week order is untouched");
  a.equal(x.stackTo(x.addDays(mon, 1)), x.addDays(mon, 3), "the session rides along");
  a.equal(x.dayPlan(x.addDays(mon, 1)).t, "off", "and its own day is clear");

  // A mode that is unavailable cannot be applied by asking for it directly.
  x = fresh();
  x.calMove = { from: mon, to: x.addDays(mon, 2) };          // two lifting days
  a.equal(x.calSetMode("stack"), false, "refused");
  a.ok(!x.calMove.mode);
  a.equal(x.calApply(), false);
  a.equal((x.plan.order || {})[mon], undefined, "and nothing was written");
  a.equal(x.stackTo(mon), null);
});

test("conditioning may run on consecutive days, which is what the book says", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false; x.plan.stempl = "operator"; x.plan.cproto = "black"; x.bump();

  // TB II, on moving conditioning around: "Your HIC and E can be done on any day, not
  // just days 2, 4, and 6. You can do two days in a row, or whatever. As long as
  // you're hitting your weekly minimums." The app used to refuse exactly that.
  a.deepEqual(x.ADJACENT_BAN, ["strength", "strengthA", "strengthB"], "only strength is banned");
  a.equal(x.clashes("hic", "hic"), false, "two hard conditioning days are not a clash");
  a.equal(x.clashes("se", "se"), false);
  a.equal(x.clashes("strength", "strength"), true, "the book's one rule still holds");
  a.equal(x.clashes("strengthA", "strengthB"), false, "Zulu's halves are different sessions");

  // Swapping two lifting days apart is still refused, and says it is the book's rule.
  const refused = x.swapOrder(mon, 1, 2);
  a.ok(refused.why); a.match(refused.why, /the one arrangement the book rules out/);

  // A swap that doubles up conditioning goes through, with a remark rather than a veto.
  const ok = x.swapOrder(mon, 4, 5);
  a.ok(ok.ord, "allowed");
  a.match(ok.warn, /both become hard conditioning/);
  a.match(ok.warn, /two days in a row, or whatever/, "quoting the book that permits it");
  a.deepEqual(x.orderIssues(mon, ok.ord), [], "and it is a legal week");
  a.ok(x.orderCrowding(mon, ok.ord).length, "just a crowded one");

  // The chooser offers it rather than greying it out, and carries the remark.
  x.calRe = true; x.calMove = { from: x.addDays(mon, 4), to: x.addDays(mon, 5) };
  const h = x.calChooser();
  a.ok(!/data-k="swap"[^>]*disabled/.test(h), "swap is available");
  a.match(h, /both become hard conditioning/, "with the warning shown");
});

test("spreading conditioning out is still preferred when the week allows it", () => {
  const x = app({ now: "2026-10-19" });
  const mon = "2026-10-19";
  x.plan.startMonday = mon; x.plan.bridge = false; x.bump();

  // Allowed is not the same as chosen. Left to itself the week still alternates, and
  // bestOrder keeps preferring that -- crowding costs more than any amount of
  // shuffling, so it is only taken when nothing else fits.
  const kinds = [0, 1, 2, 3, 4, 5, 6].map((i) => x.sessKind(x.dayPlanSlot(x.addDays(mon, i), i)));
  a.ok(!kinds.some((k, i) => i && k === "hic" && kinds[i - 1] === "hic"), "the default week spreads them");
  a.deepEqual(x.orderCrowding(mon, x.dayOrder(mon)), [], "nothing to remark on");

  // Asking to move a lifting day still returns a week that avoids crowding if it can.
  const r = x.bestOrder(mon, 1, 0);
  a.ok(r, "an arrangement exists");
  a.deepEqual(x.orderIssues(mon, r.ord), [], "legal");
  a.deepEqual(x.orderCrowding(mon, r.ord), [], "and uncrowded, because it could be");
});

test("the rest timer warns before it ends, and does not sound like the end", async () => {
  const x = app({ now: "2026-10-16" });
  a.equal(x.restWarnSecs(), 10, "ten seconds by default, which is what was asked for");
  x.plan.restWarn = 0; x.bump(); a.equal(x.restWarnSecs(), 0, "and can be turned off");
  x.plan.restWarn = 99; x.bump(); a.equal(x.restWarnSecs(), 10, "a value off the list falls back");
  x.plan.restWarn = 15; x.bump(); a.equal(x.restWarnSecs(), 15);

  // The warning is one short low tone; the finish is three rising ones. If they
  // sounded alike you would have to look at the phone to tell them apart, which is
  // the thing a beep exists to save you.
  x.plan.soundMode = "duck"; x.plan.quietTimer = false; x.bump();
  x.unlockAudio();
  await settle();                                  // the context resumes asynchronously
  x.audio.tones.length = 0; x.buzzes.length = 0;
  x.beepWarn();
  const warn = x.audio.tones.slice();
  x.audio.tones.length = 0;
  x.beep();
  const done = x.audio.tones.slice();
  a.equal(warn.length, 1, "one note");
  a.ok(done.length > warn.length, "against the finish's several");
  a.ok(warn[0].hz < Math.max(...done.map((t) => t.hz)), `lower than the finish: ${warn[0].hz} vs ${done.map((t) => t.hz)}`);
  a.deepEqual(x.buzzes[0], 120, "a single short buzz, not the finish's long-short-long");

  // Once, and not on a rest too short for it to mean anything.
  x.plan.restWarn = 10; x.plan.soundMode = "duck"; x.bump();
  a.equal(x.restWarnDue({ dur: 180 }, 10), true, "a three-minute rest warns at ten");
  a.equal(x.restWarnDue({ dur: 180 }, 11), false, "not before");
  a.equal(x.restWarnDue({ dur: 180 }, 9), false, "and not after, so it cannot repeat");
  a.equal(x.restWarnDue({ dur: 180, warned: true }, 10), false, "already warned");
  a.equal(x.restWarnDue({ dur: 20 }, 10), true, "twenty seconds is exactly twice, so it still warns");
  a.equal(x.restWarnDue({ dur: 15 }, 10), false, "but a fifteen-second rest would warn as it began");
  x.plan.restWarn = 0; x.bump();
  a.equal(x.restWarnDue({ dur: 180 }, 10), false, "off is off");
  x.plan.restWarn = 10; x.bump();

  // Silent means silent, for the warning as much as the finish.
  x.setSoundMode("silent"); x.bump();
  x.audio.tones.length = 0;
  a.equal(x.beepWarn().tones, "silent");
  a.equal(x.audio.tones.length, 0, "nothing played");
});

test("the macro averages say what they average, and over which days", () => {
  const x = app({ now: "2026-10-16" });                     // a Friday
  x.plan.startMonday = "2026-10-05"; x.plan.bridge = false;
  x.plan.goal = "gain"; x.plan.proteinPerLb = 0;
  // Five recent days at target, the rest well under, so the windows must disagree.
  const seed = {};
  for (let i = 27; i >= 0; i--) {
    const d = x.addDays("2026-10-16", -i);
    seed[d] = { checkin: { bw: 185, proG: i < 5 ? 240 : 150, carbG: 300, fatG: 90 } };
  }
  x.seed(seed); x.bump();

  a.equal(x.setMacroWin("week"), true);
  a.equal(x.macroWinDays("2026-10-16"), 5, "Monday to Friday");
  a.equal(x.setMacroWin("14"), true);
  a.equal(x.macroWinDays("2026-10-16"), 14);
  a.equal(x.setMacroWin("cycle"), true);
  a.ok(x.macroWinDays("2026-10-16") > 7, "a block reaches past this week");
  a.equal(x.setMacroWin("nonsense"), false, "and only the three exist");

  // Each window gives its own answer, which is the point of having three.
  const avg = (w) => { x.setMacroWin(w); x.bump(); return x.macroMean("2026-10-16", x.macroWinDays("2026-10-16")).p };
  a.equal(avg("week"), 240, "the good week reads as on target");
  a.ok(avg("14") < 200, "a fortnight including the bad days does not");
  a.ok(avg("cycle") < 200);

  // The card never says "eaten" alone, which reads as today and is not: grams are
  // logged the morning after, so today's are never in the average.
  x.setMacroWin("week"); x.bump();
  const h = x.macroCard("2026-10-16");
  a.match(h, /avg 240/, "it is labelled an average");
  a.ok(!/\d+ g eaten/.test(h), "never a bare 'eaten' figure");
  // The explanations are behind one disclosure now rather than open under every card.
  a.match(h, /data-act="macrowhy" aria-expanded="false"/);
  a.ok(!/Averages are of days already eaten/.test(h), "folded away by default");
  x.setMacroWhy(true);
  const why = x.macroCard("2026-10-16");
  a.match(why, /<b>Averages are of days already eaten<\/b>, not today/);
  a.match(why, /4 of the 5 days since Monday/, "and says how many days are behind it");
  x.setMacroWhy(false);

  // On target versus short is the question being asked, so it is answered in words.
  a.match(h, /Protein[\s\S]{0,260}On target/);
  // The verdict carries color as well as words: on a card read between sets, green
  // and red are what gets seen, and a tone that never changes says nothing.
  a.match(h, /class="mrow-v ok">On target/);
  a.match(h, /aria-expanded="false"/, "and the note reports itself shut");
  x.setMacroWhy(true);
  a.match(x.macroCard("2026-10-16"), /aria-expanded="true"/, "and open when it is");
  x.setMacroWhy(false);
  x.setMacroWin("14"); x.bump();
  a.match(x.macroCard("2026-10-16"), /Protein[\s\S]{0,260}\d+ short/, "and short when it is short");
  a.match(x.macroCard("2026-10-16"), /class="mrow-v off">\d+ short/, "in the color that says so");

  // A window with hardly anything in it says so rather than averaging two days.
  const y = app({ now: "2026-10-16" });
  y.plan.startMonday = "2026-10-05"; y.plan.bridge = false; y.plan.goal = "gain"; y.plan.proteinPerLb = 0;
  y.seed({ "2026-10-16": { checkin: { bw: 185, proG: 240, carbG: 300, fatG: 90 } } }); y.bump();
  y.setMacroWin("14"); y.bump();
  y.setMacroWhy(true);
  a.match(y.macroCard("2026-10-16"), /Too few to read much into/);

  // Nothing at all explains where the boxes are, and that they are a day behind.
  const z = app({ now: "2026-10-16" });
  z.plan.goal = "gain"; z.plan.bodyweight = 185; z.plan.proteinPerLb = 0; z.bump();
  z.setMacroWhy(true);
  const zh = z.macroCard("2026-10-16");
  a.match(zh, /Nothing logged over/);
  a.match(zh, /they are for the day before, so today[’']s go in tomorrow/);
});

test("every CSS variable the stylesheet uses is one the stylesheet defines", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "app.css"), "utf8");
  // An invented token is invisible until someone looks at it: `var(--card)` with no
  // fallback inherits, and with a wrong fallback it paints. That is how the Setup
  // section headers shipped as black text on a near-black bar -- `--card` does not
  // exist, so the hardcoded #1c1c1e behind it won in light mode.
  const defined = new Set([...css.matchAll(/(--[a-z][\w-]*)\s*:/g)].map((m) => m[1]));
  const used = [...css.matchAll(/var\((--[a-z][\w-]*)/g)].map((m) => m[1]);
  const missing = [...new Set(used)].filter((v) => !defined.has(v));
  a.deepEqual(missing, [], `used but never defined: ${missing.join(", ")}`);

  // And no fallbacks: every token here is always defined, so a fallback can only ever
  // be a wrong color waiting for the token to be misspelled.
  const fallbacks = [...css.matchAll(/var\(--[a-z][\w-]*\s*,[^)]+\)/g)].map((m) => m[0]);
  a.deepEqual(fallbacks, [], `hardcoded fallbacks hide a typo: ${fallbacks.join(" ")}`);

  // The themes must agree on what exists, or a token works in one and not the other.
  const blocks = css.split(/@media|\[data-theme/).filter((b) => b.includes("--ink:"));
  a.ok(blocks.length >= 2, "there is a light theme and a dark one");
  const names = blocks.map((b) => new Set([...b.matchAll(/(--[a-z][\w-]*)\s*:/g)].map((m) => m[1])));
  const base = [...names[0]].filter((n) => !/^--f-|^--r$/.test(n));
  for (let i = 1; i < names.length; i++)
    for (const n of base) a.ok(names[i].has(n), `theme ${i} is missing ${n}`);
});

/* ---------------- morphing ----------------
   The algorithm is tested against a small node tree built by hand rather than parsed
   from HTML: a parser is the one part of this that the browser already provides and
   that a test does not need to re-implement to check the walk. */
function mkDom() {
  let active = null;
  const node = (t, attrs, kids) => {
    const n = {
      nodeType: 1, tagName: t.toUpperCase(), childNodes: [], parentNode: null,
      attributes: Object.entries(attrs || {}).map(([name, value]) => ({ name, value: String(value) })),
      get id() { return (this.attributes.find((a) => a.name === "id") || {}).value || "" },
      get type() { return (this.attributes.find((a) => a.name === "type") || {}).value || "" },
      get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join("") },
      value: "", checked: false,
      getAttribute(k) { const a = this.attributes.find((x) => x.name === k); return a ? a.value : null },
      hasAttribute(k) { return this.attributes.some((x) => x.name === k) },
      setAttribute(k, v) { const a = this.attributes.find((x) => x.name === k); if (a) a.value = String(v); else this.attributes.push({ name: k, value: String(v) }) },
      removeAttribute(k) { this.attributes = this.attributes.filter((x) => x.name !== k) },
      appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c },
      insertBefore(c, ref) {
        if (c.parentNode) c.parentNode.childNodes.splice(c.parentNode.childNodes.indexOf(c), 1);
        c.parentNode = this;
        const i = ref ? this.childNodes.indexOf(ref) : -1;
        if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
        return c;
      },
      removeChild(c) { this.childNodes.splice(this.childNodes.indexOf(c), 1); c.parentNode = null; return c },
      cloneNode() { const c = node(t, Object.fromEntries(this.attributes.map((a) => [a.name, a.value])));
        c.value = this.value; c.checked = this.checked;
        for (const k of this.childNodes) c.appendChild(k.cloneNode(true)); return c },
    };
    for (const k of kids || []) n.appendChild(k);
    return n;
  };
  const text = (v) => ({ nodeType: 3, nodeValue: v, parentNode: null, childNodes: [],
    cloneNode() { return text(this.nodeValue) } });
  return { node, text, focus: (n) => { active = n }, get active() { return active } };
}

test("morphing keeps the nodes it can and replaces only what changed", () => {
  const x = app();
  const d = mkDom();
  const old = d.node("div", {}, [
    d.node("p", { id: "a" }, [d.text("one")]),
    d.node("p", { id: "b" }, [d.text("two")]),
  ]);
  const keptA = old.childNodes[0], keptB = old.childNodes[1];

  // Same shape, one word changed: both elements survive, only the text is written.
  const next = d.node("div", {}, [
    d.node("p", { id: "a" }, [d.text("one")]),
    d.node("p", { id: "b" }, [d.text("TWO")]),
  ]);
  x.morphChildren(old, next);
  a.equal(old.childNodes[0], keptA, "the untouched node is the same object");
  a.equal(old.childNodes[1], keptB, "and so is the changed one");
  a.equal(keptB.textContent, "TWO", "its text was updated in place");

  // A node inserted above them must not cost them their identity, or anything the
  // browser was holding for them -- focus, caret, scroll -- goes with it.
  const withBanner = d.node("div", {}, [
    d.node("div", { id: "banner" }, [d.text("!")]),
    d.node("p", { id: "a" }, [d.text("one")]),
    d.node("p", { id: "b" }, [d.text("TWO")]),
  ]);
  x.morphChildren(old, withBanner);
  a.equal(old.childNodes.length, 3);
  a.equal(old.childNodes[1], keptA, "the id carried it to its new position");
  a.equal(old.childNodes[2], keptB);

  // And removing it puts them back without rebuilding them.
  x.morphChildren(old, next);
  a.deepEqual(old.childNodes.map((n) => n.id), ["a", "b"]);
  a.equal(old.childNodes[0], keptA);

  // A different tag in the same slot is a different element and is replaced.
  x.morphChildren(old, d.node("div", {}, [d.node("span", { id: "a" }, [d.text("one")])]));
  a.notEqual(old.childNodes[0], keptA, "a <p> is not a <span>");
  a.equal(old.childNodes.length, 1, "and the surplus went");

  // So is the same tag under a different id. Reusing one field as another would
  // carry across whatever the browser was holding for the first -- its value, its
  // caret, its checked state -- and hand it to something else.
  const two = d.node("div", {}, [d.node("input", { id: "squat" }), d.node("input", { id: "bench" })]);
  const squat = two.childNodes[0];
  squat.value = "300";
  x.morphChildren(two, d.node("div", {}, [d.node("input", { id: "dead" }), d.node("input", { id: "bench" })]));
  a.notEqual(two.childNodes[0], squat, "a different id is a different element");
  a.equal(two.childNodes[0].value, "", "so nothing of the old one came with it");
  a.equal(two.childNodes[0].id, "dead");
});

test("morphing updates attributes without rebuilding, and drops the stale ones", () => {
  const x = app();
  const d = mkDom();
  const old = d.node("div", {}, [d.node("button", { id: "go", class: "btn", disabled: "" }, [d.text("Go")])]);
  const btn = old.childNodes[0];
  x.morphChildren(old, d.node("div", {}, [d.node("button", { id: "go", class: "btn primary" }, [d.text("Send")])]));
  a.equal(old.childNodes[0], btn, "same button");
  a.equal(btn.getAttribute("class"), "btn primary", "class updated");
  a.equal(btn.hasAttribute("disabled"), false, "and the attribute that went away is gone");
  a.equal(btn.textContent, "Send");
});

test("morphing never writes into the field being typed in", () => {
  const x = app();
  const d = mkDom();
  const old = d.node("div", {}, [d.node("input", { id: "q", type: "text", value: "" })]);
  const input = old.childNodes[0];
  input.value = "half a sent";                       // what has been typed so far

  // The render is always a keystroke behind. While the field has focus the DOM is the
  // truth, and writing the stale value is what used to jump the caret to the end.
  const realDoc = global.document;
  global.document = { activeElement: input, createElement: () => d.node("div") };
  try {
    x.morphChildren(old, d.node("div", {}, [d.node("input", { id: "q", type: "text", value: "half a sen" })]));
    a.equal(input.value, "half a sent", "what was typed survives");

    // Blurred, the render wins again.
    global.document.activeElement = null;
    x.morphChildren(old, d.node("div", {}, [d.node("input", { id: "q", type: "text", value: "from the plan" })]));
    a.equal(input.value, "from the plan");

    // A checkbox follows the render either way: it has no caret to lose, and its
    // state lives in the plan rather than in what is half-typed.
    const box = d.node("div", {}, [d.node("input", { id: "c", type: "checkbox" })]);
    x.morphChildren(box, d.node("div", {}, [d.node("input", { id: "c", type: "checkbox", checked: "" })]));
    a.equal(box.childNodes[0].checked, true);
    x.morphChildren(box, d.node("div", {}, [d.node("input", { id: "c", type: "checkbox" })]));
    a.equal(box.childNodes[0].checked, false);
  } finally { global.document = realDoc }
});

test("morph falls back to replacing when there is no real DOM to walk", () => {
  const x = app();
  // Which is what the test harness is, and why every other test still passes: a stub
  // element with an innerHTML string and no children gets the old behaviour.
  const stub = { innerHTML: "" };
  a.equal(x.morph(stub, "<p>hello</p>"), false, "it reports that it could not morph");
  a.equal(stub.innerHTML, "<p>hello</p>", "and replaced instead, so nothing is lost");
});

test("anything you tap is big enough to tap", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "app.css"), "utf8");
  // 44px is Apple's figure and the one worth holding to here: this app is used
  // standing, between sets, often with chalk on. Measured before the fix, the primary
  // button was 38, the small one 30, the segmented control 36 and a checkbox 18.
  const MIN = 40;

  // Things that carry cursor:pointer but are not themselves the target.
  const notTargets = [
    ".ch-hit",      // a transparent band inside an SVG chart, sized by the chart
    ".crow-n",      // the name inside a row whose whole height is already the target
    ".acct",        // the header avatar, a fixed 32px brand element with a 44px parent
    "#status.link", // a word inside a sentence, not a control
    ".libinfo",     // a wrapper around a button that has its own size
  ];

  // Braces on both sides of the body, so an @media wrapper is skipped and the
  // rules inside it are matched on their own.
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [
    sel.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    body,
  ]);
  // The leading ; or start matters: without it line-height reads as a height.
  const HEIGHT = /(?:^|;)\s*(?:min-)?height:\s*(\d+)px/;
  const tall = (body, sel) => {
    const mh = +(body.match(/(?:^|;)\s*min-height:\s*(\d+)px/) || [])[1] || 0;
    const h = +(body.match(/(?:^|;)\s*height:\s*(\d+)px/) || [])[1] || 0;
    // A control may keep its drawn size and carry the hit area on a ::after instead.
    const hit = rules.find(([s2, b2]) => s2 === sel + "::after" && /height:\s*\d+px/.test(b2));
    return Math.max(mh, h, hit ? +hit[1].match(/height:\s*(\d+)px/)[1] : 0);
  };

  const bases = rules
    .filter(([sel, body]) => /cursor:\s*pointer/.test(body))
    .map(([sel]) => sel)
    .filter((sel) => !notTargets.some((n) => sel.includes(n)));
  a.ok(bases.length > 15, "found the interactive rules");

  // A variant is the same element with a class, state or attribute added — .btn.sm,
  // not .btn .icon and not .btn::after, both of which are something inside it.
  const VARIANT = /^(?:\.[\w-]+|:(?!:)[\w-]+(?:\([^)]*\))?|\[[^\]]*\])*$/;
  const small = [];
  for (const base of bases) {
    // A selector may be declared across several rules; the size can be in any of them.
    const px = Math.max(
      ...rules.filter(([sel]) => sel === base).map(([sel, body]) => tall(body, sel)),
    );
    if (px < MIN) small.push(`${base} (${px || "unset"})`);
  }
  for (const [sel, body] of rules) {
    // A later rule that resizes a variant of a control carries no cursor of its own,
    // so the scan above misses it: .btn.sm is how the small button got to 30px.
    if (bases.includes(sel) || !HEIGHT.test(body)) continue;
    const base = bases.find((b) => sel.startsWith(b) && VARIANT.test(sel.slice(b.length)));
    if (!base) continue;
    const px = tall(body, sel);
    if (px < MIN) small.push(`${sel} (${px})`);
  }
  a.deepEqual(small, [], `tap targets under ${MIN}px: ${small.join("; ")}`);
});

// A seeded two months: sessions done, daily check-ins, conditioning and jumps, so both
// tabs render with their charts on rather than their empty states.
function lived(now) {
  const x = app({ now });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const seed = {};
  for (let i = 60; i >= 1; i--) {
    const d = x.addDays(now, -i), dp = x.dayPlan(d);
    const L = { date: d, checkin: { bw: 185 - i * 0.05, kcal: 3000, protein: 180, carb: 330,
      fat: 90, sleepH: 7, sleepQ: 3, energy: 3, soreness: 2, stress: 2 } };
    if (dp.t !== "off") L.done = true;
    if (dp.hic) L.cond = { mod: "row", f: "gal", v: 2000 + i * 3, u: "m", min: 30 };
    if (dp.plyo) L.jumps = { broad: 90 + i * 0.1 };
    seed[d] = L;
  }
  x.seed(seed); x.bump();
  return x;
}
const charts = (h) => [...h.matchAll(/<svg[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);

test("Status says where you are now, History holds the trend — never both", () => {
  const x = lived("2026-11-11");
  const s = charts(x.vStatus()), hi = charts(x.vHistory());
  a.ok(hi.length >= 2, "History charts something");
  const both = s.filter((c) => hi.includes(c));
  a.deepEqual(both, [], `the same line is drawn on both tabs: ${both.join("; ")}`);
  // The four that moved. Each is a trend over past cycles or weeks, which is the
  // question History answers; Status keeps the current number instead.
  for (const gone of ["max by cycle", "Readiness", "Broad jump"])
    a.ok(!s.some((c) => c.includes(gone)), `Status still charts ${gone}`);
  a.ok(hi.some((c) => c.includes("max by cycle")), "History charts max by cycle");
  a.ok(hi.includes("Readiness"), "History charts readiness");
});

test("Status keeps the current max and its direction without a chart", () => {
  const x = lived("2026-11-11");
  const h = x.vStatus();
  a.match(h, /class="mrows lifts"/, "the lifts are rows");
  for (const k of x.activeLifts()) a.ok(h.includes(x.liftName(k)), `${k} is listed`);
  a.match(h, /since C1/, "each row says where the max has gone");
  a.match(h, /Open History/, "and points at the tab that holds the line");
});

test("one fact, one place: readiness and adherence are not said twice on Status", () => {
  const h = lived("2026-11-11").vStatus();
  // It was a 7-day tile here and a 28-day line four cards below. The line is History's.
  a.equal((h.match(/Readiness \u00b7 7 days/g) || []).length, 1, "the readiness tile appears once");
  a.ok(!/Readiness \u00b7 28 days/.test(h), "the 28-day readiness line is not also here");
  a.ok(!/All time/.test(h), "all-time adherence went with the heatmap that shows it");
  a.match(h, /class="heat"/, "the heatmap is the adherence picture");
});

test("what you log daily comes before what you review monthly", () => {
  const h = lived("2026-11-11").vStatus();
  const at = (s) => { const i = h.indexOf(s); a.ok(i > 0, `${s} is on the page`); return i };
  a.ok(at(">Macros<") < at(">Strength<"), "macros before strength");
  a.ok(at(">Bodyweight<") < at(">Strength<"), "bodyweight before strength");
  a.ok(at(">This week<") < at(">Macros<"), "this week stays at the top");
  a.ok(at(">Strength<") < at(">Conditioning<"), "strength before conditioning");
});

// --- The three verdicts at the top of Status ---------------------------------------
// Two of the three follow a line from the books rather than dashboard convention, and
// the tests are written against the book's standard, not against a round number.

function run(now, start, f) {
  const x = app({ now });
  x.plan.startMonday = start; x.plan.bridge = false;
  if (f) f(x);
  x.bump();
  return x;
}
// Every scheduled session in the window, done or skipped as `done` says.
function logWeeks(x, now, days, done) {
  const s = {};
  for (let i = days; i >= 1; i--) {
    const d = x.addDays(now, -i);
    if (x.dayPlan(d).t === "off") continue;
    s[d] = { date: d, done: done(i) };
  }
  x.seed(s);
}

test("TB2 asks for no missed sessions, so Keeping up counts them against none", () => {
  const now = "2026-11-11";
  const perfect = run(now, "2026-10-05", (x) => logWeeks(x, now, 37, () => true));
  const k = perfect.keepingUp(now);
  a.equal(k.cls, "ok");
  a.equal(k.v, "Nothing missed");
  a.match(k.w, /standard the book sets/, "it names the standard rather than a percentage");

  // 16 of 24 is 67%, which a dashboard would call "needs work". The book calls it missed.
  const slack = run(now, "2026-10-05", (x) => logWeeks(x, now, 37, (i) => i % 3 !== 0));
  const s = slack.keepingUp(now);
  a.equal(s.cls, "off");
  a.match(s.v, /^\d+ missed$/);
  a.match(s.w, /none missed/, "and says what the standard is when you are under it");
});

test("a three-day-old program is not told it has already missed two sessions", () => {
  const now = "2026-11-11";
  const k = run(now, "2026-11-09").keepingUp(now);
  a.equal(k.cls, "muted");
  a.equal(k.v, "Nothing to count yet");
  // Four weeks later the same program, still untouched, is judged.
  const later = run("2026-12-09", "2026-11-09").keepingUp("2026-12-09");
  a.equal(later.cls, "off");
});

test("TB2 forbids judging progress inside six months, so Progress is a clock", () => {
  const now = "2026-11-11";
  const x = run(now, "2026-10-05", (x2) => logWeeks(x2, now, 37, () => true));
  const p = x.progressLine(now);
  a.equal(p.cls, "muted", "five good weeks is not a verdict");
  a.match(p.v, /weeks in/);
  a.match(p.w, /six months/, "it says why it is not judging");
  a.ok(!/working|improving|on track/i.test(p.w), "and makes no claim either way");

  // Six months and a day: the book's interval is up and the line changes its job.
  const due = run(now, "2026-05-11", (x2) => { x2.plan.cycleMaxes = { 4: { squat: 325 } } });
  const d = due.progressLine(now);
  a.equal(d.cls, "ok");
  a.match(d.v, /compare/);
  a.match(d.w, /re-assess/);
});

test("a projected max is arithmetic, not evidence, so Progress will not count it", () => {
  const now = "2026-11-11";
  // Nothing retested: every max past cycle 1 is the increment applied over and over.
  const proj = run(now, "2026-05-11");
  a.deepEqual(proj.measuredLifts(5), [], "projections count for nothing");
  a.match(proj.progressLine(now).w, /increment doing arithmetic/);

  // A number typed into the cycle-maxes table is what a retest leaves behind.
  const real = run(now, "2026-05-11", (x) => { x.plan.cycleMaxes = { 4: { squat: 325, bench: 190 } } });
  const m = real.measuredLifts(5);
  a.equal(m.length, 2, "both entered lifts count");
  a.equal(m.find((y) => y.k === "squat").d, 25, "measured against cycle 1, not the cycle before");
  a.equal(m.find((y) => y.k === "bench").d, -10, "a retest that went down counts too");
});

test("Watch leads with the most serious thing and keeps the rest", () => {
  const now = "2026-11-11";
  const quiet = run(now, "2026-10-05", (x) => logWeeks(x, now, 37, () => true));
  a.equal(quiet.watchLine(now).cls, "ok");
  a.equal(quiet.watchLine(now).v, "Nothing flagged");

  const hurt = run(now, "2026-10-05", (x) => {
    const s = {}; let sharp = false;
    for (let i = 20; i >= 1; i--) {
      const d = x.addDays(now, -i);
      if (x.dayPlan(d).t === "off") continue;     // a rest day cannot carry a session
      const L = { date: d, done: true };
      if (i % 7 === 0) { L.pain = "niggle"; L.painAt = ["knee"] }
      if (i <= 5 && !sharp) { L.pain = "sharp"; L.painAt = ["shoulder"]; sharp = true }
      s[d] = L;
    }
    a.ok(sharp, "the fixture actually logged the sharp session");
    x.seed(s);
  });
  const w = hurt.watchLine(now);
  a.equal(w.cls, "off", "sharp pain is the red one");
  a.equal(w.v, "Sharp pain logged");
  a.match(w.w, /Shoulder/, "and the detail survives being summarised");
});

test("Watch ranks a falling readiness above sets that ground, and says both", () => {
  const now = "2026-11-11";
  const x = run(now, "2026-10-05", (x2) => {
    const s = {}, good = { sleepH: 8, sleepQ: 5, energy: 5, soreness: 1, stress: 1 },
      bad = { sleepH: 5, sleepQ: 2, energy: 2, soreness: 4, stress: 4 };
    let gr = 0;
    for (let i = 20; i >= 0; i--) {
      const d = x2.addDays(now, -i);
      const L = { date: d, checkin: i < 7 ? bad : good };
      // Three grinder sets, which is what the end-of-cycle review reads.
      if (x2.dayPlan(d).t === "lift" && gr < 3) { L.done = true; L.lifts = { squat: { grinder: true } }; gr++ }
      s[d] = L;
    }
    a.equal(gr, 3, "the fixture logged three grinders");
    x2.seed(s);
  });
  const w = x.watchLine(now);
  a.equal(w.v, "Readiness falling", "the bigger signal leads");
  a.equal(w.cls, "warn", "neither is red on its own");
  a.match(w.w, /Down \d+ points/, "it says how far");
  a.match(w.w, /grinder sets/, "and the smaller flag is kept, not dropped");
});

test("the verdicts are the first thing on Status, above the orientation", () => {
  const h = lived("2026-11-11").vStatus();
  const vb = h.indexOf('class="vb"');
  a.ok(vb > 0 && vb < h.indexOf("Cycle 2"), "the answer comes before the week number");
  for (const l of ["Keeping up", "Progress", "Watch"]) a.ok(h.includes(">" + l + "<"), l);
  a.ok(!/class="banner (alert|warn)"/.test(h), "the pain banner folded into Watch");
});

// --- what you did last time, next to what you are about to do ----------------------
// Finds an accessory day with a slot on it, and the accessory day before it.
function accDays(x, now, back) {
  const out = [];
  for (let i = back; i >= 0; i--) { const d = x.addDays(now, -i); if (x.dayPlan(d).acc) out.push(d) }
  a.ok(out.length >= 3, "the fixture has accessory days in it");
  return out;
}

test("an accessory shows what you lifted for it last time", () => {
  const now = "2026-11-11";
  const x = app({ now }); x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const days = accDays(x, now, 30), prev = days[days.length - 3], today = days[days.length - 1];
  const slot = x.accSlots(x.dayPlan(prev).acc)[0], id = x.accOn(prev, slot);
  const older = days[days.length - 5];
  x.seed({
    [older]: { date: older, done: true, acc: { sets: { [slot]: [{ w: 40, r: 15 }] } } },
    [prev]: { date: prev, done: true, acc: { sets: { [slot]: [{ w: 50, r: 12 }, { w: 45, r: 10 }] } } },
  });
  x.bump();

  const last = x.accLast(today, slot, id);
  a.equal(last.d, prev, "the most recent session, not the first one on file");
  a.ok(!x.accLastLine(today, slot, id).includes("40 × 15"), "the older one is not what you are chasing");
  a.equal(last.sets.length, 2);
  const line = x.accLastLine(today, slot, id);
  a.match(line, /Last time/);
  a.match(line, new RegExp(x.fmtD(prev, true).replace("/", "\\/")), "and says which day");
  a.match(line, /50 × 12 · 45 × 10/, "every set, in order");
  // Nothing to compare against on the day it was first done.
  a.equal(x.accLastLine(older, slot, id), "", "no line before there is a last time");
  a.match(x.accLastLine(prev, slot, id), /40 × 15/, "and the first session is the second one's target");
});

test("swapping the movement does not compare you against the one you dropped", () => {
  const now = "2026-11-11";
  const x = app({ now }); x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const days = accDays(x, now, 30), prev = days[days.length - 3], today = days[days.length - 1];
  const slot = x.accSlots(x.dayPlan(prev).acc)[0], id = x.accOn(prev, slot);
  const other = x.accFor(slot, id).find((k) => k !== id);
  a.ok(other, "the slot has more than one movement in it");
  x.seed({ [prev]: { date: prev, done: true, acc: { sets: { [slot]: [{ w: 50, r: 12 }] } } } });
  x.bump();
  a.match(x.accLastLine(today, slot, id), /50 × 12/, "same movement, compared");
  a.equal(x.accLastLine(today, slot, other), "", "different movement, nothing claimed");
});

test("a session with the slot left empty is not the one you have to beat", () => {
  const now = "2026-11-11";
  const x = app({ now }); x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const days = accDays(x, now, 40), real = days[days.length - 4], blank = days[days.length - 2],
    today = days[days.length - 1];
  const slot = x.accSlots(x.dayPlan(real).acc)[0], id = x.accOn(real, slot);
  x.seed({
    [real]: { date: real, done: true, acc: { sets: { [slot]: [{ w: 60, r: 8 }] } } },
    // Added the rows and never filled them in, which is not a session.
    [blank]: { date: blank, done: true, acc: { sets: { [slot]: [{}, { w: "", r: "" }] } } },
  });
  x.bump();
  a.equal(x.accLast(today, slot, id).d, real, "it skips back past the empty one");
  a.match(x.accLastLine(today, slot, id), /60 × 8/);
});

test("the comparison reads the way the set would be written down", () => {
  const x = app({ now: "2026-11-11" });
  a.equal(x.accSetText({ w: 60, r: 8 }, false), "60 × 8");
  a.equal(x.accSetText({ r: 12 }, true), "12 reps", "an unloaded bodyweight set is reps");
  a.equal(x.accSetText({ w: 25, r: 8 }, true), "+25 × 8", "a loaded one says so with a plus");
  a.equal(x.accSetText({ w: 60 }, false), "60", "a weight with no reps yet");
  a.equal(x.accSetText({}, false), "", "and an empty set says nothing");
});

test("the accessory card carries the comparison into the session", () => {
  const now = "2026-11-11";
  const x = app({ now }); x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const days = accDays(x, now, 30), prev = days[days.length - 3], today = days[days.length - 1];
  const slot = x.accSlots(x.dayPlan(prev).acc)[0];
  x.seed({ [prev]: { date: prev, done: true, acc: { sets: { [slot]: [{ w: 50, r: 12 }] } } } });
  x.bump();
  a.match(x.accSlotRow(today, slot), /Last time/, "the row the session renders shows it");
});

// --- supplements -------------------------------------------------------------------
function supps(o) {
  const x = app(o || { now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  return x;
}

test("the supplement list is the books', with the doses they give", () => {
  const x = supps();
  // Every entry names its source and gives the book's own dose. Nothing is ours.
  for (const [id, s] of Object.entries(x.SUPP)) {
    a.ok(s.name && s.dose && s.src && s.rec, `${id} is fully attributed`);
    a.match(s.src, /^TB[123]/, `${id} comes from a book`);
    // Only TB3 has a level scheme. TB1 recommends in prose and mandates nothing, so
    // a TB1-only entry carries no level rather than being assigned one.
    if (s.lvl != null) a.ok(s.lvl === 1 || s.lvl === 2, `${id} has TB3's level`);
    // Level 1 and Level 2 are TB3's scheme and nobody else's: TB1 recommends in prose
    // and TB2 says only that supplements "can be helpful and give you a bit of an
    // edge". Stamping a level on their entries would be inventing the book's opinion.
    if (s.lvl != null) a.match(s.src, /TB3/, `${id} only has a level because TB3 gave it one`);
    a.ok(["daily", "pre"].includes(s.when), `${id} says when`);
  }
  // TB1 has a supplements chapter of its own and it is the general one, not mass-only.
  a.match(x.SUPP.creatine.src, /TB1/, "TB1 recommends creatine too");
  a.match(x.SUPP.vitamind.src, /TB1/);
  a.match(x.SUPP.vitamind.rec, /skeptical/, "and its skepticism is carried, not dropped");
  a.match(x.SUPP.creatine.dose, /5 to 10 g/, "TB3's creatine dose");
  a.match(x.SUPP.citrulline.dose, /4 to 6 g, 30 to 45 minutes before/, "TB3's citrulline dose and window");
  a.match(x.SUPP.magnesium.dose, /200 to 300 mg/, "TB3's magnesium dose");
});

test("TB3's Level 1 is mandatory for building mass, and says so only then", () => {
  const x = supps();
  x.plan.stempl = "mass"; x.bump();
  a.equal(x.suppCtx(), "mass");
  a.match(x.suppStanding("creatine"), /Level 1 — the book calls it mandatory/);

  // Off a mass template, "mandatory" is gone -- that is TB3's word for TB3's list,
  // written for building mass. TB1 recommends creatine to everyone on the program, so
  // what is left is TB1's standing rather than nothing at all.
  x.plan.stempl = "operator"; x.bump();
  a.equal(x.suppCtx(), "cond");
  a.ok(!/mandatory/.test(x.suppStanding("creatine")), "not mandated off the mass list");
  a.match(x.suppStanding("creatine"), /TB1 and TB3 . highly recommended/, "but still recommended");
  // A multivitamin is the one the books disagree about: TB3 Level 1 for mass, TB1 on
  // the fence. So off a mass template it stays marked as the mass list's.
  a.match(x.suppStanding("multi"), /for building mass/);
  // TB2's conditioning entries are the ones that apply instead.
  a.match(x.suppStanding("beets"), /^TB2 . worth having/, "TB2's entries are in context here");
  a.ok(!/Level/.test(x.suppStanding("beets")), "and carry no level, because TB2 gives none");
});

test("your own supplements carry no dose, because the books do not give one", () => {
  const x = supps();
  x.plan.suppCustom = [{ id: "mine-fish-oil-1", name: "Fish oil", when: "daily" }];
  x.plan.supps = { "mine-fish-oil-1": true };
  x.bump();
  const e = x.suppAll()["mine-fish-oil-1"];
  a.equal(e.name, "Fish oil");
  a.equal(e.mine, true);
  a.equal(e.dose, undefined, "no dose invented");
  a.equal(e.lvl, undefined, "and no level claimed");
  a.deepEqual(x.suppOn("daily"), ["mine-fish-oil-1"]);
  const card = x.suppSetupCard();
  a.match(card, /Fish oil/);
  a.match(card, /books do not cover/, "and the card says why there is no dose");
});

test("pre-training supplements are on the session, daily ones in the day's log", () => {
  const x = supps();
  x.plan.supps = { creatine: true, caffeine: true, citrulline: true };
  x.bump();
  a.deepEqual(x.suppOn("daily"), ["creatine"]);
  a.deepEqual(x.suppOn("pre"), ["caffeine", "citrulline"]);
  const pre = x.suppCard("2026-11-11", "pre");
  a.match(pre, /20 to 30 minutes before training/, "the window travels with it");
  a.ok(!/Creatine/.test(pre), "the daily one is not on the session card");
  a.ok(!/Caffeine/.test(x.suppCard("2026-11-11", "daily")), "and the reverse");
  a.equal(x.suppCard("2026-11-11", "pre") && x.suppOn("pre").length > 0, true);
});

test("nothing ticked means no supplement cards at all", () => {
  const x = supps();
  a.equal(x.suppCard("2026-11-11", "daily"), "");
  a.equal(x.suppCard("2026-11-11", "pre"), "");
});

test("creatine is counted as a run of days, which is what TB3 cares about", () => {
  const now = "2026-11-11";
  const x = supps({ now });
  x.plan.supps = { creatine: true };
  const s = {};
  for (let i = 1; i <= 20; i++) { const d = x.addDays(now, -i); s[d] = { date: d, supps: { creatine: true } } }
  x.seed(s); x.bump();
  a.equal(x.suppStreak(now, "creatine"), 20, "today is still open, so it does not break the run");
  x.seed({ [now]: { date: now, supps: { creatine: true } } }); x.bump();
  a.equal(x.suppStreak(now, "creatine"), 21, "and ticking today extends it");

  // One skipped day ends the run, because a skipped dose is the thing the book warns about.
  const gap = x.addDays(now, -5);
  x.seed({ [gap]: { date: gap, supps: {} } }); x.bump();
  a.equal(x.suppStreak(now, "creatine"), 5, "the run is only as long as the unbroken tail");
  a.match(x.suppCard(now, "daily"), /5 days.*unbroken/, "and the card says it");
  a.match(x.suppCard(now, "daily"), /month or two without skipping/, "with the book's reason");
});

test("a supplement you stop offering keeps the days you already logged it on", () => {
  const now = "2026-11-11";
  const x = supps({ now });
  x.plan.suppCustom = [{ id: "mine-x", name: "Fish oil", when: "daily" }];
  x.plan.supps = { "mine-x": true };
  x.seed({ [now]: { date: now, supps: { "mine-x": true } } }); x.bump();
  a.equal(x.suppTook(now, "mine-x"), true);
  // What removing it from Setup does, without going through the click handler.
  x.plan.suppCustom = []; delete x.plan.supps["mine-x"]; x.bump();
  a.deepEqual(x.suppOn("daily"), [], "no longer offered");
  a.equal(x.suppTook(now, "mine-x"), true, "but the day it was taken still says so");
});

/* An extracted book that is not readable text is worse than one that is missing.

   `library/` is gitignored, so this test is a no-op on a machine that has not built
   the library -- but on the machine that has, it is the guard that was absent when it
   mattered. tb1.txt carried its special characters as BEL- and NUL-escaped sequences,
   which made the file binary. `file` called it "data" and plain grep printed nothing
   for every pattern, so searching the book for "accessory", "creatine" or "90%"
   returned zero matches and read as an answer. Two conclusions were drawn from those
   zeros and both were wrong. A control byte in a book file now fails here instead. */
test("every extracted book is readable text, not something grep will skip", () => {
  const dir = path.join(__dirname, "..", "library");
  if (!fs.existsSync(dir)) return;                       // nothing built on this machine
  const books = fs.readdirSync(dir).filter((f) => f.endsWith(".txt"));
  if (!books.length) return;
  const bad = [];
  for (const f of books) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    // Tab and newline are the only control characters that belong in extracted text.
    const ctrl = (text.match(/[\x00-\x08\x0b-\x1f\x7f]/g) || []).length;
    if (ctrl) bad.push(`${f}: ${ctrl} control characters — run tools/tb1repair.py`);
    // A replacement character means the bytes were not the encoding we read them as.
    const repl = (text.match(/�/g) || []).length;
    if (repl) bad.push(`${f}: ${repl} replacement characters, so the encoding is wrong`);
  }
  a.deepEqual(bad, [], bad.join("; "));
});

test("the books kept the characters their doses and percentages are written with", () => {
  const dir = path.join(__dirname, "..", "library");
  const tb1 = path.join(dir, "tb1.txt");
  if (!fs.existsSync(tb1)) return;
  const t = fs.readFileSync(tb1, "utf8");
  // Each of these was absent from the file while it was escaped, which is how a
  // percentage in TB1 became unfindable by search and by the coach.
  a.ok(/90%/.test(t), "percentages survived");
  a.ok(/\)/.test(t), "closing brackets survived");
  a.equal((t.match(/\(/g) || []).length, (t.match(/\)/g) || []).length, "and they balance");
  a.ok(/’/.test(t), "apostrophes are apostrophes");
});

test("every supplement the app offers has a name on the Worker side too", () => {
  // The catalogue lives in the client and the Worker holds only the names, so a new
  // entry in one and not the other reaches the coach as a raw id like "vitamind".
  const api = fs.readFileSync(path.join(__dirname, "..", "src", "api.js"), "utf8");
  const block = api.match(/const SUPP_NAMES = \{([\s\S]*?)\};/)[1];
  const known = new Set([...block.matchAll(/(\w+):/g)].map((m) => m[1]));
  const x = app({});
  const missing = Object.keys(x.SUPP).filter((k) => !known.has(k));
  a.deepEqual(missing, [], `the coach would read these as ids: ${missing.join(", ")}`);
});

test("skipping the accessories is a choice about today, not a rule about the week", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.stempl = "operator"; x.bump();
  const wk = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "heavy");
  const d = [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays(wk.monday, i))
    .find((dt) => x.dayPlan(dt).t === "lift");
  x.sel = d;
  a.equal(x.accSkipped(d), false);
  a.match(x.accCard(wk, x.dayPlan(d)), /acc-slot/, "there to do until you say otherwise");

  x.seed({ [d]: { date: d, acc: { skip: true } } }); x.bump();
  a.equal(x.accSkipped(d), true);
  const card = x.accCard(wk, x.dayPlan(d));
  a.match(card, /Skipped today/);
  a.match(card, /Bring them back/, "and it is reversible");
  a.doesNotMatch(card, /acc-slot/, "the slots are out of the way once skipped");

  // It is today's decision, so tomorrow starts clean.
  const next = x.addDays(d, 1);
  a.equal(x.accSkipped(next), false, "a skip does not carry to the next day");
});

test("a light week shows the accessories with no heavy-week note at all", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.stempl = "operator"; x.bump();
  const wk = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "light");
  const d = [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays(wk.monday, i))
    .find((dt) => x.dayPlan(dt).t === "lift");
  x.sel = d;
  const card = x.accCard(wk, x.dayPlan(d));
  a.doesNotMatch(card, /Heavy week/, "nothing to say about a light week");
  a.match(card, /acc-slot/);
});

/* The card was fixed first and the walkthrough was not, so on a heavy week the
   accessories were on the day's card and absent from session mode. Worse, session mode
   dropped them for a template that programs its own supplementary work, which the card
   had always been careful not to do: Grey Man's prescribed sets vanished on weeks 3
   and 6. Both of those were the same invented rule, in a second place. */
function liftDayIn(x, tierWanted) {
  const wk = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === tierWanted);
  a.ok(wk, `a ${tierWanted} week exists`);
  const d = [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays(wk.monday, i))
    .find((dt) => x.dayPlan(dt).t === "lift");
  a.ok(d, "with a lifting day in it");
  return { wk, d };
}
function accSteps(x, d) { x.sel = d; return x.lsSteps(d).filter((s) => s.type === "acc") }

test("session mode walks the accessories on a heavy week, same as the card", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.stempl = "operator"; x.bump();
  const heavy = liftDayIn(x, "heavy"), light = liftDayIn(x, "light");
  a.ok(accSteps(x, light.d).length > 0, "a light week has them, as it always did");
  a.equal(accSteps(x, heavy.d).length, accSteps(x, light.d).length,
    "and the heavy week has exactly as many — the week does not decide");
});

test("session mode honours the day's skip, which is the decision that does count", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.stempl = "operator"; x.bump();
  const { d } = liftDayIn(x, "heavy");
  a.ok(accSteps(x, d).length > 0);
  x.seed({ [d]: { date: d, acc: { skip: true } } }); x.bump();
  a.equal(accSteps(x, d).length, 0, "skipped on the card means skipped in the walkthrough");
});

test("a template that programs its supplementary work keeps it on a heavy week", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.stempl = "greyman";
  x.plan.waves.greyman = x.clone(x.STEMPL.greyman.wave);
  x.plan.waves.greyman[2].p = 90; x.bump();
  const { d } = liftDayIn(x, "heavy");
  a.ok(accSteps(x, d).length > 0, "the book programmed this work, so the walkthrough runs it");
});

test("the week ahead no longer tells you the accessories are off", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "app", "18-week-summary.js"), "utf8");
  // The pushed string, not the file: a comment explaining the removal mentions the
  // old wording, and matching that would make this pass for the wrong reason.
  const said = [...src.matchAll(/ahead\.push\('([^']*)'\)/g)].map((m) => m[1]).join(" | ");
  a.ok(said.includes("A heavy week:"), "the heavy-week line is still said");
  a.ok(!said.includes("Accessories are off"), "but not that one, which was our rule as the book's");
  a.ok(said.includes("costing you the main lifts"), "replaced by the test the book gives");
});

test("the deload still drops the accessories, and admits whose idea that is", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false;
  x.plan.deloadEvery = 1; x.bump();
  const wk = x.weeks().find((w) => w.kind === "deload");
  a.ok(wk, "a deload week exists");
  const d = [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays(wk.monday, i))
    .find((dt) => x.dayPlan(dt).t === "lift");
  x.sel = d;
  const card = x.accCard(wk, x.dayPlan(d));
  a.match(card, /None this week/, "checked against the books and kept: both mean a harder stop");
  a.doesNotMatch(card, /acc-slot/);
  // The difference from the heavy-week rule, which was stated as though it were the
  // book's: this one says out loud that it is ours, and so is the deload week.
  a.match(card, /<b>Ours<\/b>/);
  a.match(card, /TB1 prescribes no strength deload/);
  // Session mode agrees with the card, which is the thing that went wrong last time.
  a.equal(x.lsSteps(d).filter((s) => s.type === "acc").length, 0, "and the walkthrough matches");
});

/* TB2, BLACK PROTOCOL - EASY WEEK PRINCIPLE: "Every third week, (3, 6, 9) make your
   conditioning sessions easy. Cut the number of rounds in half, lower the duration
   and/or intensity." The timing was already right -- the same page says the easy week
   "purposely coincides with Tactical Barbell's strength training heavy weeks (90%-95%
   loads)" -- but the amount was the lowest prescribed option rather than half, and for
   four of the seven formats the lowest option IS the default. */
test("the easy week halves the rounds, which is the number TB2 gives", () => {
  const x = app({ now: "2026-11-11" });
  for (const [fmt, r] of Object.entries(x.IV)) {
    if (!r.rounds) continue;
    const base = r.def || r.rounds[0];
    a.equal(x.easeRounds(r, fmt, false, false), base, `${fmt} is untouched normally`);
    a.equal(x.easeRounds(r, fmt, false, true), Math.max(1, Math.round(base / 2)),
      `${fmt} is halved on an easy week`);
  }
  // The four that used to change by nothing at all.
  for (const fmt of ["map", "anaerobic", "threshold", "long"]) {
    const r = x.IV[fmt], base = r.def || r.rounds[0];
    a.ok(x.easeRounds(r, fmt, false, true) < base, `${fmt} actually comes down now`);
    a.equal(x.easeRounds(r, fmt, true, false), r.rounds[0], "a soft day is still the low option");
  }
});

test("a soft day and an easy week together take the lower of the two", () => {
  const x = app({ now: "2026-11-11" });
  // hillsprint is the one where our soft-day rule bites harder than the book's half.
  const hs = x.IV.hillsprint;
  a.equal(x.easeRounds(hs, "hillsprint", true, false), 3, "soft picks the lowest option");
  a.equal(x.easeRounds(hs, "hillsprint", false, true), 3, "half of six is three as well");
  // sprints is the one where halving bites harder than the lowest option.
  const sp = x.IV.sprints;
  a.equal(x.easeRounds(sp, "sprints", true, false), 5);
  a.equal(x.easeRounds(sp, "sprints", false, true), 4, "half of eight");
  a.equal(x.easeRounds(sp, "sprints", true, true), 4, "both: the lower one wins");
});

test("your own round count is what gets halved, not the book's default", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.ivRounds = { map: 10 }; x.bump();
  a.equal(x.easeRounds(x.IV.map, "map", false, false), 10, "your setting stands normally");
  a.equal(x.easeRounds(x.IV.map, "map", false, true), 5, "and it is yours that is halved");
});

test("the easy week reaches the session, not just the helper", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.bump();
  const heavy = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "heavy");
  const light = x.weeks().find((w) => w.kind === "cycle" && x.tier(+x.wkRx(w).p) === "light");
  const hicDay = (wk) => [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays(wk.monday, i))
    .find((d) => x.dayPlan(d).t === "hic" && x.effFmt(d) && x.effFmt(d) !== "liss");
  const hd = hicDay(heavy), ld = hicDay(light);
  a.ok(hd && ld, "both weeks have an interval session");
  const hf = x.effFmt(hd), lf = x.effFmt(ld);
  a.ok(x.ivOpts(hd, hf).rounds < x.ivOpts(ld, lf).rounds || hf !== lf,
    "the heavy week's session is shorter");
  a.equal(x.ivOpts(hd, hf).rounds, Math.max(1, Math.round(x.ivOpts(ld, hf).rounds / 2)),
    "and it is half, for the same format");
});

// --- warm-up routines --------------------------------------------------------------
test("90/90 breathing and hip switches are in every routine, whichever is picked", () => {
  const x = app({});
  for (const k of Object.keys(x.WARM_ROUTINES)) {
    x.plan.warmRoutine = k;
    if (k === "mine") x.plan.warmCustom = [["Hip airplane", "8 per side"]];
    x.bump();
    const names = x.warmItems().map((i) => i.n);
    a.ok(names.some((n) => /90\/90 breathing/.test(n)), `${k} has 90/90 breathing`);
    a.ok(names.some((n) => /90\/90 hip switches/.test(n)), `${k} has the hip switches`);
    a.equal(new Set(names).size, names.length, `${k} lists nothing twice`);
  }
});

test("Agile 8 is DeFranco's, at his doses, and is not claimed as the book's", () => {
  const x = app({});
  const names = x.AGILE8.map((i) => i.n).join(" | ");
  // The original, from "Training Rules for Washed-up Meatheads". Copies of this routine
  // differ: several swap in frog jumps or a bent-knee iron cross. The original has
  // mountain climbers and neither of those, so a copy drifting in should fail here.
  a.equal(x.AGILE8.length, 8, "eight, as the name says");
  for (const m of ["Foam roll IT band", "Foam roll adductors", "Rollovers into V-sits",
    "Fire hydrant circles", "Mountain climbers", "Groiners"])
    a.ok(names.includes(m), `${m} is in it`);
  a.ok(!/frog jump|iron cross/i.test(names), "and the variants' movements are not");
  const dose = (n) => x.AGILE8.find((i) => i.n.includes(n)).d;
  a.match(dose("Rollovers"), /^10 reps$/);
  a.match(dose("Mountain climbers"), /^20 total$/);
  a.match(dose("Groiners"), /10 reps, hold the last 10 sec/);
  a.match(dose("Static hip flexor"), /3 × 10 sec per leg/);
  a.match(x.WARM_ROUTINES.agile8.note, /DeFranco/, "attributed to him, not to the books");
  for (const i of x.AGILE8) a.ok(i.d, `${i.n} carries its dose`);
});

test("your own warm-up is yours, parsed the way the mobility lists are", () => {
  const x = app({});
  x.plan.warmRoutine = "mine";
  x.plan.warmCustom = [["Hip airplane", "8 per side"], ["Dead hang", ""], null, ["", "x"]];
  x.bump();
  const mine = x.warmMine();
  a.deepEqual(mine.map((i) => i.n), ["Hip airplane", "Dead hang"], "blanks are dropped");
  a.equal(mine[0].d, "8 per side");
  a.equal(mine[1].d, "", "a movement with no dose is still a movement");
  a.equal(x.warmItems().length, 4, "two of yours on top of the two that are always there");
  // Nothing is invented for it: no dose guidance, no short version.
  a.equal(x.WARM_ROUTINES.mine.short, undefined);
});

test("a short version belongs to the routine, not to whichever items are flagged", () => {
  const x = app({});
  // The core pair is marked short, so inferring from the items would offer Agile 8 an
  // empty "Short · " button.
  a.ok(x.WARM_CORE.every((i) => i.s), "the core pair is in the short version");
  a.equal(x.WARM_ROUTINES.ours.short, "7 min");
  a.equal(x.WARM_ROUTINES.agile8.short, undefined);
  x.plan.warmRoutine = "agile8"; x.bump();
  const card = x.warmupCard("2026-11-11");
  a.ok(!/Short · <\/button>|Short · "/.test(card), "no empty short button");
  a.ok(!/data-act="wshort"/.test(card), "and no version toggle at all");
  x.plan.warmRoutine = "ours"; x.bump();
  a.match(x.warmupCard("2026-11-11"), /data-act="wshort"/, "ours still has one");
});

/* The heavy-week rule was fixed in one of its three homes and shipped broken. The
   warm-up list has four readers, so this asserts they agree rather than trusting that
   I found them all. */
test("every reader of the warm-up walks the routine that is selected", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.warmRoutine = "agile8";
  x.bump();
  const d = [0, 1, 2, 3, 4, 5, 6].map((i) => x.addDays("2026-11-09", i))
    .find((dt) => x.dayPlan(dt).t === "lift");
  x.sel = d;
  const want = x.warmItems().map((i) => i.n);
  a.deepEqual(x.gdItems("warmup", d).map((i) => i.name), want, "the guided walkthrough");
  const card = x.warmupCard(d);
  for (const n of want) a.ok(card.includes(esc0(n)), `the card lists ${n}`);
  a.ok(!card.includes("Couch stretch"), "and nothing from the routine that is not picked");
});
function esc0(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }

test("every movement in every warm-up routine explains itself", () => {
  const x = app({});
  // Including yours, which cannot be explained and so must not pretend to be.
  for (const k of ["ours", "agile8"]) {
    x.plan.warmRoutine = k; x.bump();
    for (const w of x.warmItems()) {
      const e = x.mlibEntry(w.n);
      a.ok(e, `${k}: ${w.n} has an entry`);
      for (const f of ["setup", "exec", "cues", "errors"]) a.ok(e[f], `${k}: ${w.n} has ${f}`);
    }
  }
  x.plan.warmRoutine = "mine"; x.plan.warmCustom = [["Hip airplane", "8 per side"]]; x.bump();
  a.equal(x.mlibEntry("Hip airplane"), null, "nothing invented for a movement you typed in");
});

test("the Agile 8 descriptions are DeFranco's where he gave one, and say so where not", () => {
  const x = app({});
  // His own text covers these: the roll method, the cross-legged ball position, the
  // groiner cue and the one-side-at-a-time hip flexor hold.
  a.match(x.MLIB.a8itb.exec, /just under the hip/);
  a.match(x.MLIB.a8add.exec, /just below the groin crease/);
  a.match(x.MLIB.a8glute.note, /Feel free to cry/, "his whole note on it, kept");
  a.match(x.MLIB.a8groiner.cues, /push the knees outward/);
  a.match(x.MLIB.a8hipflex.exec, /Finish one side before switching/);
  // These three he shows in a video instead, so the description is the standard
  // movement and the note refuses to pass it off as his.
  for (const id of ["a8roll", "a8hydrant", "a8mtn"])
    a.match(x.MLIB[id].note, /shows this one in a video rather than describing it/,
      `${id} says where its description came from`);
  // And the ones he did describe make no such disclaimer.
  for (const id of ["a8itb", "a8add", "a8groiner", "a8hipflex"])
    a.ok(!/video/.test(x.MLIB[id].note || ""), `${id} needs no disclaimer`);
});

test("the Guide keeps Agile 8 together and names its author", () => {
  const g = app({}).vGuide();
  a.match(g, /Agile 8 · Joe DeFranco/, "one group, attributed");
  for (const id of ["a8itb", "a8add", "a8glute", "a8roll", "a8hydrant", "a8mtn", "a8groiner", "a8hipflex"])
    a.ok(g.includes(`data-px="ml-${id}"`), `${id} is reachable from the Guide`);
});

// --- the movement library, mid-session ---------------------------------------------
function gdBox() { return (global.document.getElementById("gd-in") || {}).innerHTML || "" }

test("the guided warm-up can show you how to do the movement you are on", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.warmRoutine = "agile8"; x.bump(); x.sel = "2026-11-11";
  x.guide = { kind: "warmup", date: "2026-11-11", pos: 2, how: false };
  x.gdRender();
  const shut = gdBox();
  a.match(shut, /data-gd="how"/, "there is a button for it");
  a.match(shut, /aria-expanded="false"/);
  a.ok(!/gd-how/.test(shut), "and it is closed, so the timer keeps the screen");
  a.ok(!/outer thigh/.test(shut), "the text is not rendered until asked for");

  a.equal(x.gdHow(), true, "tapping it turns it on");
  x.gdRender();
  const open = gdBox();
  a.match(open, /class="gd-how"/);
  a.match(open, /Setup\./);
  a.match(open, /Execution\./);
  a.match(open, /outer thigh/, "the entry for the movement you are actually on");
  a.match(open, /Hide how/, "and the button says what it will do now");
  a.equal(x.gdHow(), false, "and tapping it again turns it off");
  x.gdRender();
  a.ok(!/gd-how/.test(gdBox()), "the panel goes with it");
});

test("the how-to follows you from one movement to the next, and off again", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.warmRoutine = "agile8"; x.bump(); x.sel = "2026-11-11";
  x.guide = { kind: "warmup", date: "2026-11-11", pos: 2, how: true };
  x.gdRender();
  a.match(gdBox(), /outer thigh/, "IT band on movement three");
  // Someone learning a routine wants it the whole way through, so it stays on.
  x.guide.pos = 3; x.gdRender();
  const next = gdBox();
  a.match(next, /class="gd-how"/, "still open on the next movement");
  a.match(next, /inner thigh/, "and it is the next movement's entry, not the last one's");
  a.ok(!/outer thigh/.test(next), "the previous one is gone");
});

test("a movement with no entry gets no button rather than an empty panel", () => {
  const x = app({ now: "2026-11-11" });
  x.plan.warmRoutine = "mine";
  x.plan.warmCustom = [["Hip airplane", "8 per side"]];
  x.bump(); x.sel = "2026-11-11";
  const items = x.gdItems("warmup", "2026-11-11");
  const i = items.findIndex((it) => it.name === "Hip airplane");
  a.ok(i >= 0, "the movement you typed in is in the walkthrough");
  x.guide = { kind: "warmup", date: "2026-11-11", pos: i, how: true };
  x.gdRender();
  const h = gdBox();
  a.ok(!/data-gd="how"/.test(h), "nothing to offer, so nothing is offered");
  a.ok(!/class="gd-how"/.test(h), "and no empty panel even with it switched on");
  // The core pair is still explained, because those are ours.
  x.guide.pos = 0; x.gdRender();
  a.match(gdBox(), /data-gd="how"/, "90/90 breathing still explains itself");
});

test("session mode names the routine's own length, not the one it used to assume", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "app", "13-session-mode.js"), "utf8");
  a.ok(!/'7 min'|12–15 min/.test(src), "the old hardcoded pair is gone");
  a.match(src, /warmRoutine\(\)\.mins/, "it asks the routine instead");
});
