// Worker-side tests. These are the first: src/api.js holds the data and enforces that
// one person cannot read another's, and until now none of it was covered.
//
// No Miniflare and no wrangler dev. The bindings this code uses are small enough to
// stand in for directly, which keeps the suite a plain `node --test` run, and the fakes
// below are written against the real R2 and KV surfaces rather than a convenient subset.
const { test } = require("node:test");
const a = require("node:assert");

let api;
async function load() { return (api ||= await import("../src/api.js")); }

/* ---------------- stand-ins for the bindings ---------------- */

function fakeKV() {
  const m = new Map();
  return {
    m,
    async put(key, body, opts) { m.set(key, { body, metadata: (opts || {}).metadata || {} }) },
    async get(key) { return m.has(key) ? m.get(key).body : null },
    async delete(key) { m.delete(key) },
    async list({ prefix, cursor }) {
      // Paginate at 2 so the cursor loop is actually exercised, not just the first page.
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? keys.indexOf(cursor) + 1 : 0;
      const page = keys.slice(from, from + 2);
      const done = from + 2 >= keys.length;
      return {
        keys: page.map((name) => ({ name, metadata: m.get(name).metadata })),
        list_complete: done,
        cursor: done ? undefined : page[page.length - 1],
      };
    },
  };
}

function fakeR2() {
  const m = new Map();
  return {
    m,
    async put(key, body, opts) {
      m.set(key, { body, size: body.length, uploaded: new Date("2026-10-07T09:00:00Z"), customMetadata: (opts || {}).customMetadata || {} });
    },
    async get(key) { const o = m.get(key); return o ? { text: async () => o.body } : null },
    async delete(key) { m.delete(key) },
    async list({ prefix, cursor }) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? keys.indexOf(cursor) + 1 : 0;
      const page = keys.slice(from, from + 2);
      const truncated = from + 2 < keys.length;
      return {
        objects: page.map((key) => ({ key, ...m.get(key) })),
        truncated,
        cursor: truncated ? page[page.length - 1] : undefined,
      };
    },
  };
}

function fakeEnv({ r2 = true, kv = true, docs = [] } = {}) {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: docs }),
          first: async () => null,
          run: async () => ({}),
        }),
      }),
    },
  };
  if (kv) env.BACKUPS = fakeKV();
  if (r2) env.R2BACKUPS = fakeR2();
  return env;
}

const USER = "lifter@example.com";
const OTHER = "someone.else@example.com";

/* ---------------- retention ---------------- */

const entry = (name, at) => ({ name, at });
const weeks = (n) => Array.from({ length: n }, (_, i) => entry(`2026-${String(12 - (i % 12)).padStart(2, "0")}-0${(i % 9) + 1}`, `2026-x-${String(999 - i).padStart(3, "0")}`));

test("each kind of backup gets its own budget, so manual ones cannot eat the weeklies", async () => {
  const { backupsToPrune, backupKind } = await load();

  a.equal(backupKind("2026-10-04"), "auto");
  a.equal(backupKind("2026-10-04-manual"), "manual");
  a.equal(backupKind("2026-10-04-before-restore"), "safety");
  a.equal(backupKind("2026-10-04-before-restore-091500"), "safety");

  // 26 weeklies and nothing else: nothing to do.
  a.deepEqual(backupsToPrune(weeks(26)), [], "26 automatic backups are all kept");

  // The 27th pushes out exactly the oldest one.
  const w27 = weeks(27);
  a.deepEqual(backupsToPrune(w27), [w27[26].name], "and only the oldest");

  // The bug this replaces: a burst of manual backups used to delete weekly history.
  // The list arrives newest first, so the manual ones sit on top.
  const burst = [...Array.from({ length: 10 }, (_, i) => entry(`2026-10-0${i % 9}-manual`, `2026-z-${i}`)), ...weeks(26)];
  const gone = backupsToPrune(burst);
  a.ok(gone.every((n) => n.endsWith("-manual")), `only manual ones go, got ${gone}`);
  a.equal(gone.length, 4, "ten manual minus the six kept");
  for (const w of weeks(26)) a.ok(!gone.includes(w.name), "every weekly survives");
});

test("pruning never empties a kind, however old the last one is", async () => {
  const { backupsToPrune } = await load();
  // One ancient backup of each kind and nothing else: all three stay. An age-based
  // lifecycle rule would delete these, which is exactly why pruning counts instead.
  const old = [entry("2019-01-01", "2019-a"), entry("2019-01-02-manual", "2019-b"), entry("2019-01-03-before-restore", "2019-c")];
  a.deepEqual(backupsToPrune(old), []);

  // And a kind that is over budget never takes another kind down with it.
  const many = [...Array.from({ length: 9 }, (_, i) => entry(`2026-10-0${i}-before-restore`, `2026-s-${i}`)), entry("2019-01-01", "2019-a")];
  const gone = backupsToPrune(many);
  a.equal(gone.length, 3, "nine safety copies minus the six kept");
  a.ok(!gone.includes("2019-01-01"), "the lone weekly is untouched");
});

/* ---------------- storage ---------------- */

test("a backup is written to R2, and read back from it", async () => {
  const { backupNow, listBackups, readBackup } = await load();
  const env = fakeEnv({ docs: [{ path: "plan/main", data: '{"bar":45}' }, { path: "logs/2026-10-05", data: '{"date":"2026-10-05"}' }] });

  const res = await backupNow(env, USER, { manual: true });
  a.match(res.name, /^\d{4}-\d{2}-\d{2}-manual$/);
  a.equal(res.logs, 1, "it counted the day it saved");
  a.equal(env.R2BACKUPS.m.size, 1, "it went to R2");
  a.equal(env.BACKUPS.m.size, 0, "and not to KV");

  const body = JSON.parse(await readBackup(env, USER, res.name));
  a.deepEqual(body.plan, { bar: 45 }, "the plan is in there");
  a.deepEqual(Object.keys(body.logs), ["2026-10-05"]);
  a.equal(body.user, USER);

  const list = await listBackups(env, USER);
  a.equal(list.length, 1);
  a.equal(list[0].bytes > 0, true, "with a size");
  a.equal(list[0].logs, 1, "and the log count survives R2's strings-only metadata");
});

test("backups taken before the move to R2 are still listed, readable and prunable", async () => {
  const { listBackups, readBackup, deleteBackup, backupPrefix } = await load();
  const env = fakeEnv();
  const p = await backupPrefix(USER);

  // Two old ones in KV, one new one in R2.
  await env.BACKUPS.put(p + "2026-09-06", '{"old":1}', { metadata: { bytes: 9, logs: 3, at: "2026-09-06T09:00:00Z" } });
  await env.BACKUPS.put(p + "2026-09-13", '{"old":2}', { metadata: { bytes: 9, logs: 4, at: "2026-09-13T09:00:00Z" } });
  await env.R2BACKUPS.put(p + "2026-10-04", '{"new":1}', { customMetadata: { logs: "20", at: "2026-10-04T09:00:00Z" } });

  const list = await listBackups(env, USER);
  a.deepEqual(list.map((b) => b.name), ["2026-10-04", "2026-09-13", "2026-09-06"], "both stores, newest first");
  a.equal(list[2].logs, 3, "KV metadata is preserved");

  a.equal(await readBackup(env, USER, "2026-09-06"), '{"old":1}', "an old backup still restores");
  a.equal(await readBackup(env, USER, "2026-10-04"), '{"new":1}');
  a.equal(await readBackup(env, USER, "2026-01-01"), null, "and a name that never existed is nothing");

  // Pruning has to reach into KV or old backups would be immortal.
  await deleteBackup(env, USER, "2026-09-06");
  a.equal((await listBackups(env, USER)).length, 2);
  a.equal(env.BACKUPS.m.size, 1, "it really went");
});

test("the same name in both stores resolves to R2, and deleting clears both", async () => {
  const { listBackups, readBackup, deleteBackup, backupPrefix } = await load();
  const env = fakeEnv();
  const p = await backupPrefix(USER);
  await env.BACKUPS.put(p + "2026-10-04", '{"from":"kv"}', { metadata: { at: "2026-10-04T09:00:00Z" } });
  await env.R2BACKUPS.put(p + "2026-10-04", '{"from":"r2"}', { customMetadata: { at: "2026-10-04T09:00:00Z" } });

  const list = await listBackups(env, USER);
  a.equal(list.length, 1, "it is one backup, not two");
  a.equal(await readBackup(env, USER, "2026-10-04"), '{"from":"r2"}', "R2 wins");

  await deleteBackup(env, USER, "2026-10-04");
  a.equal(env.R2BACKUPS.m.size, 0);
  a.equal(env.BACKUPS.m.size, 0, "no orphan left behind in KV");
});

test("without the R2 binding it still works, writing to KV", async () => {
  const { backupNow, listBackups, readBackup } = await load();
  const env = fakeEnv({ r2: false, docs: [{ path: "logs/2026-10-05", data: '{"date":"2026-10-05"}' }] });
  const res = await backupNow(env, USER, { manual: false });
  a.equal(env.BACKUPS.m.size, 1, "fell back rather than failing");
  a.equal((await listBackups(env, USER)).length, 1);
  a.ok((await readBackup(env, USER, res.name)).includes("2026-10-05"));
});

/* ---------------- one person's backups are their own ---------------- */

test("backups are scoped to the person, and the key never contains their address", async () => {
  const { backupNow, listBackups, readBackup, backupPrefix } = await load();
  const env = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: '{"date":"2026-10-05"}' }] });

  const mine = await backupNow(env, USER, { manual: true });
  await backupNow(env, OTHER, { manual: true });

  a.equal((await listBackups(env, USER)).length, 1, "I see one backup");
  a.equal((await listBackups(env, OTHER)).length, 1, "so do they");
  a.notEqual(await backupPrefix(USER), await backupPrefix(OTHER), "different prefixes");

  // Same name, different person: asking for mine must not hand me theirs.
  const a1 = await readBackup(env, USER, mine.name);
  const a2 = await readBackup(env, OTHER, mine.name);
  a.ok(a1.includes(USER));
  a.ok(a2.includes(OTHER));
  a.notEqual(a1, a2, "two people's backups never collide");

  for (const key of env.R2BACKUPS.m.keys()) {
    a.ok(!key.includes("@"), `the object key carries no email: ${key}`);
    a.ok(!key.includes("lifter"), "not even part of one");
  }
});

test("the weekly run backs up every real user and skips the legacy rows", async () => {
  const { backupEveryone } = await load();
  const env = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: "{}" }] });
  // Two different queries run here: the roll-call of users, then each one's documents.
  let excludedFromRollCall;
  env.DB.prepare = (sql) => ({
    bind: (arg) => {
      const rollCall = /DISTINCT\s+user/i.test(sql);
      if (rollCall) excludedFromRollCall = arg;
      return {
        all: async () => ({ results: rollCall ? [{ user: USER }, { user: OTHER }] : [{ path: "logs/2026-10-05", data: "{}" }] }),
        run: async () => ({}),
        first: async () => null,
      };
    },
  });
  await backupEveryone(env);
  a.equal(excludedFromRollCall, "__legacy__", "the legacy rows are excluded in SQL, not after");
  a.equal(env.R2BACKUPS.m.size, 2, "one each");
});

test("taking a backup prunes by kind for real, not just in the helper", async () => {
  // The helper above is tested in isolation, which proves nothing about whether
  // backupNow uses it. Reverting backupNow to the old shared-pool prune left every
  // other test in this file passing, so this one drives the whole path instead.
  const { backupNow, listBackups, backupPrefix } = await load();
  const env = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: "{}" }] });
  const p = await backupPrefix(USER);

  // A full six months of weeklies, then a busy afternoon of manual ones on top.
  for (let i = 0; i < 26; i++) {
    const at = `2026-04-${String(i + 1).padStart(2, "0")}T09:00:00Z`;
    await env.R2BACKUPS.put(p + `week-${String(i).padStart(2, "0")}`, "{}", { customMetadata: { at } });
  }
  for (let i = 0; i < 8; i++) {
    const at = `2026-10-06T0${i}:00:00Z`;
    await env.R2BACKUPS.put(p + `2026-10-0${i}-manual`, "{}", { customMetadata: { at } });
  }
  a.equal(env.R2BACKUPS.m.size, 34);

  await backupNow(env, USER, { manual: true });

  const after = await listBackups(env, USER);
  const kept = (pred) => after.filter((b) => pred(b.name)).length;
  a.equal(kept((n) => n.startsWith("week-")), 26, "every weekly survived the burst");
  a.equal(kept((n) => n.endsWith("-manual")), 6, "and the manual ones were capped at six");
});
