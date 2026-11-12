// connect(): the page's read of /api/state on open and on every return from the
// background. The harness's fetch never resolves, so this file swaps in one that answers
// like the Worker, with ETags, and checks the page sends the tag back and does nothing
// with a 304 except carry on.
const { test } = require("node:test");
const a = require("node:assert");
const { loadApp } = require("./harness.js");

function server(x, initial) {
  const calls = [];
  let body = initial, tag = '"1-1-1-0"';
  const headers = (h) => ({ get: (k) => h[k.toLowerCase()] ?? null });
  global.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, headers: (init && init.headers) || {} });
    if (u === "/api/state") {
      const sent = calls[calls.length - 1].headers["if-none-match"];
      if (sent && sent === tag) return { type: "basic", ok: false, status: 304, headers: headers({ etag: tag }), json: async () => { throw new Error("no body") } };
      return { type: "basic", ok: true, status: 200, headers: headers({ etag: tag }), json: async () => JSON.parse(JSON.stringify(body)) };
    }
    // Anything else (alerts status, version): an empty answer is enough.
    return { type: "basic", ok: true, status: 200, headers: headers({}), json: async () => ({}) };
  };
  return { calls, set(next) { body = next; tag = '"' + Math.random().toString().slice(2, 8) + '"' }, states: () => calls.filter((c) => c.url === "/api/state") };
}

test("the first read is in full and the tag is kept; the next sends it and a 304 changes nothing", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: { "2026-10-01": { date: "2026-10-01", rpe: 7 } }, programs: {} });
  x.loaded = true;

  await x.connect();
  a.equal(srv.states().length, 1);
  a.equal(srv.states()[0].headers["if-none-match"], undefined, "nothing to compare against yet");
  a.equal(x.stateTag, '"1-1-1-0"', "the ETag is remembered");
  a.equal(x.logs["2026-10-01"].rpe, 7, "and the state applied");
  a.equal(x.plan.bar, 45);

  await x.connect();
  a.equal(srv.states().length, 2);
  a.equal(srv.states()[1].headers["if-none-match"], '"1-1-1-0"', "the tag goes back");
  a.equal(x.logs["2026-10-01"].rpe, 7, "a 304 leaves the state as it was");
  a.equal(x.stateTag, '"1-1-1-0"');
  a.equal(x.dom.made.status.textContent, "Saved", "and the page still settles on Saved");
});

test("a changed server answers in full, the new tag is kept, and the change lands", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: {}, programs: {} });
  x.loaded = true;
  await x.connect();
  const first = x.stateTag;

  srv.set({ user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: { "2026-10-02": { date: "2026-10-02", pullups: 9 } }, programs: {} });
  await x.connect();
  a.equal(srv.states()[1].headers["if-none-match"], first, "the old tag was offered");
  a.notEqual(x.stateTag, first, "and replaced");
  a.equal(x.logs["2026-10-02"].pullups, 9, "the new log arrived");
});

test("a different person signing in on this phone drops the tag with everything else", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: {}, programs: {} });
  x.loaded = true;
  await x.connect();
  a.equal(x.me, "me@example.com");
  srv.set({ user: "other@example.com", plan: { bar: 20, onboarded: true, schema: x.SCHEMA }, logs: {}, programs: {} });
  await x.connect();
  a.equal(x.me, "other@example.com");
  a.equal(x.plan.bar, 20);
  a.ok(x.stateTag && x.stateTag !== '"1-1-1-0"', "the new person's tag, not the old one's");
});

/* ---------------- 3.78 ---------------- */
const tick = () => new Promise((r) => setImmediate(r));
const PLAN = (x, more) => Object.assign({ bar: 45, onboarded: true, schema: x.SCHEMA }, more);

test("a clash is the server's copy moving under unsent changes, not just differing from them", () => {
  const x = loadApp();
  const d = "2026-10-05";
  x.applyState({ plan: PLAN(x), logs: { [d]: { date: d, rpe: 7 } }, programs: {} });
  x.setLog(d, "rpe", 8);

  // The server answers again and that day is as it was when the edit began. This used
  // to be recorded as "changed on another device", after nothing more than ticking a
  // set and switching apps before it had sent.
  x.applyState({ plan: PLAN(x), logs: { [d]: { date: d, rpe: 7 }, "2026-10-06": { date: "2026-10-06", pullups: 9 } }, programs: {} });
  a.deepEqual(x.conflicts(), [], "nobody else touched it");
  a.equal(x.lg(d).rpe, 8, "and the unsent edit is still here");

  // Now it really has been changed somewhere else.
  x.applyState({ plan: PLAN(x), logs: { [d]: { date: d, rpe: 5 } }, programs: {} });
  a.deepEqual(x.conflicts().map((c) => c.path), ["logs/" + d]);
  a.equal(x.lg(d).rpe, 8, "this device's version still wins; that rule has not changed");
});

test("a plan changed elsewhere under an unsent edit is written down, like a day is", () => {
  const x = loadApp();
  x.applyState({ plan: PLAN(x), logs: {}, programs: {} });
  x.setPlan("bar", 20);
  x.applyState({ plan: PLAN(x), logs: {}, programs: {} });
  a.deepEqual(x.conflicts(), [], "the server still holds what the edit started from");

  // The other device changed the plan. Ours is kept, as ever -- but the plan is the
  // document a clash costs most on, and it used to be the one kept in silence.
  x.applyState({ plan: PLAN(x, { bar: 35 }), logs: {}, programs: {} });
  a.deepEqual(x.conflicts().map((c) => c.path), ["plan/main"]);
  a.equal(x.plan.bar, 20);
  a.match(x.syncCard(), /Your plan and settings/);
});

test("the base survives the app being closed with the change still waiting", () => {
  const x = loadApp();
  const d = "2026-10-05";
  x.applyState({ plan: PLAN(x), logs: { [d]: { date: d, rpe: 7 } }, programs: {} });
  x.setLog(d, "rpe", 8);
  a.equal(typeof JSON.parse(x.dom.store["ob.bases"])["logs/" + d], "number", "kept on the phone, beside the outbox");
  // Changes made offline off the cached copy have a base too: the cache is the server's
  // copy as this phone last knew it.
  x.dom.store["ob.cache"] = JSON.stringify({ plan: PLAN(x), logs: { [d]: { date: d, rpe: 7 }, "2026-10-06": { date: "2026-10-06", rpe: 6 } }, programs: {} });
  x.loadLocal();
  x.setLog("2026-10-06", "rpe", 9);
  x.applyState({ plan: PLAN(x), logs: { [d]: { date: d, rpe: 7 }, "2026-10-06": { date: "2026-10-06", rpe: 6 } }, programs: {} });
  a.deepEqual(x.conflicts(), [], "reopening and syncing an offline edit is not a clash");
});

test("every write names who the page thinks it is, and a read does not", async () => {
  const x = loadApp();
  const srv = server(x, { user: "j\u00fcrgen@example.com", plan: PLAN(x), logs: {}, programs: {} });
  await x.connect();
  x.setLog("2026-10-05", "rpe", 8);
  await x.flush("logs/2026-10-05");
  const put = srv.calls.find((c) => c.url === "/api/doc/logs/2026-10-05");
  a.equal(put.headers["x-ob-user"], "j%C3%BCrgen%40example.com", "encoded, because a header cannot carry \u00fc");
  a.ok(srv.states().every((c) => !("x-ob-user" in c.headers)));
});

test("a write refused as somebody else's asks who is signed in, and their queue goes with them", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: PLAN(x), logs: {}, programs: {} });
  await x.connect();
  x.setLog("2026-10-05", "rpe", 8);

  // Somebody else signs in on this phone before that has sent.
  srv.set({ user: "other@example.com", admin: true, catalog: [{ id: "cat-x", slot: "core", name: "X", gear: "", hidden: false }], plan: PLAN(x, { bar: 20 }), logs: {}, programs: {} });
  const answer = global.fetch;
  global.fetch = async (url, init) => (String(url).startsWith("/api/doc/")
    ? { type: "basic", ok: false, status: 409, headers: { get: () => null }, json: async () => ({}) } : answer(url, init));
  await x.flush("logs/2026-10-05");
  for (let i = 0; i < 5; i++) await tick();

  a.equal(x.me, "other@example.com", "the 409 sent it to /api/state, which said who");
  a.ok(!("logs/2026-10-05" in x.outbox), "the first person's unsent day is not waiting to go to the second");
  a.equal(x.lg("2026-10-05").rpe, undefined);
  // And the newcomer keeps what the same answer said about them: switchUser used to
  // clear the admin flag and the shared list after they had been set.
  a.equal(x.amAdmin, true);
  a.equal(x.catalog.length, 1);
});

test("a write the server will never take is not asked again every five seconds", async () => {
  const x = loadApp();
  server(x, { user: "me@example.com", plan: PLAN(x), logs: {}, programs: {} });
  await x.connect();
  x.setLog("2026-10-05", "rpe", 8);
  const answer = global.fetch, realTimeout = global.setTimeout;
  let status = 400; const delays = [];
  global.fetch = async (url, init) => (String(url).startsWith("/api/doc/")
    ? { type: "basic", ok: false, status, headers: { get: () => null }, json: async () => ({}) } : answer(url, init));
  // A real timer id is never 0, and flush() reads a falsy one as "no retry waiting".
  global.setTimeout = (fn, ms) => (delays.push(ms), 1);
  try {
    await x.flush("logs/2026-10-05");
    a.deepEqual(delays.filter((ms) => ms === 5000), [], "no retry is scheduled for a 400");
    a.ok("logs/2026-10-05" in x.outbox, "but what was typed is kept, and goes up again on the next open");
    a.match(x.dom.made.status.textContent, /Can\u2019t save this entry \(400\)/);

    status = 500;
    x.flushAll(); await tick(); await tick();
    a.ok(delays.includes(5000), "a server having a bad minute is still retried");
  } finally { global.setTimeout = realTimeout }
});

test("when the phone will not store the cache, it is dropped rather than left stale, and Setup says so", () => {
  const x = loadApp();
  x.applyState({ plan: PLAN(x), logs: {}, programs: {} });
  x.dom.store["ob.cache"] = JSON.stringify({ plan: PLAN(x, { bar: 15 }), logs: {}, programs: {} });   // an older copy
  const real = localStorage.setItem;
  let full = (k) => k === "ob.cache";
  localStorage.setItem = (k, v) => { if (full(k)) throw new Error("QuotaExceededError"); real(k, v) };
  try {
    a.equal(x.storageCard(), "", "nothing to say while storage works");
    x.setLog("2026-10-05", "rpe", 8);
    a.equal(x.writeCache(), false);
    a.equal(x.cacheOff, true);
    a.ok(!("ob.cache" in x.dom.store), "an old copy is worse than none: offline it would pass for current");
    a.ok(JSON.parse(x.dom.store["ob.outbox"])["logs/2026-10-05"], "the unsent change is on the phone");
    a.match(x.storageCard(), /needs signal to open/);
    a.match(x.vSetup(), /can\u2019t keep an offline copy/);

    // Fuller still: the outbox only fits once the cache is out of the way. It outranks it.
    full = () => false; x.writeCache(); a.equal(x.cacheOff, false, "room again, cache again");
    full = (k) => k === "ob.outbox" && "ob.cache" in x.dom.store;
    x.setLog("2026-10-05", "rpe", 9);
    a.equal(x.outboxOff, false, "the cache was dropped to make room");
    a.equal(JSON.parse(x.dom.store["ob.outbox"])["logs/2026-10-05"].rpe, 9);
    a.ok(!("ob.cache" in x.dom.store));

    // And when even that fails, it does not say "saved on phone".
    full = () => true;
    x.setLog("2026-10-05", "rpe", 10);
    a.equal(x.outboxOff, true);
    a.match(x.errText(null), /not saved on phone/);
    a.match(x.storageCard(), /Keep the app open/);
  } finally { localStorage.setItem = real }
});

test("unsent changes with no cache under them wait for the server before anything can be edited", () => {
  const x = loadApp();
  x.outbox = { "logs/2026-10-05": { date: "2026-10-05", rpe: 8 } };
  delete x.dom.store["ob.cache"]; x.loaded = false;
  a.equal(x.loadLocal(), false);
  a.equal(x.lg("2026-10-05").rpe, 8, "the waiting change is laid out");
  a.equal(x.loaded, false, "but the plan on screen is defaults, so nothing may be built on it");
  x.setPlan("bar", 20);
  a.ok(!("plan/main" in x.outbox), "an edit now would be defaults queued to replace the real plan");

  x.dom.store["ob.cache"] = JSON.stringify({ plan: PLAN(x), logs: {}, programs: {} });
  a.equal(x.loadLocal(), true);
  a.equal(x.loaded, true, "with a cache, offline works as it always has");
});
