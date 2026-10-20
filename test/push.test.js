// Push: the last part of the Worker without tests. Two halves.
//
//   webpush.js  payload encryption (RFC 8291) and the server's identity (RFC 8292, VAPID).
//               If either is wrong, every alert is rejected by the push service and
//               nothing in the app says so -- the rest just ends silently on a locked
//               phone. So the decryptor below is checked against the RFC's own worked
//               example first, and only then used to check what webpush.js produces.
//   alerts.js   the Durable Object: subscriptions, the alert queue, its alarm.
const { test } = require("node:test");
const a = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const enc = new TextEncoder();
const u8 = (b) => new Uint8Array(b);
const b64u = (s) => u8(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
const tob64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length } return o };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return u8(await crypto.subtle.sign("HMAC", k, data));
}

/* A user agent's side of RFC 8291, written from the RFC rather than from webpush.js, so
   the two can disagree. Returns the plaintext and every intermediate value. */
async function decrypt(body, ua, auth) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const priv = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: ua.x, y: ua.y, d: ua.d },
    { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const pub = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = u8(await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256));
  const prkKey = await hmac(auth, ecdh);
  const ikm = (await hmac(prkKey, cat(enc.encode("WebPush: info\0"), ua.pub, asPub, u8([1])))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), u8([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), u8([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const pt = u8(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct));
  let i = pt.length - 1; while (i >= 0 && pt[i] === 0) i--;
  if (pt[i] !== 2) throw new Error("no last-record delimiter");
  return { text: new TextDecoder().decode(pt.slice(0, i)), rs, idlen, asPub, ecdh, prkKey, ikm, prk, cek, nonce };
}
// A browser's subscription keys: a P-256 pair and a 16-byte auth secret.
async function userAgent() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pub = u8(await crypto.subtle.exportKey("raw", kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { ua: { x: jwk.x, y: jwk.y, d: jwk.d, pub }, auth,
    keys: { p256dh: tob64u(pub), auth: tob64u(auth) } };
}
async function vapidEnv() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { VAPID_JWK: JSON.stringify({ x: jwk.x, y: jwk.y, d: jwk.d }), VAPID_SUBJECT: "https://operatorblack.com", pub: kp.publicKey };
}
let wp;
const webpush = async () => (wp ||= await import("../src/webpush.js"));

// ---------------------------------------------------------------- RFC 8291 Appendix A
const RFC = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  as_public: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  ua_public: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  ua_private: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  ecdh: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  prk_key: "Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  prk: "09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
        "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
        "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

test("the test's decryptor reproduces RFC 8291's worked example, value for value", async () => {
  const pub = b64u(RFC.ua_public);
  const ua = { x: tob64u(pub.slice(1, 33)), y: tob64u(pub.slice(33, 65)), d: RFC.ua_private, pub };
  const r = await decrypt(b64u(RFC.body), ua, b64u(RFC.auth));
  a.equal(r.text, "When I grow up, I want to be a watermelon", "the RFC's plaintext");
  a.equal(r.text, new TextDecoder().decode(b64u(RFC.plaintext)));
  a.equal(r.rs, 4096); a.equal(r.idlen, 65);
  a.equal(tob64u(r.asPub), RFC.as_public, "the sender's key travels in the header");
  for (const [k, v] of [["ecdh", RFC.ecdh], ["prkKey", RFC.prk_key], ["ikm", RFC.ikm], ["prk", RFC.prk], ["cek", RFC.cek], ["nonce", RFC.nonce]])
    a.equal(tob64u(r[k]), v, `${k} matches the RFC`);
});

test("webpush.js encrypts so that a standard user agent can read it", async () => {
  const { encryptPayload } = await webpush();
  const { ua, auth, keys } = await userAgent();
  const msg = JSON.stringify({ title: "Rest done", body: "Next: squat, set two." });
  const body = await encryptPayload({ endpoint: "https://web.push.apple.com/x", keys }, msg);
  const r = await decrypt(body, ua, auth);
  a.equal(r.text, msg, "the decryptor that reproduces the RFC reads it back exactly");
  a.equal(r.rs, 4096, "record size as the RFC's example");
  a.equal(r.idlen, 65, "an uncompressed P-256 key in the header");
  // A fresh salt and a fresh ephemeral key each time, or two alerts would share a key.
  const again = await encryptPayload({ endpoint: "https://web.push.apple.com/x", keys }, msg);
  a.notDeepEqual(again.slice(0, 16), body.slice(0, 16), "a new salt per message");
  a.notDeepEqual(again.slice(21, 86), body.slice(21, 86), "and a new sender key");
});

test("an alert encrypted for one browser cannot be read by another", async () => {
  const { encryptPayload } = await webpush();
  const me = await userAgent(), them = await userAgent();
  const body = await encryptPayload({ endpoint: "https://x.example/1", keys: me.keys }, "private");
  await a.rejects(decrypt(body, them.ua, them.auth), "the wrong keys fail authentication");
});

// ---------------------------------------------------------------- VAPID, RFC 8292
function captureFetch(status = 201) {
  const calls = [], orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(null, { status: typeof status === "function" ? status(String(url)) : status }) };
  return { calls, restore: () => { globalThis.fetch = orig } };
}

test("sendPush signs as the server, with a VAPID token the push service can verify", async () => {
  const { sendPush, vapidPublicKey } = await webpush();
  const env = await vapidEnv(), { ua, auth, keys } = await userAgent();
  const f = captureFetch(201);
  try {
    const t0 = Math.floor(Date.now() / 1000);
    const status = await sendPush({ endpoint: "https://web.push.apple.com/QGuR9", keys }, "hello", env);
    a.equal(status, 201, "the push service's status comes back");
    a.equal(f.calls.length, 1);
    const { url, init } = f.calls[0], h = init.headers;
    a.equal(url, "https://web.push.apple.com/QGuR9");
    a.equal(init.method, "POST");
    a.equal(h["Content-Encoding"], "aes128gcm");
    a.equal(h.TTL, "120", "a rest alert two minutes late is not worth delivering");
    a.equal(h.Urgency, "high");
    a.equal(h.Topic, "rest", "so a newer alert replaces an undelivered older one");
    const m = h.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
    a.ok(m, "vapid t=<jwt>, k=<key>");
    a.equal(m[4], vapidPublicKey(env), "the key that signed it");
    const claims = JSON.parse(Buffer.from(m[2], "base64url").toString());
    a.equal(claims.aud, "https://web.push.apple.com", "the audience is the push service's origin, not the full endpoint");
    a.ok(claims.exp > t0 + 11 * 3600 && claims.exp <= t0 + 12 * 3600 + 5, "expires in 12 hours, inside RFC 8292's 24");
    a.equal(claims.sub, "https://operatorblack.com");
    a.deepEqual(JSON.parse(Buffer.from(m[1], "base64url").toString()), { typ: "JWT", alg: "ES256" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, env.pub,
      Buffer.from(m[3], "base64url"), enc.encode(`${m[1]}.${m[2]}`));
    a.ok(ok, "the ES256 signature verifies against the server's public key");
    a.equal((await decrypt(u8(init.body), ua, auth)).text, "hello", "and the body is the encrypted payload");
  } finally { f.restore() }
});

test("the public key handed to browsers is the uncompressed point of the VAPID key", async () => {
  const { vapidPublicKey } = await webpush();
  const env = await vapidEnv();
  const raw = b64u(vapidPublicKey(env));
  a.equal(raw.length, 65); a.equal(raw[0], 4, "0x04, uncompressed");
  const spki = u8(await crypto.subtle.exportKey("raw", env.pub));
  a.deepEqual(raw, spki, "the same point WebCrypto exports");
});

// ---------------------------------------------------------------- the Durable Object
// alerts.js imports DurableObject from cloudflare:workers, which Node cannot resolve.
// Load the source with that one import replaced, the way the app harness evals the app.
let Alerts;
async function restAlerts() {
  if (Alerts) return Alerts;
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "alerts.js"), "utf8")
    .replace('import { DurableObject } from "cloudflare:workers";',
      "class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env } }")
    .replace('from "./webpush.js"', `from "${pathToFileURL(path.join(__dirname, "..", "src", "webpush.js")).href}"`);
  a.ok(!src.includes("cloudflare:workers"), "the stub took");
  const file = path.join(os.tmpdir(), `alerts-under-test-${process.pid}.mjs`);
  fs.writeFileSync(file, src);
  try { Alerts = (await import(pathToFileURL(file).href)).RestAlerts } finally { fs.unlinkSync(file) }
  return Alerts;
}
function storage() {
  const m = new Map(); let alarm = null;
  return { m, get alarm() { return alarm },
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined },
    async put(k, v) { m.set(k, structuredClone(v)) }, async delete(k) { m.delete(k) },
    async deleteAll() { m.clear() }, async setAlarm(t) { alarm = t }, async getAlarm() { return alarm },
    async deleteAlarm() { alarm = null } };
}
async function object(extraEnv = {}) {
  const C = await restAlerts(), st = storage(), env = Object.assign(await vapidEnv(), extraEnv);
  const o = new C({ storage: st }, env);
  const call = async (op, body) => {
    const r = await o.fetch(new Request("https://do/" + op, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }));
    return { status: r.status, json: await r.json() };
  };
  return { o, st, call, env };
}
async function device(n) {
  const u = await userAgent();
  return Object.assign(u, { sub: { endpoint: `https://web.push.apple.com/dev${n}`, keys: u.keys } });
}

test("a subscription has to be a real https endpoint with both keys", async () => {
  const { call } = await object();
  const d = await device(1);
  a.equal((await call("subscribe", { subscription: d.sub })).json.devices, 1);
  a.equal((await call("subscribe", { subscription: { ...d.sub, endpoint: "http://evil.example/x" } })).status, 400, "no plain http");
  a.equal((await call("subscribe", { subscription: { endpoint: "https://x.example/y", keys: { auth: "a" } } })).status, 400, "no missing key");
  a.equal((await call("subscribe", { subscription: { ...d.sub, endpoint: "http://localhost:8787/p" } })).status, 400,
    "localhost only when development says so");
  const dev = await object({ DEV_ALLOW_ANON: "1" });
  a.equal((await dev.call("subscribe", { subscription: { ...d.sub, endpoint: "http://localhost:8787/p" } })).status, 200);
  // The same device twice is one device, and unsubscribing removes it.
  await call("subscribe", { subscription: d.sub });
  a.equal((await call("status")).json.devices, 1, "resubscribing is not a second device");
  a.equal((await call("unsubscribe", { endpoint: d.sub.endpoint })).json.devices, 0);
});

test("a schedule replaces the queue, sorted, and arms the alarm for the first", async () => {
  const { call, st } = await object();
  const now = Date.now();
  const r = await call("schedule", { alerts: [{ at: now + 60000, title: "Two" }, { at: now + 30000, title: "One" }] });
  a.equal(r.json.scheduled, 2);
  a.deepEqual((await st.get("queue")).map((q) => q.title), ["One", "Two"], "earliest first");
  a.equal(st.alarm, now + 30000, "the alarm is the first alert");
  // A single {at,title,body} is a queue of one, and replaces what was there.
  await call("schedule", { at: now + 90000, title: "Rest done", body: "Next: bench." });
  a.deepEqual((await st.get("queue")).map((q) => q.title), ["Rest done"], "replaced, not appended");
  // Due right now still gets a quarter-second, rather than an alarm in the past.
  await call("schedule", { at: now - 1000, title: "Just now" });
  a.ok(st.alarm >= now + 250, "never in the past");
  const s = (await call("status")).json;
  a.equal(s.queued, 1); a.equal(s.pendingAt, st.alarm);
});

test("a schedule outside the next two hours, or of more than eighty, is refused whole", async () => {
  const { call, st } = await object();
  const now = Date.now();
  a.equal((await call("schedule", { at: now - 10000 })).status, 400, "more than five seconds stale");
  a.equal((await call("schedule", { at: now + 3 * 3600 * 1000 })).status, 400, "more than two hours out");
  a.equal((await call("schedule", { at: "soon" })).status, 400, "not a time");
  a.equal((await call("schedule", { alerts: Array.from({ length: 81 }, (_, i) => ({ at: now + 1000 + i })) })).status, 400);
  a.equal((await call("schedule", { alerts: [] })).status, 400);
  a.equal(await st.get("queue"), undefined, "nothing half-stored from a refused schedule");
  a.equal(st.alarm, null);
  // Titles and bodies are capped, so a long one cannot bloat the queue.
  await call("schedule", { at: now + 5000, title: "x".repeat(500), body: "y".repeat(500) });
  const q = (await st.get("queue"))[0];
  a.equal(q.title.length, 80); a.equal(q.body.length, 160);
});

test("cancel clears the queue and the alarm", async () => {
  const { call, st } = await object();
  await call("schedule", { at: Date.now() + 5000, title: "x" });
  await call("cancel", {});
  a.equal(st.alarm, null); a.equal(await st.get("queue"), undefined);
});

test("the alarm sends only the newest of what is due, to every device, and re-arms for the rest", async () => {
  const { o, call, st } = await object();
  const d1 = await device(1), d2 = await device(2);
  await call("subscribe", { subscription: d1.sub }); await call("subscribe", { subscription: d2.sub });
  const now = Date.now();
  // A late alarm: two came due while it waited. Only the newer one is still worth reading.
  await st.put("queue", [{ at: now - 3000, title: "Stale", body: "" }, { at: now - 100, title: "Rest done", body: "Next: squat." },
    { at: now + 60000, title: "Later", body: "" }]);
  const f = captureFetch(201);
  try {
    await o.alarm();
    a.equal(f.calls.length, 2, "one push per device");
    a.deepEqual(f.calls.map((c) => c.url).sort(), [d1.sub.endpoint, d2.sub.endpoint].sort());
    for (const c of f.calls) {
      const who = c.url === d1.sub.endpoint ? d1 : d2;
      const payload = JSON.parse((await decrypt(u8(c.init.body), who.ua, who.auth)).text);
      a.deepEqual(payload, { title: "Rest done", body: "Next: squat." }, "the newest due, decrypted on each device");
    }
    a.deepEqual((await st.get("queue")).map((q) => q.title), ["Later"], "the future one stays");
    a.equal(st.alarm, now + 60000, "and the alarm moves to it");
  } finally { f.restore() }
  // The last one goes, and the queue goes with it.
  await st.put("queue", [{ at: now - 10, title: "Last", body: "" }]);
  const g = captureFetch(201);
  try { await o.alarm() } finally { g.restore() }
  a.equal(await st.get("queue"), undefined);
});

test("a device the push service says is gone is dropped; one that merely failed is kept", async () => {
  const { o, call, st } = await object();
  const gone = await device(1), expired = await device(2), flaky = await device(3), fine = await device(4);
  for (const d of [gone, expired, flaky, fine]) await call("subscribe", { subscription: d.sub });
  await st.put("queue", [{ at: Date.now() - 10, title: "Rest done", body: "" }]);
  const f = captureFetch((url) => url.endsWith("dev1") ? 410 : url.endsWith("dev2") ? 404 : url.endsWith("dev3") ? 503 : 201);
  try { await o.alarm() } finally { f.restore() }
  const left = Object.keys(await st.get("subs")).sort();
  a.deepEqual(left, [flaky.sub.endpoint, fine.sub.endpoint].sort(),
    "410 and 404 mean unsubscribed for good; a 503 is a bad moment, not a dead device");
});

test("wipe removes everything, and an unknown operation is a 404", async () => {
  const { call, st } = await object();
  await call("subscribe", { subscription: (await device(1)).sub });
  await call("schedule", { at: Date.now() + 5000 });
  await call("wipe", {});
  a.equal(st.m.size, 0); a.equal(st.alarm, null);
  a.equal((await call("nonsense", {})).status, 404);
});
