// The API against real SQL. api.test.js fakes D1 with a fixed answer to every query, which
// tests the handlers' logic and nothing about the schema or the statements. Here the
// migrations are applied to Node's SQLite and the Worker's own queries run against them:
// the upsert, the per-user isolation, the restore batch, FTS5 with porter stemming, the
// reports trim, the state ETag and the legacy claim.
const { test } = require("node:test");
const a = require("node:assert");
const { d1 } = require("./d1.js");
const { fakeKV, fakeR2 } = require("./fakes.js");

let api;
async function load() { return (api ||= await import("../src/api.js")) }

const ME = "lifter@example.com", OTHER = "someone.else@example.com";
// DEV_ALLOW_ANON is the local-dev door: the user comes from a header instead of an Access
// JWT. The JWT path has its own tests in api.test.js; this file is about the SQL.
function env(extra = {}) {
  return Object.assign({ DB: d1(), BACKUPS: fakeKV(), R2BACKUPS: fakeR2(), DEV_ALLOW_ANON: "1" }, extra);
}
async function call(env, route, init = {}, user = ME) {
  const { handleApi } = await load();
  const headers = Object.assign({ "x-dev-user": user }, init.headers || {});
  return handleApi(new Request("https://operatorblack.com/api/" + route, Object.assign({}, init, { headers })), env);
}
const put = (env, path, body, user) => call(env, "doc/" + path, { method: "PUT", body: JSON.stringify(body) }, user);
const state = async (env, user, headers) => call(env, "state", { headers }, user);

test("every migration applies from scratch and leaves the tables the API reads", () => {
  const db = d1();
  a.deepEqual(db.tables(), ["acc_catalog", "admin_log", "cal_feeds", "coach_debrief", "coach_log", "docs", "lib_chunk", "lib_doc", "reports"]);
  // 0002 moved docs to a (user, path) key; a second user with the same path must fit.
  db.rows("INSERT INTO docs (user, path, data, updated_at) VALUES ('a', 'plan/main', '{}', 1)");
  db.rows("INSERT INTO docs (user, path, data, updated_at) VALUES ('b', 'plan/main', '{}', 1)");
  a.equal(db.rows("SELECT COUNT(*) AS n FROM docs")[0].n, 2);
});

test("a document round-trips, a second PUT replaces it, and the owner's data never reaches another user", async () => {
  const e = env();
  a.equal((await put(e, "plan/main", { bar: 45 })).status, 204);
  a.equal((await put(e, "logs/2026-10-19", { date: "2026-10-19", rpe: 7 })).status, 204);
  a.equal((await put(e, "plan/main", { bar: 20 })).status, 204, "an upsert, not a duplicate key error");

  const mine = await (await state(e)).json();
  a.deepEqual(mine.plan, { bar: 20 }, "the second write won");
  a.deepEqual(Object.keys(mine.logs), ["2026-10-19"]);
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM docs WHERE user = ?", ME)[0].n, 2, "one row per path");

  const theirs = await (await state(e, OTHER)).json();
  a.equal(theirs.plan, null);
  a.deepEqual(theirs.logs, {});
  a.equal((await put(e, "plan/main", { bar: 15 }, OTHER)).status, 204);
  a.deepEqual((await (await state(e)).json()).plan, { bar: 20 }, "their plan is their own row");
});

test("a log path has to be a real date, and a document has to be an object", async () => {
  const e = env();
  a.equal((await put(e, "logs/2026-02-31", { x: 1 })).status, 404);
  a.equal((await put(e, "logs/2026-13-01", { x: 1 })).status, 404);
  a.equal((await put(e, "plan/main", [1, 2])).status, 400);
  a.equal((await put(e, "plan/other", { x: 1 })).status, 404);
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM docs")[0].n, 0, "nothing landed");
});

test("the state carries an ETag, and sending it back gets a 304 until something changes", async () => {
  const e = env();
  await put(e, "plan/main", { bar: 45 });
  const first = await state(e);
  const tag = first.headers.get("etag");
  a.match(tag, /^"\d+-\d+-\d+-\d+"$/, `a quoted fingerprint, got ${tag}`);
  a.equal(first.headers.get("cache-control"), "no-store");

  const again = await state(e, ME, { "if-none-match": tag });
  a.equal(again.status, 304, "nothing changed, nothing to send");
  a.equal(again.headers.get("etag"), tag);
  a.equal(await again.text(), "", "and no body");

  await put(e, "logs/2026-10-20", { date: "2026-10-20" });
  const after = await state(e, ME, { "if-none-match": tag });
  a.equal(after.status, 200, "a new log moves the tag");
  const tag2 = after.headers.get("etag");
  a.notEqual(tag2, tag);
  a.deepEqual(Object.keys((await after.json()).logs), ["2026-10-20"]);

  // Same row count and a write in the same millisecond, but different content: the size
  // term catches what count and time cannot.
  e.DB.rows("UPDATE docs SET data = ? WHERE user = ? AND path = 'plan/main'", JSON.stringify({ bar: 4500 }), ME);
  a.equal((await state(e, ME, { "if-none-match": tag2 })).status, 200, "an in-place edit moves it too");

  // The catalog is part of the state, so an administrator's change moves everyone's tag.
  const tag3 = (await state(e)).headers.get("etag");
  e.DB.rows("INSERT INTO acc_catalog (id, slot, name, gear, hidden, updated_at) VALUES ('x', 'push', 'Dips', '', 0, ?)", Date.now() + 5);
  a.equal((await state(e, ME, { "if-none-match": tag3 })).status, 200);

  // Someone else's tag means nothing here: their fingerprint is of their rows.
  const theirs = (await state(e, OTHER)).headers.get("etag");
  a.notEqual(theirs, (await state(e)).headers.get("etag"));
});

test("restore replaces everything in one batch and leaves a safety backup first", async () => {
  const e = env();
  await put(e, "plan/main", { bar: 45, old: true });
  await put(e, "logs/2026-01-01", { date: "2026-01-01" });
  await put(e, "logs/2026-01-02", { date: "2026-01-02" });
  await put(e, "plan/main", { bar: 15 }, OTHER);

  const file = {
    backedUpAt: "2026-09-01T09:00:00Z",
    plan: { bar: 20, fresh: true },
    logs: { "2026-05-05": { date: "2026-05-05", done: true }, "2026-02-30": { bad: true } },
    programs: { "block-1": { id: "block-1" }, "Bad Id!": { id: "x" } },
  };
  const res = await call(e, "restore", { method: "POST", body: JSON.stringify(file) });
  a.equal(res.status, 200);
  const out = await res.json();
  a.deepEqual(out.restored, { plan: true, logs: 1, programs: 1 }, "the impossible date and the bad id were skipped");
  a.ok(out.safetyBackup, "a safety backup was named");
  a.ok([...e.R2BACKUPS.m.keys()].some((k) => k.includes("before-restore")), "and written to R2 before the delete");

  const paths = e.DB.rows("SELECT path FROM docs WHERE user = ? ORDER BY path", ME).map((r) => r.path);
  a.deepEqual(paths, ["logs/2026-05-05", "plan/main", "programs/block-1"]);
  a.deepEqual(JSON.parse(e.DB.rows("SELECT data FROM docs WHERE user = ? AND path = 'plan/main'", ME)[0].data), { bar: 20, fresh: true });
  a.deepEqual(JSON.parse(e.DB.rows("SELECT data FROM docs WHERE user = ? AND path = 'plan/main'", OTHER)[0].data), { bar: 15 }, "the other person's rows are untouched");
});

test("the library search runs FTS5 with porter stemming and ranks by bm25", async () => {
  const e = env();
  e.DB.rows("INSERT INTO lib_doc (id, title, short, chunks, updated_at) VALUES ('tb1', 'Tactical Barbell', 'TB1', 3, 1)");
  const ins = e.DB.db.prepare("INSERT INTO lib_chunk (doc, ref, body) VALUES (?, ?, ?)");
  ins.run("tb1", "p40", "The deadlift is trained once a week in Operator because it is the most taxing lift.");
  ins.run("tb1", "p41", "Recovery weeks: lighter loads, the same movements.");
  ins.run("tb1", "p42", "Deadlifts respond to low volume. Pull heavy, and rarely.");
  ins.run("tb1", "p43", "Training the squat three times a week works because the load is submaximal.");

  // "training" and "deadlifts" stem to the same tokens as "trained" and "deadlift", which
  // is what 0008's porter tokenizer is for. (Its comment's own example does not hold:
  // porter leaves "recovering" and "recovery" apart. Checked against SQLite directly.)
  const res = await call(e, "library/search?q=how%20should%20I%20be%20training%20my%20deadlifts");
  a.equal(res.status, 200);
  const { hits, matched } = await res.json();
  a.equal(hits.length, 3, `three passages mention either word, got ${hits.length}: ${hits.map((h) => h.ref)}`);
  a.equal(hits[0].ref, "p40", "the one that matched every term comes first");
  a.equal(matched, "both", "one strict hit is too few, so the loose pass filled in behind it");
  for (const h of hits) a.match(h.body, /deadlift|train/i);
  a.ok(!hits.some((h) => h.ref === "p41"), "the passage with neither word is not a hit");
  a.ok(hits.every((h) => typeof h.score === "number"), "bm25 scores come back");

  const none = await (await call(e, "library/search?q=the%20a%20of")).json();
  a.deepEqual(none, { hits: [], matched: "none" }, "stop words alone search nothing");

  const list = await (await call(e, "library")).json();
  a.deepEqual(list.docs.map((d) => d.id), ["tb1"]);
  a.ok(!("body" in list.docs[0]), "titles and counts only, never the text");
});

test("a report is stored against the sender and the table is kept to 200 rows", async () => {
  const e = env();
  const send = (body, kind) => call(e, "report", { method: "POST", body: JSON.stringify({ body, kind, version: "3.70", ua: "test" }) });
  a.equal((await send("", "x")).status, 400, "an empty report is refused");
  a.equal((await send("the beep did not sound", "timer")).status, 200);
  a.deepEqual(e.DB.rows("SELECT user, kind, version, ua, body FROM reports"), [{ user: ME, kind: "timer", version: "3.70", ua: "test", body: "the beep did not sound" }]);

  const ins = e.DB.db.prepare("INSERT INTO reports (user, at, kind, version, ua, body) VALUES (?, ?, 'old', '', '', 'x')");
  for (let i = 0; i < 230; i++) ins.run(ME, 1000 + i);
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM reports")[0].n, 231);
  await send("newest", "timer");
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM reports")[0].n, 200, "trimmed after the insert");
  // Two inserts can share a millisecond, so `at` alone does not order them; id does.
  a.equal(e.DB.rows("SELECT body FROM reports ORDER BY at DESC, id DESC LIMIT 1")[0].body, "newest", "the newest is kept");
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM reports WHERE at < ?", 1031)[0].n, 0, "the oldest went");
});

test("legacy rows are claimed by an owner's first sign-in and by nobody else", async () => {
  const e = env({ LEGACY_OWNERS: ME });
  e.DB.rows("INSERT INTO docs (user, path, data, updated_at) VALUES ('__legacy__', 'plan/main', '{\"bar\":45}', 1)");
  e.DB.rows("INSERT INTO docs (user, path, data, updated_at) VALUES ('__legacy__', 'logs/2026-01-01', '{}', 1)");

  const theirs = await (await state(e, OTHER)).json();
  a.equal(theirs.plan, null, "not an owner: sees nothing");
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM docs WHERE user = '__legacy__'")[0].n, 2, "and claims nothing");

  const mine = await (await state(e)).json();
  a.deepEqual(mine.plan, { bar: 45 }, "the owner's first request takes the rows over");
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM docs WHERE user = '__legacy__'")[0].n, 0);
  a.equal(e.DB.rows("SELECT COUNT(*) AS n FROM docs WHERE user = ?", ME)[0].n, 2);
});

test("the export is everything of yours, as a downloadable file, and nothing of anyone else's", async () => {
  const e = env();
  await put(e, "plan/main", { bar: 45 });
  await put(e, "logs/2026-03-03", { date: "2026-03-03" }, OTHER);
  const res = await call(e, "export");
  a.equal(res.status, 200);
  a.match(res.headers.get("content-disposition"), /attachment; filename="operator-black-\d{4}-\d{2}-\d{2}\.json"/);
  const out = await res.json();
  a.equal(out.user, ME);
  a.deepEqual(out.plan, { bar: 45 });
  a.deepEqual(out.logs, {});
  a.ok(out.exportedAt);
});

test("the coach's readers take the plan and a range of days, by the primary key", async () => {
  const { readPlan, readLogs } = await load();
  const e = env();
  a.equal(await readPlan(e, ME), null, "no plan yet is null, not a throw");
  await put(e, "plan/main", { bar: 45 });
  await put(e, "programs/old-one", { name: "Old" });
  for (const d of ["2026-10-04", "2026-10-05", "2026-10-08", "2026-10-11", "2026-10-12"]) await put(e, "logs/" + d, { date: d });
  await put(e, "logs/2026-10-06", { date: "theirs" }, OTHER);

  a.deepEqual(await readPlan(e, ME), { bar: 45 });
  // A week, both ends included, and nobody else's day inside it.
  a.deepEqual(Object.keys(await readLogs(e, ME, { from: "2026-10-05", to: "2026-10-11" })).sort(), ["2026-10-05", "2026-10-08", "2026-10-11"]);
  // The newest few. Only logs: the plan and the archived program sort either side of them.
  a.deepEqual(Object.keys(await readLogs(e, ME, { last: 2 })).sort(), ["2026-10-11", "2026-10-12"]);
  a.equal(Object.keys(await readLogs(e, ME, { last: 50 })).length, 5);
});

test("the local-dev door only opens from this machine", async () => {
  const e = env();   // DEV_ALLOW_ANON=1, and no Access settings at all
  const from = (ip) => call(e, "state", { headers: ip ? { "cf-connecting-ip": ip } : {} });
  for (const ip of [null, "::1", "127.0.0.1"]) a.equal((await from(ip)).status, 200, `${ip || "no address (a test)"} is local`);
  // The variable set by mistake on the deployed Worker: every real request carries the
  // caller's address, so the header naming a user is not honored and Access is required.
  const res = await from("203.0.113.9");
  a.equal(res.status, 503, "a request from the internet falls through to the Access check");
});
