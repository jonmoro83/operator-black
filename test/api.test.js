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
  a.equal(nBackups(env.R2BACKUPS), 1, "it went to R2");
  a.equal(nBackups(env.BACKUPS), 0, "and not to KV");
  a.equal(res.verified, true, "and it read back as what it should hold");

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
  a.equal(nBackups(env.BACKUPS), 1, "it really went");
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
  a.equal(nBackups(env.R2BACKUPS), 0);
  a.equal(nBackups(env.BACKUPS), 0, "no orphan left behind in KV");
});

test("without the R2 binding it still works, writing to KV", async () => {
  const { backupNow, listBackups, readBackup } = await load();
  const env = fakeEnv({ r2: false, docs: [{ path: "logs/2026-10-05", data: '{"date":"2026-10-05"}' }] });
  const res = await backupNow(env, USER, { manual: false });
  a.equal(nBackups(env.BACKUPS), 1, "fell back rather than failing");
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
  a.equal(nBackups(env.R2BACKUPS), 2, "one each");
});

test("taking a backup prunes by kind for real, not just in the helper", async () => {
  // The helper above is tested in isolation, which proves nothing about whether
  // backupNow uses it. Reverting backupNow to the old shared-pool prune left every
  // other test in this file passing, so this one drives the whole path instead.
  const { backupNow, listBackups, backupPrefix } = await load();
  const env = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: "{}" }] });
  const p = await backupPrefix(USER);

  // A full six months of real weekly dates, then a busy afternoon of manual ones.
  const weeklies = [];
  for (let i = 0; i < 26; i++) {
    const d = new Date(Date.UTC(2026, 3, 5) - i * 7 * 864e5).toISOString().slice(0, 10);
    weeklies.push(d);
    await env.R2BACKUPS.put(p + d, "{}", { customMetadata: { at: d + "T09:00:00Z" } });
  }
  for (let i = 1; i <= 8; i++) {
    await env.R2BACKUPS.put(p + `2026-10-0${i}-manual`, "{}", { customMetadata: { at: `2026-10-0${i}T09:00:00Z` } });
  }
  a.equal(nBackups(env.R2BACKUPS), 34);

  await backupNow(env, USER, { manual: true });

  const after = await listBackups(env, USER);
  const names = after.map((b) => b.name);
  a.equal(weeklies.filter((d) => names.includes(d)).length, 26, "every weekly survived the burst");
  a.equal(names.filter((n) => n.endsWith("-manual")).length, 6, "and the manual ones were capped at six");
  a.ok(!names.some((n) => n.endsWith("_check")), "the verification record is not itself a backup");
});

/* ---------------- the Access JWT check ----------------
This is what stops one person reading another's training history, so it is tested with
real cryptography rather than a stand-in for it: Node has the same WebCrypto the Worker
runs on, so the suite generates an RSA keypair, serves it as a JWKS from a stubbed
fetch, and mints genuine RS256 tokens. Nothing about the verification is faked, which
means a forged or tampered token has to actually fail the real signature check. */

const TEAM = "test-team.cloudflareaccess.com";
const AUD = "a".repeat(64);
const te = new TextEncoder();
const b64u = (b) => Buffer.from(b).toString("base64url");

async function keypair(kid) {
  const kp = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { kid, priv: kp.privateKey, jwk: { ...jwk, kid, alg: "RS256" } };
}

let KEYS, served, fetches = 0;
async function setupKeys() {
  if (KEYS) return KEYS;
  KEYS = { a: await keypair("key-a"), b: await keypair("key-b"), c: await keypair("key-c") };
  served = [KEYS.a.jwk, KEYS.b.jwk];
  global.fetch = async (url) => {
    fetches++;
    a.equal(url, `https://${TEAM}/cdn-cgi/access/certs`, "keys come from the team domain");
    return { ok: true, json: async () => ({ keys: served }) };
  };
  return KEYS;
}

async function mint(key, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { aud: [AUD], iss: `https://${TEAM}`, exp: now + 3600, iat: now, email: "lifter@example.com", ...claims };
  const h = b64u(te.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.kid })));
  const p = b64u(te.encode(JSON.stringify(body)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.priv, te.encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}

function authEnv(extra = {}) {
  return Object.assign(fakeEnv({ docs: [{ path: "plan/main", data: '{"bar":45}' }] }), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }, extra);
}
async function call(env, token, path = "state") {
  const { handleApi } = await load();
  const headers = token ? { "cf-access-jwt-assertion": token } : {};
  return handleApi(new Request(`https://operatorblack.com/api/${path}`, { headers }), env);
}

test("a properly signed token gets in, as whoever the token says", async () => {
  const k = await setupKeys();
  const res = await call(authEnv(), await mint(k.a));
  a.equal(res.status, 200);
  const body = await res.json();
  a.equal(body.user, "lifter@example.com", "the identity comes from the signed token");
  a.deepEqual(body.plan, { bar: 45 });
});

test("a tampered token is refused, which is the whole point of the check", async () => {
  const k = await setupKeys();
  const good = await mint(k.a, { email: "lifter@example.com" });
  const [h, p, sig] = good.split(".");

  // Rewrite the claims to someone else and keep the signature. This is the attack.
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  claims.email = "victim@example.com";
  const forged = `${h}.${b64u(te.encode(JSON.stringify(claims)))}.${sig}`;

  const res = await call(authEnv(), forged);
  a.equal(res.status, 403, "no amount of valid-looking JSON gets you someone else's data");
  a.match((await res.json()).error, /Invalid sign-in token/);
});

test("a token signed by a key the team does not publish is refused", async () => {
  await setupKeys();
  const stranger = await keypair("key-a");   // same kid, different key entirely
  const res = await call(authEnv(), await mint(stranger));
  a.equal(res.status, 403, "the kid is a hint, not an authorisation");
});

test("a token from another Access application is refused", async () => {
  const k = await setupKeys();
  // Same Cloudflare team, different app: correctly signed, wrong audience.
  const res = await call(authEnv(), await mint(k.a, { aud: ["b".repeat(64)] }));
  a.equal(res.status, 403, "the aud claim is what scopes a token to this site");

  // aud can be a bare string rather than an array, and still has to match.
  a.equal((await call(authEnv(), await mint(k.a, { aud: AUD }))).status, 200);
  a.equal((await call(authEnv(), await mint(k.a, { aud: "nope" }))).status, 403);
});

test("the wrong issuer, an expired token, and a missing one are all refused", async () => {
  const k = await setupKeys();
  a.equal((await call(authEnv(), await mint(k.a, { iss: "https://attacker.cloudflareaccess.com" }))).status, 403, "issuer");

  const then = Math.floor(Date.now() / 1000) - 60;
  a.equal((await call(authEnv(), await mint(k.a, { exp: then }))).status, 403, "expired an hour ago");
  a.equal((await call(authEnv(), await mint(k.a, { exp: undefined }))).status, 403, "no expiry at all");

  const none = await call(authEnv(), null);
  a.equal(none.status, 401, "no token is a sign-in prompt, not a rejection");

  a.equal((await call(authEnv(), "not.a.jwt")).status, 403, "nor is garbage");
  a.equal((await call(authEnv(), "onlyonepart")).status, 403);
});

test("rotated signing keys are picked up without waiting for the cache to expire", async () => {
  const k = await setupKeys();
  await call(authEnv(), await mint(k.a));       // make sure something is cached
  // key-c has never been published. A token signed with it must force a refetch rather
  // than be rejected out of a stale cache, because that is what a rotation looks like.
  served = [KEYS.a.jwk];
  let before = fetches;
  const miss = await call(authEnv(), await mint(k.c));
  a.equal(miss.status, 403, "still unknown after the refetch, so still refused");
  a.ok(fetches > before, "but it did go and look");

  // Now Cloudflare publishes it. The cached set is stale and has to be replaced.
  served = [KEYS.a.jwk, KEYS.c.jwk];
  before = fetches;
  const res = await call(authEnv(), await mint(k.c, { email: "lifter@example.com" }));
  a.equal(res.status, 200, "a token signed with the new key works without waiting an hour");
  a.ok(fetches > before, "because an unknown kid busts the cache");

  served = [KEYS.a.jwk, KEYS.b.jwk, KEYS.c.jwk];   // restore for the tests after this one
});

test("ALLOWED_EMAILS is a second lock, applied after the signature", async () => {
  const k = await setupKeys();
  const env = authEnv({ ALLOWED_EMAILS: "someone@example.com, lifter@example.com" });
  a.equal((await call(env, await mint(k.a))).status, 200, "on the list");

  const off = authEnv({ ALLOWED_EMAILS: "someone@example.com" });
  const res = await call(off, await mint(k.a));
  a.equal(res.status, 403, "a valid Access login is still not automatically allowed");
  a.match((await res.json()).error, /not allowed/);
});

test("an address is matched however it was typed, and a token without one is refused", async () => {
  const k = await setupKeys();
  const env = authEnv({ ALLOWED_EMAILS: "Lifter@Example.COM" });
  const res = await call(env, await mint(k.a, { email: "LIFTER@example.com" }));
  a.equal(res.status, 200, "case never decides who you are");
  a.equal((await res.json()).user, "lifter@example.com", "and it is stored one way");

  a.equal((await call(authEnv(), await mint(k.a, { email: "" }))).status, 403, "no email, no identity");
});

test("with Access unconfigured the API refuses everything rather than letting it through", async () => {
  const k = await setupKeys();
  const token = await mint(k.a);
  for (const env of [authEnv({ ACCESS_AUD: "" }), authEnv({ ACCESS_TEAM_DOMAIN: "" })]) {
    const res = await call(env, token);
    a.equal(res.status, 503, "a missing setting closes the door, it does not open it");
  }
});

/* ---------------- a D1 stand-in ----------------
Restore deletes every document a person has and writes the file's in their place, in one
batch. Testing that against a map would prove nothing, so this interprets the handful of
statements src/api.js actually issues, over real rows. Narrow on purpose: it answers the
queries this code sends and throws on anything it does not recognise, so a new query
cannot pass by being quietly ignored. */
function fakeDB() {
  const docs = [], feeds = [], adminLog = [], cat = [];
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const exec = (sql, a) => {
    const q = norm(sql);
    if (/^SELECT path, data FROM docs WHERE user = \?1$/.test(q))
      return docs.filter((d) => d.user === a[0]).map((d) => ({ path: d.path, data: d.data }));
    if (/^SELECT COUNT\(\*\) AS n FROM docs WHERE user = \?1$/.test(q))
      return [{ n: docs.filter((d) => d.user === a[0]).length }];
    if (/^SELECT DISTINCT user FROM docs WHERE user != \?1$/.test(q))
      return [...new Set(docs.filter((d) => d.user !== a[0]).map((d) => d.user))].map((user) => ({ user }));
    if (/^UPDATE docs SET user = \?1 WHERE user = \?2$/.test(q)) {
      for (const d of docs) if (d.user === a[1]) d.user = a[0];
      return [];
    }
    if (/^INSERT INTO docs/.test(q)) {
      const hit = docs.find((d) => d.user === a[0] && d.path === a[1]);
      if (hit) { hit.data = a[2]; hit.updated_at = a[3] }
      else docs.push({ user: a[0], path: a[1], data: a[2], updated_at: a[3] });
      return [];
    }
    if (/^DELETE FROM docs WHERE user = \?1$/.test(q)) {
      const keep = docs.filter((d) => d.user !== a[0]);
      docs.length = 0; docs.push(...keep);
      return [];
    }
    if (/^SELECT token, updated_at FROM cal_feeds WHERE user = \?1$/.test(q))
      return feeds.filter((f) => f.user === a[0]).map((f) => ({ token: f.token, updated_at: f.updated_at }));
    if (/^SELECT ics FROM cal_feeds WHERE token = \?1$/.test(q))
      return feeds.filter((f) => f.token === a[0]).map((f) => ({ ics: f.ics }));
    if (/^INSERT INTO cal_feeds/.test(q)) {
      const hit = feeds.find((f) => f.user === a[1]);
      if (hit) { hit.token = a[0]; hit.ics = ""; hit.updated_at = a[2] }
      else feeds.push({ token: a[0], user: a[1], ics: "", updated_at: a[2] });
      return [];
    }
    if (/^UPDATE cal_feeds SET ics = \?1, updated_at = \?2 WHERE user = \?3$/.test(q)) {
      const hit = feeds.find((f) => f.user === a[2]);
      if (hit) { hit.ics = a[0]; hit.updated_at = a[1] }
      return [];
    }
    if (/^DELETE FROM cal_feeds WHERE user = \?1$/.test(q)) {
      const keep = feeds.filter((f) => f.user !== a[0]);
      feeds.length = 0; feeds.push(...keep);
      return [];
    }
    if (/^SELECT user, COUNT\(\*\) AS docs,.*FROM docs GROUP BY user/.test(q)) {
      const by = new Map();
      for (const d of docs) {
        const r = by.get(d.user) || { user: d.user, docs: 0, logs: 0, bytes: 0, last: 0 };
        r.docs++; if (d.path.startsWith("logs/")) r.logs++;
        r.bytes += d.data.length; r.last = Math.max(r.last, d.updated_at);
        by.set(d.user, r);
      }
      return [...by.values()].sort((x, y) => y.last - x.last);
    }
    if (/^INSERT INTO admin_log/.test(q)) {
      adminLog.push({ at: a[0], actor: a[1], action: a[2], subject: a[3], detail: a[4] });
      return [];
    }
    if (/^SELECT at, actor, action, subject, detail FROM admin_log/.test(q))
      return [...adminLog].sort((x, y) => y.at - x.at).slice(0, 100);
    if (/^SELECT id, slot, name, gear, hidden FROM acc_catalog$/.test(q))
      return cat.map((c) => ({ ...c }));
    if (/^INSERT INTO acc_catalog/.test(q)) {
      const row = { id: a[0], slot: a[1], name: a[2], gear: a[3], hidden: a[4], updated_at: a[5] };
      const i = cat.findIndex((c) => c.id === row.id);
      if (i >= 0) cat[i] = row; else cat.push(row);
      return [];
    }
    if (/^DELETE FROM acc_catalog WHERE id = \?1$/.test(q)) {
      const keep = cat.filter((c) => c.id !== a[0]);
      cat.length = 0; cat.push(...keep);
      return [];
    }
    throw new Error("fakeDB does not know this query: " + q);
  };
  const batches = [];
  return {
    docs, feeds, adminLog, cat, batches,
    prepare(sql) {
      // A statement can be run with or without parameters, like the real binding.
      const made = (args) => ({
        __sql: sql, __args: args,
        all: async () => ({ results: exec(sql, args) }),
        first: async () => exec(sql, args)[0] || null,
        run: async () => (exec(sql, args), {}),
      });
      return Object.assign(made([]), { bind: (...args) => made(args) });
    },
    async batch(stmts) { batches.push(stmts.map((s) => norm(s.__sql))); for (const s of stmts) exec(s.__sql, s.__args); return [] },
  };
}

function dbEnv(extra = {}) {
  const db = fakeDB();
  return Object.assign({ DB: db, BACKUPS: fakeKV(), R2BACKUPS: fakeR2(), ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }, extra);
}
const put = (env, path, body, token) => call2(env, "doc/" + path, { method: "PUT", body: JSON.stringify(body) }, token);
async function call2(env, route, init, token) {
  const { handleApi } = await load();
  const headers = Object.assign({}, init?.headers, token ? { "cf-access-jwt-assertion": token } : {});
  return handleApi(new Request("https://operatorblack.com/api/" + route, Object.assign({}, init, { headers })), env);
}
const nBackups = (store) => [...store.m.keys()].filter((k) => !k.endsWith("_check")).length;
// The fake's exec() closes over its own arrays, so reassigning env.DB.docs silently
// detaches the test from the database. Mutate in place.
const clearUser = (env, user) => { const keep = env.DB.docs.filter((d) => d.user !== user); env.DB.docs.length = 0; env.DB.docs.push(...keep) };
const seedDocs = (env, user, obj) => { for (const [p, v] of Object.entries(obj)) env.DB.docs.push({ user, path: p, data: JSON.stringify(v), updated_at: 1 }) };

/* ---------------- restore ---------------- */

test("restoring replaces everything you have with the file's", async () => {
  const k = await setupKeys(); const token = await mint(k.a);
  const env = dbEnv();
  seedDocs(env, "lifter@example.com", {
    "plan/main": { bar: 45, old: true },
    "logs/2026-01-01": { date: "2026-01-01" },
    "logs/2026-01-02": { date: "2026-01-02" },
  });

  const file = {
    backedUpAt: "2026-09-01T09:00:00Z",
    plan: { bar: 20, fresh: true },
    logs: { "2026-05-05": { date: "2026-05-05", done: true } },
    programs: { "block-1": { id: "block-1" } },
  };
  const res = await call2(env, "restore", { method: "POST", body: JSON.stringify(file) }, token);
  a.equal(res.status, 200);
  const out = await res.json();
  a.deepEqual(out.restored, { plan: true, logs: 1, programs: 1 });
  a.equal(out.from, "2026-09-01T09:00:00Z");

  const mine = env.DB.docs.filter((d) => d.user === "lifter@example.com");
  a.deepEqual(mine.map((d) => d.path).sort(), ["logs/2026-05-05", "plan/main", "programs/block-1"]);
  a.deepEqual(JSON.parse(mine.find((d) => d.path === "plan/main").data), { bar: 20, fresh: true }, "the old plan is gone, not merged");
  a.ok(!mine.some((d) => d.path === "logs/2026-01-01"), "and days not in the file are gone");

  // One batch, delete first: a half-finished restore would be worse than none.
  a.equal(env.DB.batches.length, 1, "it is a single batch");
  a.match(env.DB.batches[0][0], /^DELETE FROM docs WHERE user/, "clearing out comes first");
  a.equal(env.DB.batches[0].length, 4, "then one insert per document");
});

test("a restore takes a safety copy of what it is about to destroy", async () => {
  const k = await setupKeys(); const token = await mint(k.a);
  const env = dbEnv();
  seedDocs(env, "lifter@example.com", { "plan/main": { bar: 45 }, "logs/2026-01-01": { date: "2026-01-01" } });

  const res = await call2(env, "restore", { method: "POST", body: JSON.stringify({ logs: {}, plan: { bar: 20 } }) }, token);
  const out = await res.json();
  a.match(out.safetyBackup, /^\d{4}-\d{2}-\d{2}-before-restore-\d{6}$/, "time-stamped, so two restores in a day both keep one");

  const { readBackup } = await load();
  const saved = JSON.parse(await readBackup(env, "lifter@example.com", out.safetyBackup));
  a.deepEqual(saved.plan, { bar: 45 }, "it holds what was there before, not after");
  a.deepEqual(Object.keys(saved.logs), ["2026-01-01"]);
});

test("a file that is not a backup is refused before anything is touched", async () => {
  const k = await setupKeys(); const token = await mint(k.a);
  for (const [body, status, why] of [
    ["not json at all", 400, "not JSON"],
    [JSON.stringify(null), 400, "null"],
    [JSON.stringify({ plan: {} }), 400, "no logs in it"],
    [JSON.stringify({ logs: "nope" }), 400, "logs is not an object"],
  ]) {
    const env = dbEnv();
    seedDocs(env, "lifter@example.com", { "plan/main": { bar: 45 } });
    const res = await call2(env, "restore", { method: "POST", body }, await mint(k.a));
    a.equal(res.status, status, why);
    a.equal(env.DB.docs.length, 1, `${why}: existing data is untouched`);
    a.equal(env.DB.batches.length, 0, `${why}: nothing was written`);
  }
  a.ok(k);
});

test("rubbish inside a backup is skipped, not restored", async () => {
  const k = await setupKeys(); const token = await mint(k.a);
  const env = dbEnv();
  const file = {
    plan: [1, 2, 3],                                   // an array is not a plan
    logs: { "2026-05-05": { ok: true }, "not-a-date": { x: 1 }, "2026-05-06": null },
    programs: { "good-1": { id: "good-1" }, "BAD ID": { x: 1 } },
  };
  const res = await call2(env, "restore", { method: "POST", body: JSON.stringify(file) }, token);
  const out = await res.json();
  a.deepEqual(out.restored, { plan: false, logs: 1, programs: 1 }, "only the well-formed entries");
  const paths = env.DB.docs.filter((d) => d.user === "lifter@example.com").map((d) => d.path).sort();
  a.deepEqual(paths, ["logs/2026-05-05", "programs/good-1"]);
});

test("restoring is scoped to you, and cannot reach anyone else's rows", async () => {
  const k = await setupKeys();
  const env = dbEnv();
  seedDocs(env, "lifter@example.com", { "plan/main": { mine: true } });
  seedDocs(env, "someone.else@example.com", { "plan/main": { theirs: true }, "logs/2026-02-02": { date: "2026-02-02" } });

  await call2(env, "restore", { method: "POST", body: JSON.stringify({ logs: {}, plan: { replaced: true } }) }, await mint(k.a));

  const theirs = env.DB.docs.filter((d) => d.user === "someone.else@example.com");
  a.equal(theirs.length, 2, "their documents are all still there");
  a.deepEqual(JSON.parse(theirs.find((d) => d.path === "plan/main").data), { theirs: true }, "and unchanged");
});

/* ---------------- document routes ---------------- */

test("documents are stored under the signed-in person and nobody else", async () => {
  const k = await setupKeys();
  const env = dbEnv();
  seedDocs(env, "someone.else@example.com", { "plan/main": { theirs: true }, "logs/2026-02-02": { date: "2026-02-02" } });

  a.equal((await put(env, "plan/main", { bar: 45 }, await mint(k.a))).status, 204, "stored, nothing to say back");
  a.equal((await put(env, "logs/2026-03-03", { date: "2026-03-03" }, await mint(k.a))).status, 204);

  const state = await (await call2(env, "state", {}, await mint(k.a))).json();
  a.equal(state.user, "lifter@example.com");
  a.deepEqual(state.plan, { bar: 45 });
  a.deepEqual(Object.keys(state.logs), ["2026-03-03"], "their day is not in my state");
  a.ok(!JSON.stringify(state).includes("theirs"), "nothing of theirs leaks through");

  // A second write replaces rather than duplicating.
  await put(env, "plan/main", { bar: 20 }, await mint(k.a));
  a.equal(env.DB.docs.filter((d) => d.user === "lifter@example.com" && d.path === "plan/main").length, 1);
});

test("only the three document shapes are writable, and only by PUT", async () => {
  const k = await setupKeys(); const env = dbEnv();
  for (const bad of ["plan/other", "logs/nope", "programs/Has Spaces", "../plan/main", "backups/x",
                     "logs/2026-13-99", "logs/2026-02-31", "logs/2026-00-00"]) {
    const res = await put(env, bad, { x: 1 }, await mint(k.a));
    a.equal(res.status, 404, `${bad} is not a document path`);
  }
  for (const good of ["plan/main", "logs/2026-03-03", "logs/2024-02-29", "programs/block-1"]) {
    a.equal((await put(env, good, { x: 1 }, await mint(k.a))).status, 204, good);
  }
  a.equal(env.DB.docs.filter((d) => d.path.startsWith("logs/")).length, 2, "both real days, no impossible ones");
  const get = await call2(env, "doc/plan/main", { method: "GET" }, await mint(k.a));
  a.equal(get.status, 405, "documents are written, not read, through this route");
});

test("a document body has to be a JSON object of a sane size", async () => {
  const k = await setupKeys(); const env = dbEnv();
  const send = (body) => call2(env, "doc/plan/main", { method: "PUT", body }, undefined);
  const tok = async () => mint(k.a);

  a.equal((await call2(env, "doc/plan/main", { method: "PUT", body: "{oops" }, await tok())).status, 400, "not JSON");
  a.equal((await call2(env, "doc/plan/main", { method: "PUT", body: "[1,2]" }, await tok())).status, 400, "an array is not a document");
  a.equal((await call2(env, "doc/plan/main", { method: "PUT", body: "null" }, await tok())).status, 400, "null is not a document");
  a.equal((await call2(env, "doc/plan/main", { method: "PUT", body: JSON.stringify({ big: "x".repeat(300 * 1024) }) }, await tok())).status, 413, "too large");
  a.equal(env.DB.docs.length, 0, "and none of that was stored");
  a.ok(send);
});

/* ---------------- the calendar endpoints ---------------- */

test("the calendar feed is off until you turn it on, and then has an address", async () => {
  const k = await setupKeys(); const env = dbEnv();
  const tok = async () => mint(k.a);

  a.deepEqual(await (await call2(env, "calendar", {}, await tok())).json(), { enabled: false });

  const on = await (await call2(env, "calendar/on", { method: "POST" }, await tok())).json();
  a.equal(on.enabled, true);
  a.match(on.url, /^https:\/\/operatorblack\.com\/cal\/[0-9a-f]{32}\.ics$/, "an unguessable address");

  const again = await (await call2(env, "calendar/on", { method: "POST" }, await tok())).json();
  a.equal(again.url, on.url, "turning it on twice keeps the same address");
});

test("the feed serves what the app uploaded, to anyone with the address and nobody else", async () => {
  const { calendarFeed } = await load();
  const k = await setupKeys(); const env = dbEnv();
  const on = await (await call2(env, "calendar/on", { method: "POST" }, await mint(k.a))).json();
  const token = on.url.match(/cal\/([0-9a-f]{32})\.ics/)[1];

  a.equal((await calendarFeed(token, env)).status, 404, "nothing to serve before the app uploads");

  const ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
  a.equal((await call2(env, "calendar/ics", { method: "PUT", body: ics }, await mint(k.a))).status, 200);

  const feed = await calendarFeed(token, env);
  a.equal(feed.status, 200);
  a.match(feed.headers.get("content-type"), /^text\/calendar/, "served as a calendar, not a download");
  a.equal(await feed.text(), ics);

  a.equal((await calendarFeed("0".repeat(32), env)).status, 404, "an unknown token gets nothing");
  a.equal((await calendarFeed("../../etc/passwd", env)).status, 404, "and nothing that is not a token");
});

test("only a calendar can be uploaded, and only to a feed that exists", async () => {
  const k = await setupKeys(); const env = dbEnv();
  const ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
  a.equal((await call2(env, "calendar/ics", { method: "PUT", body: ics }, await mint(k.a))).status, 409, "no feed to upload to yet");

  await call2(env, "calendar/on", { method: "POST" }, await mint(k.a));
  a.equal((await call2(env, "calendar/ics", { method: "PUT", body: "<html>hello" }, await mint(k.a))).status, 400, "that is not a calendar");
  a.equal((await call2(env, "calendar/ics", { method: "PUT", body: "B".repeat(300 * 1024) }, await mint(k.a))).status, 413, "too large");
});

test("a new address kills the old one, and turning it off removes it", async () => {
  const { calendarFeed } = await load();
  const k = await setupKeys(); const env = dbEnv();
  const first = await (await call2(env, "calendar/on", { method: "POST" }, await mint(k.a))).json();
  const t1 = first.url.match(/cal\/([0-9a-f]{32})\.ics/)[1];
  await call2(env, "calendar/ics", { method: "PUT", body: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n" }, await mint(k.a));
  a.equal((await calendarFeed(t1, env)).status, 200);

  const second = await (await call2(env, "calendar/rotate", { method: "POST" }, await mint(k.a))).json();
  const t2 = second.url.match(/cal\/([0-9a-f]{32})\.ics/)[1];
  a.notEqual(t2, t1, "a different address");
  a.equal((await calendarFeed(t1, env)).status, 404, "the shared link stops working immediately");
  a.equal((await calendarFeed(t2, env)).status, 404, "and the new one is empty until the app uploads again");

  await call2(env, "calendar/ics", { method: "PUT", body: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n" }, await mint(k.a));
  a.equal((await calendarFeed(t2, env)).status, 200);
  await call2(env, "calendar/off", { method: "POST" }, await mint(k.a));
  a.equal((await calendarFeed(t2, env)).status, 404, "off means gone");
  a.equal(env.DB.feeds.length, 0);
});

test("a day that cannot happen is not restored either", async () => {
  const k = await setupKeys(); const env = dbEnv();
  const file = { logs: { "2026-02-31": { x: 1 }, "2026-13-01": { x: 1 }, "2024-02-29": { ok: true }, "2026-03-03": { ok: true } } };
  const out = await (await call2(env, "restore", { method: "POST", body: JSON.stringify(file) }, await mint(k.a))).json();
  a.equal(out.restored.logs, 2, "the leap day and the ordinary day, not the impossible ones");
  a.deepEqual(env.DB.docs.filter((d) => d.user === "lifter@example.com").map((d) => d.path).sort(),
    ["logs/2024-02-29", "logs/2026-03-03"]);
});

test("a backup is read straight back and checked, and a bad write is caught", async () => {
  const { backupNow, readCheck } = await load();
  const env = fakeEnv({ docs: [{ path: "plan/main", data: "{}" }, { path: "logs/2026-10-05", data: "{}" }] });

  const good = await backupNow(env, USER, { manual: true });
  a.equal(good.verified, true, "a healthy round trip verifies");
  const check = await readCheck(env, USER);
  a.equal(check.ok, true);
  a.equal(check.name, good.name, "and the record says which backup it checked");
  a.equal(check.logs, 1);

  // A store that accepts a write and gives back something else is the failure this
  // exists to catch: it looks fine until the day you need the file.
  const env2 = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: "{}" }] });
  const realPut = env2.R2BACKUPS.put.bind(env2.R2BACKUPS);
  // Truncate the backup itself but not the record of the check, or the test would be
  // measuring the wrong write.
  env2.R2BACKUPS.put = async (key, body, opts) => realPut(key, key.endsWith("_check") ? body : body.slice(0, 20), opts);
  const bad = await backupNow(env2, USER, { manual: true });
  a.equal(bad.verified, false, "a truncated write does not pass");
  a.equal((await readCheck(env2, USER)).ok, false, "and the record says so");

  // A store that loses it entirely.
  const env3 = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: "{}" }] });
  env3.R2BACKUPS.put = async () => {};
  a.equal((await backupNow(env3, USER, { manual: true })).verified, false, "nor does a write that vanished");

  // The subtle one: a store that hands back valid JSON of the right shape, but not the
  // bytes we gave it. Counts alone would say this is fine.
  const env4 = fakeEnv({ docs: [{ path: "logs/2026-10-05", data: "{}" }] });
  const realPut4 = env4.R2BACKUPS.put.bind(env4.R2BACKUPS);
  env4.R2BACKUPS.put = async (key, body, opts) =>
    realPut4(key, key.endsWith("_check") ? body : JSON.stringify({ ...JSON.parse(body), meddled: true }), opts);
  a.equal((await backupNow(env4, USER, { manual: true })).verified, false, "nor one that came back altered");
});

test("the verification record is reported alongside the backups, not as one", async () => {
  const k = await setupKeys();
  const { backupNow } = await load();
  const env = dbEnv();
  seedDocs(env, "lifter@example.com", { "logs/2026-10-05": { date: "2026-10-05" } });
  await backupNow(env, "lifter@example.com", { manual: true });

  const out = await (await call2(env, "backups", {}, await mint(k.a))).json();
  a.equal(out.backups.length, 1, "one backup");
  a.ok(!out.backups.some((b) => b.name.includes("_check")), "the record is not listed as one");
  a.equal(out.check.ok, true, "it comes back on its own");
  a.equal(out.check.name, out.backups[0].name);
});

/* ---------------- administration ---------------- */

const adminEnv = () => dbEnv({ ADMIN_EMAILS: "lifter@example.com" });
const asOther = async (k) => mint(k.a, { email: "someone.else@example.com" });

test("the admin routes do not exist unless you are one", async () => {
  const k = await setupKeys();
  // Not an admin: every route is a 404, not a 403. A 403 would confirm it is there.
  const plain = dbEnv();
  for (const [r, m] of [["admin/users", "GET"], ["admin/log", "GET"], ["admin/users/x@y.com", "DELETE"]]) {
    const res = await call2(plain, r, { method: m, body: m === "DELETE" ? "{}" : undefined }, await mint(k.a));
    a.equal(res.status, 404, `${m} ${r} is invisible`);
  }
  // Being on the list is what grants it, and only for that address.
  const env = adminEnv();
  a.equal((await call2(env, "admin/users", {}, await mint(k.a))).status, 200, "the admin gets in");
  a.equal((await call2(env, "admin/users", {}, await asOther(k))).status, 404, "nobody else does");
  // And the signed-in identity decides it, not anything the page sends.
  a.equal((await call2(env, "admin/users", { headers: { "x-admin": "1" } }, await asOther(k))).status, 404);
});

test("the people list is counts and dates, never anyone's training", async () => {
  const k = await setupKeys(); const env = adminEnv();
  seedDocs(env, "lifter@example.com", { "plan/main": { bar: 45 }, "logs/2026-10-01": { date: "2026-10-01" } });
  seedDocs(env, "someone.else@example.com", {
    "plan/main": { bar: 20, secretNote: "my back hurts" },
    "logs/2026-10-02": { date: "2026-10-02", bodyweight: 196 },
    "logs/2026-10-03": { date: "2026-10-03" },
  });

  const res = await call2(env, "admin/users", {}, await mint(k.a));
  const body = await res.json();
  const them = body.users.find((u) => u.user === "someone.else@example.com");
  a.equal(them.docs, 3);
  a.equal(them.logs, 2, "logged days are counted");
  a.ok(them.bytes > 0, "and sized");
  a.ok(them.last, "with a last-activity date");

  const raw = JSON.stringify(body);
  a.ok(!raw.includes("my back hurts"), "no plan contents");
  a.ok(!raw.includes("196"), "no bodyweight");
  a.equal(body.users.find((u) => u.user === "lifter@example.com").admin, true, "admins are marked");
  a.equal(body.me, "lifter@example.com");
});

test("clearing someone takes everything they have, and nothing of anyone else's", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const { backupNow, listBackups, readCheck } = await load();
  const victim = "someone.else@example.com";

  seedDocs(env, victim, { "plan/main": { bar: 20 }, "logs/2026-10-02": { date: "2026-10-02" } });
  seedDocs(env, "lifter@example.com", { "plan/main": { bar: 45 }, "logs/2026-10-01": { date: "2026-10-01" } });
  await backupNow(env, victim, { manual: true });
  await call2(env, "calendar/on", { method: "POST" }, await asOther(k));
  a.equal(env.DB.feeds.length, 1, "they have a calendar feed");
  a.ok((await listBackups(env, victim)).length === 1, "and a backup");

  const res = await call2(env, "admin/users/" + encodeURIComponent(victim),
    { method: "DELETE", body: JSON.stringify({ confirm: victim }) }, await mint(k.a));
  a.equal(res.status, 200);
  const out = (await res.json()).removed;
  a.equal(out.docs, 2);
  a.equal(out.backups, 1);
  a.equal(out.calendar, true);

  a.equal(env.DB.docs.filter((d) => d.user === victim).length, 0, "no documents left");
  a.equal((await listBackups(env, victim)).length, 0, "no backups left");
  a.equal(await readCheck(env, victim), null, "and the backup check record went too");
  a.equal(env.DB.feeds.length, 0, "the calendar feed is gone");

  // Everyone else is untouched.
  a.equal(env.DB.docs.filter((d) => d.user === "lifter@example.com").length, 2, "my data is still here");
});

test("a removal needs the address typed back, and cannot be aimed at yourself", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const victim = "someone.else@example.com";
  seedDocs(env, victim, { "plan/main": { bar: 20 } });
  seedDocs(env, "lifter@example.com", { "plan/main": { bar: 45 } });
  const del = (who, body) => call2(env, "admin/users/" + encodeURIComponent(who), { method: "DELETE", body: JSON.stringify(body) }, mintSync);
  let mintSync = await mint(k.a);

  for (const body of [{}, { confirm: "" }, { confirm: "someone.else@example.co" }, { confirm: "lifter@example.com" }]) {
    const res = await call2(env, "admin/users/" + encodeURIComponent(victim),
      { method: "DELETE", body: JSON.stringify(body) }, await mint(k.a));
    a.equal(res.status, 400, `confirm=${JSON.stringify(body.confirm)} is refused`);
  }
  a.equal(env.DB.docs.filter((d) => d.user === victim).length, 1, "and they still have their data");

  // Your own account is not removable from here: that is a mistake with no undo.
  const self = await call2(env, "admin/users/" + encodeURIComponent("lifter@example.com"),
    { method: "DELETE", body: JSON.stringify({ confirm: "lifter@example.com" }) }, await mint(k.a));
  a.equal(self.status, 400);
  a.equal(env.DB.docs.filter((d) => d.user === "lifter@example.com").length, 1);

  // A nonsense address is rejected before anything is touched.
  a.equal((await call2(env, "admin/users/" + encodeURIComponent("not-an-address"),
    { method: "DELETE", body: JSON.stringify({ confirm: "not-an-address" }) }, await mint(k.a))).status, 400);
  a.ok(del);
});

test("exports and removals are written down, and the record is not editable from the app", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const victim = "someone.else@example.com";
  seedDocs(env, victim, { "plan/main": { bar: 20 }, "logs/2026-10-02": { date: "2026-10-02" } });

  const ex = await call2(env, "admin/users/" + encodeURIComponent(victim) + "/export", {}, await mint(k.a));
  a.equal(ex.status, 200);
  a.match(ex.headers.get("content-disposition"), /attachment; filename=/, "it downloads");
  const file = await ex.json();
  a.equal(file.user, victim);
  a.deepEqual(Object.keys(file.logs), ["2026-10-02"], "the whole file, which is what handing it back means");

  await call2(env, "admin/users/" + encodeURIComponent(victim),
    { method: "DELETE", body: JSON.stringify({ confirm: victim }) }, await mint(k.a));

  const log = (await (await call2(env, "admin/log", {}, await mint(k.a))).json()).log;
  a.equal(log.length, 2, "both actions recorded");
  a.deepEqual(log.map((e) => e.action).sort(), ["delete", "export"]);
  a.ok(log.every((e) => e.actor === "lifter@example.com"), "with who did it");
  a.ok(log.every((e) => e.subject === victim), "and to whom");

  // There is no route that writes or clears the record.
  for (const m of ["POST", "PUT", "DELETE"]) {
    a.equal((await call2(env, "admin/log", { method: m, body: "{}" }, await mint(k.a))).status, 404, `${m} /admin/log`);
  }
});

test("state tells the page whether it is an admin, and tells nobody else", async () => {
  const k = await setupKeys(); const env = adminEnv();
  a.equal((await (await call2(env, "state", {}, await mint(k.a))).json()).admin, true);
  a.equal((await (await call2(env, "state", {}, await asOther(k))).json()).admin, undefined, "absent, not false");
  a.equal((await (await call2(dbEnv(), "state", {}, await mint(k.a))).json()).admin, undefined, "nobody is an admin by default");
});

test("an administrator is an ordinary user too, with the sharp edges guarded", async () => {
  const k = await setupKeys();
  // The secret is typed by hand into a prompt, so spacing and case must not decide it.
  for (const secret of ["lifter@example.com", " lifter@example.com ", "LIFTER@Example.COM",
                        "someone@else.com, lifter@example.com", "lifter@example.com,"]) {
    const env = dbEnv({ ADMIN_EMAILS: secret });
    a.equal((await (await call2(env, "state", {}, await mint(k.a))).json()).admin, true, `secret ${JSON.stringify(secret)}`);
  }
  // A near-miss is not a match.
  for (const secret of ["lifter@example.co", "lifter@example.com.au", "ifter@example.com", ""]) {
    const env = dbEnv({ ADMIN_EMAILS: secret });
    a.equal((await (await call2(env, "state", {}, await mint(k.a))).json()).admin, undefined, `secret ${JSON.stringify(secret)}`);
  }

  // Being an admin changes nothing about using the app normally.
  const env = adminEnv();
  seedDocs(env, "lifter@example.com", { "plan/main": { bar: 45 }, "logs/2026-10-01": { date: "2026-10-01" } });
  const st = await (await call2(env, "state", {}, await mint(k.a))).json();
  a.deepEqual(st.plan, { bar: 45 }, "my own training still comes back");
  a.deepEqual(Object.keys(st.logs), ["2026-10-01"]);

  // I appear in my own list, flagged, and cannot be removed from there however hard I try.
  const list = (await (await call2(env, "admin/users", {}, await mint(k.a))).json()).users;
  const me = list.find((u) => u.user === "lifter@example.com");
  a.equal(me.admin, true);
  a.equal(me.logs, 1, "with my real counts, like anyone else");
  for (const confirm of ["lifter@example.com", "LIFTER@EXAMPLE.COM"]) {
    const res = await call2(env, "admin/users/" + encodeURIComponent("lifter@example.com"),
      { method: "DELETE", body: JSON.stringify({ confirm }) }, await mint(k.a));
    a.equal(res.status, 400, "the self-delete guard holds");
  }
  a.equal(env.DB.docs.filter((d) => d.user === "lifter@example.com").length, 2, "and my data is intact");

  // Deleting my ordinary data is still possible the ordinary way, through restore.
  a.equal((await call2(env, "restore", { method: "POST", body: JSON.stringify({ logs: {} }) }, await mint(k.a))).status, 200,
    "being an admin does not lock me out of my own account's normal routes");
});

test("an admin can put a person's backup back, with their current data saved first", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const { backupNow, listBackups, readBackup } = await load();
  const who = "someone.else@example.com";

  // They have a week of training, and a backup of it.
  seedDocs(env, who, { "plan/main": { bar: 45, maxes: { squat: 255 } }, "logs/2026-10-01": { date: "2026-10-01" }, "logs/2026-10-02": { date: "2026-10-02" } });
  const good = await backupNow(env, who, { manual: true });
  a.equal(good.verified, true);

  // Then they wreck it.
  clearUser(env, who);
  seedDocs(env, who, { "plan/main": { bar: 45, maxes: {} } });
  a.equal(env.DB.docs.filter((d) => d.user === who).length, 1, "a day later, almost nothing left");

  const list = await (await call2(env, "admin/users/" + encodeURIComponent(who) + "/backups", {}, await mint(k.a))).json();
  a.equal(list.backups.length, 1, "their backups are listed");
  a.equal(list.backups[0].name, good.name);

  const res = await call2(env, "admin/users/" + encodeURIComponent(who) + "/restore",
    { method: "POST", body: JSON.stringify({ name: good.name, confirm: who }) }, await mint(k.a));
  a.equal(res.status, 200);
  const out = await res.json();
  a.equal(out.restored.logs, 2, "both days are back");
  a.match(out.safetyBackup, /before-restore/, "and what they had a moment ago was kept");

  const back = env.DB.docs.filter((d) => d.user === who);
  a.deepEqual(back.map((d) => d.path).sort(), ["logs/2026-10-01", "logs/2026-10-02", "plan/main"]);
  a.deepEqual(JSON.parse(back.find((d) => d.path === "plan/main").data).maxes, { squat: 255 }, "with their maxes");

  // The safety copy really holds the broken state, so this is undoable.
  const safety = JSON.parse(await readBackup(env, who, out.safetyBackup));
  a.deepEqual(safety.plan.maxes, {}, "the before-restore copy is what they had, not what they got");
  a.ok((await listBackups(env, who)).length >= 2);
});

test("restoring for someone needs the same bar as removing them", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const { backupNow } = await load();
  const who = "someone.else@example.com";
  seedDocs(env, who, { "plan/main": { bar: 45 }, "logs/2026-10-01": { date: "2026-10-01" } });
  const good = await backupNow(env, who, { manual: true });
  const before = JSON.stringify(env.DB.docs.filter((d) => d.user === who));

  const post = (body, token) => call2(env, "admin/users/" + encodeURIComponent(who) + "/restore",
    { method: "POST", body: JSON.stringify(body) }, token);

  a.equal((await post({ name: good.name }, await mint(k.a))).status, 400, "no confirmation");
  a.equal((await post({ name: good.name, confirm: "wrong@example.com" }, await mint(k.a))).status, 400, "the wrong address");
  a.equal((await post({ confirm: who }, await mint(k.a))).status, 404, "no backup named");
  a.equal((await post({ name: "2099-01-01", confirm: who }, await mint(k.a))).status, 404, "a backup that is not there");
  a.equal((await post({ name: "../../etc/passwd", confirm: who }, await mint(k.a))).status, 404, "nor a path");
  // The verification record sits beside the backups under a name no backup can have.
  // It must not be reachable as one: it parses as JSON and would otherwise get as far
  // as the restore itself before being turned away.
  a.equal((await post({ name: "_check", confirm: who }, await mint(k.a))).status, 404, "the check record is not a backup");

  // And not at all unless you are an admin.
  a.equal((await call2(dbEnv(), "admin/users/x@y.com/restore", { method: "POST", body: "{}" }, await mint(k.a))).status, 404);

  a.equal(JSON.stringify(env.DB.docs.filter((d) => d.user === who)), before, "none of that touched their data");
});

test("a restore done for someone is written to the audit log", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const { backupNow } = await load();
  const who = "someone.else@example.com";
  seedDocs(env, who, { "plan/main": { bar: 45 }, "logs/2026-10-01": { date: "2026-10-01" } });
  const good = await backupNow(env, who, { manual: true });

  await call2(env, "admin/users/" + encodeURIComponent(who) + "/restore",
    { method: "POST", body: JSON.stringify({ name: good.name, confirm: who }) }, await mint(k.a));

  const log = (await (await call2(env, "admin/log", {}, await mint(k.a))).json()).log;
  const entry = log.find((e) => e.action === "restore");
  a.ok(entry, "it is recorded");
  a.equal(entry.subject, who);
  a.equal(entry.actor, "lifter@example.com");
  const d = JSON.parse(entry.detail);
  a.equal(d.from, good.name, "which backup it came from");
  a.match(d.safety, /before-restore/, "and where their previous data went");
});

test("the shared catalogue is readable by everyone and writable only by an admin", async () => {
  const k = await setupKeys(); const env = adminEnv();

  // It reaches every user with their state, admin or not.
  a.deepEqual((await (await call2(env, "state", {}, await asOther(k))).json()).catalog, []);

  const add = (body, token) => call2(env, "admin/catalog", { method: "POST", body: JSON.stringify(body) }, token);
  a.equal((await add({ slot: "biceps", name: "Spider curl", gear: "EZ bar" }, await asOther(k))).status, 404, "not for an ordinary user");

  const res = await add({ slot: "biceps", name: "Spider curl", gear: "EZ bar" }, await mint(k.a));
  a.equal(res.status, 200);
  const cat = (await res.json()).catalog;
  a.equal(cat.length, 1);
  a.equal(cat[0].id, "cat-spider-curl", "the id is made from the name and cannot collide with a built-in");
  a.equal(cat[0].name, "Spider curl");
  a.equal(cat[0].hidden, false);

  // And now everyone sees it, including people who are not admins.
  const theirs = (await (await call2(env, "state", {}, await asOther(k))).json()).catalog;
  a.equal(theirs.length, 1);
  a.equal(theirs[0].name, "Spider curl");
});

test("retiring a built-in is a row, and removing an addition takes it away", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const post = (b) => call2(env, "admin/catalog", { method: "POST", body: JSON.stringify(b) }, mintOne);
  let mintOne = await mint(k.a);

  await call2(env, "admin/catalog", { method: "POST", body: JSON.stringify({ id: "bbcurl", slot: "biceps", hidden: true }) }, await mint(k.a));
  let cat = (await (await call2(env, "state", {}, await mint(k.a))).json()).catalog;
  a.equal(cat.length, 1);
  a.equal(cat[0].id, "bbcurl");
  a.equal(cat[0].hidden, true, "a built-in is retired by a row that only says so");
  a.equal(cat[0].name, "", "with no name of its own — the built-in keeps that");

  // Bringing it back is the same row with hidden off.
  await call2(env, "admin/catalog", { method: "POST", body: JSON.stringify({ id: "bbcurl", slot: "biceps", name: "Barbell curl", hidden: false }) }, await mint(k.a));
  cat = (await (await call2(env, "state", {}, await mint(k.a))).json()).catalog;
  a.equal(cat[0].hidden, false);

  await call2(env, "admin/catalog/bbcurl", { method: "DELETE" }, await mint(k.a));
  a.deepEqual((await (await call2(env, "state", {}, await mint(k.a))).json()).catalog, []);
  a.ok(post);
});

test("the catalogue refuses nonsense, and every change is audited", async () => {
  const k = await setupKeys(); const env = adminEnv();
  const post = async (b) => (await call2(env, "admin/catalog", { method: "POST", body: JSON.stringify(b) }, await mint(k.a))).status;

  a.equal(await post({ slot: "biceps" }), 400, "no name");
  a.equal(await post({ name: "Thing" }), 400, "no slot");
  a.equal(await post({ slot: "NOT A SLOT", name: "Thing" }), 400);
  a.equal(await post({ slot: "biceps", name: "Thing", id: "../../etc" }), 400, "nor a path for an id");
  a.deepEqual((await (await call2(env, "state", {}, await mint(k.a))).json()).catalog, [], "and none of it was stored");

  a.equal(await post({ slot: "biceps", name: "Spider curl" }), 200);
  await call2(env, "admin/catalog/cat-spider-curl", { method: "DELETE" }, await mint(k.a));

  const log = (await (await call2(env, "admin/log", {}, await mint(k.a))).json()).log;
  a.deepEqual(log.map((e) => e.action).sort(), ["catalog-add", "catalog-remove"], "both recorded");
  a.ok(log.every((e) => e.actor === "lifter@example.com"));
});
