// Operator + Black API — Worker route handler backed by D1.
//
// Every document belongs to the signed-in Cloudflare Access user (their email, taken
// from the verified Access JWT, never from anything the page sends).
//
//   GET  /api/state               → { user, plan, logs: {date: {...}}, programs: {id: {...}} }
//   PUT  /api/doc/plan/main       → replace the current program's plan
//   PUT  /api/doc/logs/<date>     → replace one day's log
//   PUT  /api/doc/programs/<id>   → store an archived program
//   GET  /api/export              → everything of yours, as a downloadable JSON file
//   GET  /api/backups             → list your automatic backups (newest first)
//   GET  /api/backups/<name>      → download one backup
//   POST /api/backups             → take a backup now
//   POST /api/backups/<name>/restore → restore one of your backups (safety backup first)
//   POST /api/restore             → restore from an uploaded backup/export file
//   GET  /api/calendar            → { enabled, url, updatedAt } for your .ics feed
//   POST /api/calendar/on|off|rotate → turn the feed on, off, or change its address
//   PUT  /api/calendar/ics        → store the feed body (the app generates it)
//   GET  /api/version             → fingerprint of the current page + deploy info
//   GET  /api/push/key            → VAPID public key for pushManager.subscribe
//   GET  /api/push/status         → your devices with alerts on, pending alarm time
//   POST /api/push/subscribe | unsubscribe | schedule | cancel | test
//
// Every request must carry a valid Cloudflare Access JWT (Cf-Access-Jwt-Assertion).
// Set ACCESS_TEAM_DOMAIN and ACCESS_AUD in wrangler.toml. For local dev only,
// DEV_ALLOW_ANON=1 in .dev.vars skips the check (user = x-dev-user header, DEV_USER,
// or dev@local).

import { vapidPublicKey } from "./webpush.js";

const DOC_PATH = /^(plan\/main|logs\/\d{4}-\d{2}-\d{2}|programs\/[a-z0-9-]{1,40})$/;
// The shape of a date is not the same as a date. 2026-02-31 and 2026-13-99 both match the
// pattern above, and a day that cannot happen has no business being stored against one.
function realDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const MAX_BYTES = 256 * 1024;
const LEGACY = "__legacy__";

export async function handleApi(request, env) {
  const auth = await authorize(request, env);
  if (auth instanceof Response) return auth;
  const user = auth.user;
  await claimLegacy(env, user);

  const route = new URL(request.url).pathname.replace(/^\/api\/?/, "");

  if (route === "state" && request.method === "GET") {
    return json({ user, ...(await readAll(env, user)) }, 200, { "cache-control": "no-store" });
  }

  if (route === "export" && request.method === "GET") {
    const day = new Date().toISOString().slice(0, 10);
    return json({ exportedAt: new Date().toISOString(), user, ...(await readAll(env, user)) }, 200, {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="operator-black-${day}.json"`,
    });
  }

  if (route === "version" && request.method === "GET") {
    const page = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
    const etag = (page.headers.get("etag") || "").replace(/^W\//, "").replace(/"/g, "").slice(0, 16) || "dev";
    const meta = env.CF_VERSION_METADATA || {};
    return json({ page: etag, deployedAt: meta.timestamp || null, tag: meta.tag || null }, 200, { "cache-control": "no-store" });
  }
  if (route === "calendar" || route.startsWith("calendar/")) {
    const op = route === "calendar" ? "" : route.slice(9);
    const row = await env.DB.prepare("SELECT token, updated_at FROM cal_feeds WHERE user = ?1").bind(user).first();

    if (op === "" && request.method === "GET") return json(feedInfo(request, row), 200, { "cache-control": "no-store" });

    if ((op === "on" || op === "rotate") && request.method === "POST") {
      if (op === "on" && row) return json(feedInfo(request, row));
      const token = crypto.randomUUID().replace(/-/g, "");
      // One feed per person. Rotating replaces the address and drops the old body, so a
      // link already handed out stops resolving rather than going stale.
      await env.DB.prepare(
        `INSERT INTO cal_feeds (token, user, ics, updated_at) VALUES (?1, ?2, '', ?3)
         ON CONFLICT(user) DO UPDATE SET token = excluded.token, ics = '', updated_at = excluded.updated_at`
      ).bind(token, user, Date.now()).run();
      return json(feedInfo(request, { token, updated_at: null }));
    }

    if (op === "off" && request.method === "POST") {
      await env.DB.prepare("DELETE FROM cal_feeds WHERE user = ?1").bind(user).run();
      return json({ enabled: false });
    }

    if (op === "ics" && request.method === "PUT") {
      if (!row) return json({ error: "The calendar feed is off." }, 409);
      const text = await request.text();
      if (text.length > MAX_BYTES) return json({ error: "Calendar too large." }, 413);
      if (!text.startsWith("BEGIN:VCALENDAR")) return json({ error: "That is not a calendar." }, 400);
      await env.DB.prepare("UPDATE cal_feeds SET ics = ?1, updated_at = ?2 WHERE user = ?3")
        .bind(text, Date.now(), user).run();
      return json({ ok: true });
    }

    return json({ error: "Not found." }, 404);
  }

  if (route === "push/key" && request.method === "GET") {
    return json({ key: vapidPublicKey(env) });
  }
  if (route.startsWith("push/")) {
    const op = route.slice(5);
    const allowed = { status: "GET", subscribe: "POST", unsubscribe: "POST", schedule: "POST", cancel: "POST", test: "POST" };
    if (allowed[op] !== request.method) return json({ error: "Not found." }, 404);
    // one alerts object per person: their devices, their queue
    const stub = env.ALERTS.get(env.ALERTS.idFromName("user:" + user));
    return stub.fetch(new Request(`https://alerts/${op}`, { method: request.method, body: request.method === "POST" ? await request.text() : undefined }));
  }

  if (route === "backups" && request.method === "GET") {
    return json({ backups: await listBackups(env, user), check: await readCheck(env, user) }, 200, { "cache-control": "no-store" });
  }
  if (route === "backups" && request.method === "POST") {
    return json(await backupNow(env, user), 200);
  }
  if (route.startsWith("backups/") && route.endsWith("/restore") && request.method === "POST") {
    const name = route.slice(8, -8);
    if (!BACKUP_NAME.test(name)) return json({ error: "Unknown backup." }, 404);
    const body = await readBackup(env, user, name);
    if (!body) return json({ error: "Backup not found." }, 404);
    return restoreFrom(env, user, JSON.parse(body));
  }
  if (route === "restore" && request.method === "POST") {
    const text = await request.text();
    if (text.length > 20 * 1024 * 1024) return json({ error: "That file is too large." }, 413);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return json({ error: "That file isn't a backup (not JSON)." }, 400);
    }
    return restoreFrom(env, user, data);
  }
  if (route.startsWith("backups/") && request.method === "GET") {
    const name = route.slice(8);
    if (!BACKUP_NAME.test(name)) return json({ error: "Unknown backup." }, 404);
    const body = await readBackup(env, user, name);
    if (!body) return json({ error: "Backup not found." }, 404);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="operator-black-backup-${name}.json"`,
        "cache-control": "no-store",
      },
    });
  }

  if (route.startsWith("doc/")) {
    const path = route.slice(4);
    if (!DOC_PATH.test(path)) return json({ error: "Unknown document." }, 404);
    if (path.startsWith("logs/") && !realDate(path.slice(5))) return json({ error: "That is not a real date." }, 404);
    if (request.method !== "PUT") return json({ error: "Method not allowed." }, 405);

    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: "Document too large." }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Body must be JSON." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Body must be a JSON object." }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO docs (user, path, data, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user, path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
      .bind(user, path, JSON.stringify(body), Date.now())
      .run();
    return new Response(null, { status: 204 });
  }

  return json({ error: "Not found." }, 404);
}

/* ---------------- legacy single-user data ---------------- */

// Rows from before per-user data sit under '__legacy__'. The first sign-in by an
// address listed in the LEGACY_OWNERS secret takes them over. Nobody else can.
let legacyChecked = false;
async function claimLegacy(env, user) {
  if (legacyChecked) return;
  const owners = (env.LEGACY_OWNERS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE user = ?1").bind(LEGACY).first();
  if (!row || !row.n) return void (legacyChecked = true);
  if (!owners.includes(user)) return;
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE user = ?1").bind(user).first();
  if (mine && mine.n) return; // already has data of their own; leave the legacy rows alone
  await env.DB.prepare("UPDATE docs SET user = ?1 WHERE user = ?2").bind(user, LEGACY).run();
  legacyChecked = true;
}

/* ---------------- backups (Workers KV) ---------------- */

// Retention, per kind rather than one shared pool. The weekly run is the history worth
// having, and before this it could be eaten by a busy afternoon: ten taps of Back up now
// used to delete ten weeks of it, silently. Each kind now has its own budget.
const KEEP = { auto: 26, manual: 6, safety: 6 };   // ~6 months of weeklies
const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}(-manual|-before-restore(-\d{6})?)?$/;

export function backupKind(name) {
  if (String(name).includes("-before-restore")) return "safety";
  if (String(name).endsWith("-manual")) return "manual";
  return "auto";
}

/**
 * Which backups to delete, given the full list newest first. Counting per kind means the
 * newest of each is always kept however old it is, so going quiet for a few months never
 * leaves you with nothing -- which is the trap an age-based rule falls into.
 */
export function backupsToPrune(all) {
  const seen = { auto: 0, manual: 0, safety: 0 };
  const out = [];
  for (const b of all) {
    const k = backupKind(b.name);
    if (++seen[k] > KEEP[k]) out.push(b.name);
  }
  return out;
}

// Backup keys carry a short hash of the email rather than the email itself.
export async function backupPrefix(user) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user)));
  return "backup:" + Array.from(h.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("") + ":";
}

// Backups live in R2. They were in KV, which caps a value at 25 MB and is priced for
// small hot reads rather than whole-history JSON; R2 also makes them browsable in the
// dashboard. KV stays wired up as a read path so everything taken before the move is
// still listable, downloadable and restorable -- nothing was copied across, and nothing
// needs to be. If the R2 binding is missing, writes fall back to KV rather than failing.
function r2(env) {
  return env.R2BACKUPS && typeof env.R2BACKUPS.put === "function" ? env.R2BACKUPS : null;
}

export async function readBackup(env, user, name) {
  const key = (await backupPrefix(user)) + name;
  const bucket = r2(env);
  if (bucket) {
    const obj = await bucket.get(key);
    if (obj) return obj.text();
  }
  return env.BACKUPS ? env.BACKUPS.get(key) : null;
}

export async function deleteBackup(env, user, name) {
  const key = (await backupPrefix(user)) + name;
  const bucket = r2(env);
  if (bucket) await bucket.delete(key);
  if (env.BACKUPS) await env.BACKUPS.delete(key);
}

export async function backupNow(env, user, { manual = true, suffix } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const name = suffix ? `${day}-${suffix}` : manual ? `${day}-manual` : day;
  const data = { backedUpAt: new Date().toISOString(), user, ...(await readAll(env, user)) };
  const body = JSON.stringify(data);
  const prefix = await backupPrefix(user);
  const logs = Object.keys(data.logs).length;
  const bucket = r2(env);
  if (bucket) {
    await bucket.put(prefix + name, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      // R2 custom metadata is strings only; size and upload time come from the object.
      customMetadata: { logs: String(logs), at: data.backedUpAt },
    });
  } else {
    await env.BACKUPS.put(prefix + name, body, {
      metadata: { bytes: body.length, logs, at: data.backedUpAt },
    });
  }
  // Read it straight back and check it is what we meant to store. "There are backups"
  // and "the backups are good" are different claims, and only this one is testable
  // without restoring over live data. It costs one extra read of something already in
  // memory, and it catches a truncated write, a store that silently dropped it, or
  // anything that cannot be parsed again -- the failures that otherwise stay invisible
  // until the day you need the file.
  const verified = await verifyBackup(env, user, name, data, body);
  await writeCheck(env, user, { name, at: data.backedUpAt, ok: verified, logs });

  const all = await listBackups(env, user);
  for (const gone of backupsToPrune(all)) await deleteBackup(env, user, gone);
  return { name, bytes: body.length, logs, verified };
}

/**
 * Replace everything of this user's with the contents of a backup or export file.
 * A safety backup of the current data is taken first; the swap is one D1 batch, so it
 * either fully happens or doesn't happen at all.
 */
async function restoreFrom(env, user, data) {
  if (!data || typeof data !== "object") return json({ error: "That file isn't a backup." }, 400);
  const logs = data.logs && typeof data.logs === "object" ? data.logs : null;
  if (!logs) return json({ error: "That file has no training log in it." }, 400);
  const docs = [];
  if (data.plan && typeof data.plan === "object" && !Array.isArray(data.plan)) docs.push(["plan/main", data.plan]);
  for (const [d, v] of Object.entries(logs)) {
    if (!realDate(d) || !v || typeof v !== "object") continue;
    docs.push(["logs/" + d, v]);
  }
  for (const [id, v] of Object.entries(data.programs || {})) {
    if (!/^[a-z0-9-]{1,40}$/.test(id) || !v || typeof v !== "object") continue;
    docs.push(["programs/" + id, v]);
  }
  for (const [, v] of docs) if (JSON.stringify(v).length > MAX_BYTES) return json({ error: "An entry in that file is too large." }, 413);

  // time-stamped so two restores on one day each keep their own safety copy
  const safety = await backupNow(env, user, { suffix: "before-restore-" + new Date().toISOString().slice(11, 19).replace(/:/g, "") });
  const now = Date.now();
  const stmts = [env.DB.prepare("DELETE FROM docs WHERE user = ?1").bind(user)];
  for (const [path, v] of docs) {
    stmts.push(env.DB.prepare("INSERT INTO docs (user, path, data, updated_at) VALUES (?1, ?2, ?3, ?4)").bind(user, path, JSON.stringify(v), now));
  }
  await env.DB.batch(stmts);
  return json({
    restored: { plan: docs.some(([p]) => p === "plan/main"), logs: docs.filter(([p]) => p.startsWith("logs/")).length, programs: docs.filter(([p]) => p.startsWith("programs/")).length },
    safetyBackup: safety.name,
    from: data.backedUpAt || data.exportedAt || null,
    fileUser: data.user || null,
  });
}

/** Weekly cron: back up everyone who has data. */
// The verdict lives beside the backups under a name no backup can have, so the weekly
// run leaves a record rather than failing in silence. listBackups filters it out.
const CHECK_KEY = "_check";
async function writeCheck(env, user, info) {
  try {
    const key = (await backupPrefix(user)) + CHECK_KEY;
    const body = JSON.stringify(info);
    const bucket = r2(env);
    if (bucket) await bucket.put(key, body, { httpMetadata: { contentType: "application/json" } });
    else if (env.BACKUPS) await env.BACKUPS.put(key, body);
  } catch {}
}
export async function readCheck(env, user) {
  try {
    const key = (await backupPrefix(user)) + CHECK_KEY;
    const bucket = r2(env);
    const raw = bucket ? await (await bucket.get(key))?.text() : env.BACKUPS ? await env.BACKUPS.get(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null }
}

/** Does the stored copy read back as exactly what we wrote? */
export async function verifyBackup(env, user, name, data, body) {
  try {
    const back = await readBackup(env, user, name);
    if (!back || back.length !== body.length) return false;
    const got = JSON.parse(back);
    if (Object.keys(got.logs || {}).length !== Object.keys(data.logs || {}).length) return false;
    if (Object.keys(got.programs || {}).length !== Object.keys(data.programs || {}).length) return false;
    return !!got.plan === !!data.plan && got.user === data.user;
  } catch {
    return false;
  }
}

export async function backupEveryone(env) {
  const { results } = await env.DB.prepare("SELECT DISTINCT user FROM docs WHERE user != ?1").bind(LEGACY).all();
  for (const r of results) await backupNow(env, r.user, { manual: false });
}

// Both stores, newest first. A name in R2 wins over the same name in KV.
export async function listBackups(env, user) {
  const prefix = await backupPrefix(user);
  const seen = new Map();
  const bucket = r2(env);
  if (bucket) {
    let cursor;
    do {
      const page = await bucket.list({ prefix, cursor, include: ["customMetadata"] });
      for (const o of page.objects) {
        const m = o.customMetadata || {};
        const name = o.key.slice(prefix.length);
        if (!BACKUP_NAME.test(name)) continue;          // the check record is not a backup
        seen.set(name, { name, bytes: o.size, logs: m.logs ? +m.logs : undefined, at: m.at || o.uploaded.toISOString() });
      }
      cursor = page.truncated ? page.cursor : null;
    } while (cursor);
  }
  if (env.BACKUPS) {
    let cursor;
    do {
      const page = await env.BACKUPS.list({ prefix, cursor });
      for (const k of page.keys) {
        const name = k.name.slice(prefix.length);
        if (!BACKUP_NAME.test(name)) continue;
        if (!seen.has(name)) seen.set(name, { name, ...(k.metadata || {}) });
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  }
  return [...seen.values()].sort((a, b) => ((b.at || b.name) > (a.at || a.name) ? 1 : -1));
}

async function readAll(env, user) {
  const { results } = await env.DB.prepare("SELECT path, data FROM docs WHERE user = ?1").bind(user).all();
  const out = { plan: null, logs: {}, programs: {} };
  for (const row of results) {
    if (row.path === "plan/main") out.plan = JSON.parse(row.data);
    else if (row.path.startsWith("logs/")) out.logs[row.path.slice(5)] = JSON.parse(row.data);
    else if (row.path.startsWith("programs/")) out.programs[row.path.slice(9)] = JSON.parse(row.data);
  }
  return out;
}

function feedInfo(request, row) {
  if (!row) return { enabled: false };
  const origin = new URL(request.url).origin;
  return { enabled: true, url: `${origin}/cal/${row.token}.ics`, updatedAt: row.updated_at || null };
}

// Served without an Access JWT: a calendar app cannot sign in, so the unguessable token in
// the path is the whole of the authentication. Nothing else lives under /cal/.
export async function calendarFeed(token, env) {
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare("SELECT ics FROM cal_feeds WHERE token = ?1").bind(token).first();
  if (!row || !row.ics) return new Response("Not found", { status: 404 });
  return new Response(row.ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="operator-black.ics"',
      // Calendar clients poll on their own schedule; this just keeps them off the database.
      "cache-control": "public, max-age=1800",
      "x-robots-tag": "noindex",
    },
  });
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

/* ---------------- Cloudflare Access ---------------- */

// Returns {user} for a verified request, or a Response to send back.
async function authorize(request, env) {
  if (env.DEV_ALLOW_ANON === "1") {
    return { user: (request.headers.get("x-dev-user") || env.DEV_USER || "dev@local").toLowerCase() };
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return json({ error: "Cloudflare Access is not configured for this site." }, 503);
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return json({ error: "Sign in required." }, 401);
  try {
    const claims = await verifyAccessJwt(token, env);
    const email = String(claims.email || "").trim().toLowerCase();
    if (!email) return json({ error: "Your sign-in has no email address." }, 403);
    const allowed = (env.ALLOWED_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(email)) {
      return json({ error: "This account is not allowed." }, 403);
    }
    return { user: email };
  } catch {
    return json({ error: "Invalid sign-in token." }, 403);
  }
}

let certCache = { at: 0, keys: null };

async function accessKeys(team) {
  if (certCache.keys && Date.now() - certCache.at < 60 * 60 * 1000) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("certs");
  const { keys } = await res.json();
  certCache = { at: Date.now(), keys };
  return keys;
}

function b64url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function verifyAccessJwt(token, env) {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("format");
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(b64url(h)));
  const claims = JSON.parse(dec.decode(b64url(p)));

  let keys = await accessKeys(env.ACCESS_TEAM_DOMAIN);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    certCache = { at: 0, keys: null }; // keys may have rotated
    keys = await accessKeys(env.ACCESS_TEAM_DOMAIN);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error("kid");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64url(sig),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) throw new Error("signature");

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error("aud");
  if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) throw new Error("iss");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("exp");
  return claims;
}
