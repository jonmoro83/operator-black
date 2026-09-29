// Operator + Black API — Worker route handler backed by D1.
//
//   GET  /api/state            → { plan, logs: { "YYYY-MM-DD": {...} } }
//   PUT  /api/doc/plan/main    → replace the plan document
//   PUT  /api/doc/logs/<date>  → replace one day's log
//   GET  /api/export           → everything, as a downloadable JSON file
//   GET  /api/backups          → list automatic backups (newest first)
//   GET  /api/backups/<name>   → download one backup
//   POST /api/backups          → take a backup now
//   GET  /api/version          → fingerprint of the current page + deploy info
//   GET  /api/push/key         → VAPID public key for pushManager.subscribe
//   GET  /api/push/status      → devices with alerts on, pending alarm time
//   POST /api/push/subscribe | unsubscribe | schedule | cancel | test
//
// Every request must carry a valid Cloudflare Access JWT (Cf-Access-Jwt-Assertion).
// Set ACCESS_TEAM_DOMAIN and ACCESS_AUD in wrangler.toml. For local dev only,
// DEV_ALLOW_ANON=1 in .dev.vars skips the check.

import { vapidPublicKey } from "./webpush.js";

const DOC_PATH = /^(plan\/main|logs\/\d{4}-\d{2}-\d{2})$/;
const MAX_BYTES = 256 * 1024;

export async function handleApi(request, env) {
  const denied = await authorize(request, env);
  if (denied) return denied;

  const route = new URL(request.url).pathname.replace(/^\/api\/?/, "");

  if (route === "state" && request.method === "GET") {
    return json(await readAll(env), 200, { "cache-control": "no-store" });
  }

  if (route === "export" && request.method === "GET") {
    const day = new Date().toISOString().slice(0, 10);
    return json({ exportedAt: new Date().toISOString(), ...(await readAll(env)) }, 200, {
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
  if (route === "push/key" && request.method === "GET") {
    return json({ key: vapidPublicKey(env) });
  }
  if (route.startsWith("push/")) {
    const op = route.slice(5);
    const allowed = { status: "GET", subscribe: "POST", unsubscribe: "POST", schedule: "POST", cancel: "POST", test: "POST" };
    if (allowed[op] !== request.method) return json({ error: "Not found." }, 404);
    const stub = env.ALERTS.get(env.ALERTS.idFromName("main"));
    return stub.fetch(new Request(`https://alerts/${op}`, { method: request.method, body: request.method === "POST" ? await request.text() : undefined }));
  }

  if (route === "backups" && request.method === "GET") {
    return json({ backups: await listBackups(env) }, 200, { "cache-control": "no-store" });
  }
  if (route === "backups" && request.method === "POST") {
    return json(await backupNow(env), 200);
  }
  if (route.startsWith("backups/") && request.method === "GET") {
    const name = route.slice(8);
    if (!/^\d{4}-\d{2}-\d{2}(-manual)?$/.test(name)) return json({ error: "Unknown backup." }, 404);
    const body = await env.BACKUPS.get(BACKUP_PREFIX + name);
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
      `INSERT INTO docs (path, data, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
      .bind(path, JSON.stringify(body), Date.now())
      .run();
    return new Response(null, { status: 204 });
  }

  return json({ error: "Not found." }, 404);
}

/* ---------------- backups (Workers KV) ---------------- */

const BACKUP_PREFIX = "backup:";
const KEEP_BACKUPS = 26;

export async function backupNow(env, { manual = true } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const name = manual ? `${day}-manual` : day;
  const data = { backedUpAt: new Date().toISOString(), ...(await readAll(env)) };
  const body = JSON.stringify(data);
  await env.BACKUPS.put(BACKUP_PREFIX + name, body, {
    metadata: { bytes: body.length, logs: Object.keys(data.logs).length, at: data.backedUpAt },
  });
  // prune the oldest beyond the retention window
  const all = await listBackups(env);
  for (const old of all.slice(KEEP_BACKUPS)) await env.BACKUPS.delete(BACKUP_PREFIX + old.name);
  return { name, bytes: body.length, logs: Object.keys(data.logs).length };
}

async function listBackups(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.BACKUPS.list({ prefix: BACKUP_PREFIX, cursor });
    for (const k of page.keys) out.push({ name: k.name.slice(BACKUP_PREFIX.length), ...(k.metadata || {}) });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => ((b.at || b.name) > (a.at || a.name) ? 1 : -1));
}

async function readAll(env) {
  const { results } = await env.DB.prepare("SELECT path, data FROM docs").all();
  const out = { plan: null, logs: {} };
  for (const row of results) {
    if (row.path === "plan/main") out.plan = JSON.parse(row.data);
    else if (row.path.startsWith("logs/")) out.logs[row.path.slice(5)] = JSON.parse(row.data);
  }
  return out;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

/* ---------------- Cloudflare Access ---------------- */

async function authorize(request, env) {
  if (env.DEV_ALLOW_ANON === "1") return null;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return json({ error: "Cloudflare Access is not configured for this site." }, 503);
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return json({ error: "Sign in required." }, 401);
  try {
    const claims = await verifyAccessJwt(token, env);
    const allowed = (env.ALLOWED_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(String(claims.email || "").toLowerCase())) {
      return json({ error: "This account is not allowed." }, 403);
    }
    return null;
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
