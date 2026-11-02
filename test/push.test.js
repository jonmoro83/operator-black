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

test("only this device drops the others and their pending alerts, and keeps its own", async () => {
  const { call } = await object();
  const [d1, d2, d3] = [await device(1), await device(2), await device(3)];
  for (const d of [d1, d2, d3]) await call("subscribe", { subscription: d.sub });
  const soon = [{ at: Date.now() + 60000, title: "Rest over" }];
  await call("set", { kind: "rest", rev: 1, alerts: soon, endpoint: d1.sub.endpoint });
  await call("set", { kind: "rest", rev: 1, alerts: soon, endpoint: d2.sub.endpoint });
  a.equal((await call("only", { endpoint: "https://web.push.apple.com/nobody" })).status, 400, "not for a device that isn't here");
  const r = await call("only", { endpoint: d1.sub.endpoint });
  a.deepEqual(r.json, { devices: 1, removed: 2 });
  const st = (await call("status")).json;
  a.equal(st.devices, 1);
  a.deepEqual(st.slots.map((s) => s.to), ["web.push.apple.com"], "the removed device's queued rest went with it");
  a.equal(st.queued, 1, "and this device's is still queued");
});

// A device's rest, set the way the app sets it.
const later = (ms) => Date.now() + ms;
async function setAlerts(call, kind, rev, alerts, endpoint) {
  return call("set", { kind, rev, alerts, endpoint });
}

test("a timer's alerts go in a slot of their own, sorted, and the alarm is the earliest of all", async () => {
  const { call, st } = await object();
  const d = await device(1); await call("subscribe", { subscription: d.sub });
  const r = await setAlerts(call, "iv", 1, [{ at: later(60000), title: "Two" }, { at: later(30000), title: "One" }], d.sub.endpoint);
  a.equal(r.status, 200); a.equal(r.json.applied, true); a.equal(r.json.scheduled, 2);
  const slots = await st.get("slots");
  a.deepEqual(slots["iv|" + d.sub.endpoint].alerts.map((q) => q.title), ["One", "Two"], "earliest first");
  await setAlerts(call, "rest", 1, [{ at: later(10000), title: "Rest done" }], d.sub.endpoint);
  a.ok(Math.abs(st.alarm - later(10000)) < 50, "the alarm follows the earliest alert across every slot");
  const s = (await call("status")).json;
  a.equal(s.queued, 3); a.equal(s.slots.length, 2);
});

test("a rest and an interval session do not clobber each other", async () => {
  const { call, st } = await object();
  const ep = (await device(1)).sub.endpoint;
  await setAlerts(call, "gt", 1, [{ at: later(300000), title: "Timer done" }], ep);
  // Under the old single queue, this replaced the generic timer's alert...
  await setAlerts(call, "rest", 2, [{ at: later(90000), title: "Rest done" }], ep);
  // ...and this cancel wiped it.
  await setAlerts(call, "rest", 3, [], ep);
  const slots = await st.get("slots");
  a.equal(slots["gt|" + ep].alerts.length, 1, "the generic timer still has its alert");
  a.equal(slots["rest|" + ep].alerts.length, 0, "and the rest's is gone, as asked");
});

test("a write that loses the race on the way in cannot undo a newer one", async () => {
  const { call, st } = await object();
  const ep = (await device(1)).sub.endpoint;
  // Plyo into HIC: the rest's cancel and the interval schedule leave together. Here the
  // newer schedule lands first and the older cancel second -- the order that used to
  // erase every interval alert.
  await setAlerts(call, "iv", 20, [{ at: later(60000), title: "Go hard" }, { at: later(120000), title: "Easy" }], ep);
  const stale = await setAlerts(call, "iv", 19, [], ep);
  a.equal(stale.json.applied, false); a.equal(stale.json.stale, true);
  a.equal((await st.get("slots"))["iv|" + ep].alerts.length, 2, "the newer schedule stands");
  // And the reverse: a cancel that lands first is remembered, so an older schedule
  // arriving late cannot bring the alert back.
  await setAlerts(call, "rest", 31, [], ep);
  await setAlerts(call, "rest", 30, [{ at: later(90000), title: "Rest done" }], ep);
  a.equal((await st.get("slots"))["rest|" + ep].alerts.length, 0, "a cancelled alert stays cancelled");
  // The same revision again is the same request again, and harmless.
  a.equal((await setAlerts(call, "rest", 31, [], ep)).json.applied, true);
});

test("each device's timers are its own", async () => {
  const { call, st } = await object();
  const phone = (await device(1)).sub.endpoint, laptop = (await device(2)).sub.endpoint;
  await setAlerts(call, "rest", 5, [{ at: later(90000), title: "Phone rest" }], phone);
  await setAlerts(call, "rest", 1, [], laptop);
  const slots = await st.get("slots");
  a.equal(slots["rest|" + phone].alerts.length, 1, "the laptop cancelling its rest leaves the phone's alone");
});

test("a set is refused whole: outside two hours, too many, an unknown kind, no revision", async () => {
  const { call, st } = await object();
  const ep = (await device(1)).sub.endpoint;
  a.equal((await setAlerts(call, "rest", 1, [{ at: Date.now() - 10000 }], ep)).status, 400, "more than five seconds stale");
  a.equal((await setAlerts(call, "rest", 1, [{ at: later(3 * 3600 * 1000) }], ep)).status, 400, "more than two hours out");
  a.equal((await setAlerts(call, "rest", 1, [{ at: "soon" }], ep)).status, 400, "not a time");
  a.equal((await setAlerts(call, "iv", 1, Array.from({ length: 241 }, (_, i) => ({ at: later(1000 + i) })), ep)).status, 400);
  a.equal((await setAlerts(call, "Rest!", 1, [], ep)).status, 400, "kind is a short lowercase word");
  a.equal((await setAlerts(call, "legacy", 1, [], ep)).status, 400, "and not the old API's own slot");
  a.equal((await call("set", { kind: "rest", alerts: [] })).status, 400, "a revision is required");
  a.equal((await setAlerts(call, "rest", 1, [], "http://evil.example/x")).status, 400, "an endpoint has to be real");
  a.equal(await st.get("slots"), undefined, "nothing half-stored from a refusal");
  a.equal(st.alarm, null);
  await setAlerts(call, "rest", 2, [{ at: later(5000), title: "x".repeat(500), body: "y".repeat(500) }], ep);
  const q = (await st.get("slots"))["rest|" + ep].alerts[0];
  a.equal(q.title.length, 80); a.equal(q.body.length, 160, "titles and bodies are capped");
});

test("the last alert going clears the alarm", async () => {
  const { call, st } = await object();
  const ep = (await device(1)).sub.endpoint;
  await setAlerts(call, "rest", 1, [{ at: later(5000), title: "x" }], ep);
  a.ok(st.alarm);
  await setAlerts(call, "rest", 2, [], ep);
  a.equal(st.alarm, null);
});

test("an alert goes to the device that set it, and the send is logged with how late it was", async () => {
  const { o, call, st } = await object();
  const d1 = await device(1), d2 = await device(2);
  await call("subscribe", { subscription: d1.sub }); await call("subscribe", { subscription: d2.sub });
  const now = Date.now();
  // A late alarm: two came due while it waited. Only the newer one is still worth reading.
  await st.put("slots", { ["rest|" + d1.sub.endpoint]: { kind: "rest", to: d1.sub.endpoint, rev: 1, alerts: [
    { at: now - 3000, title: "Stale", body: "" }, { at: now - 1200, title: "Rest done", body: "Next: squat." },
    { at: now + 60000, title: "Later", body: "" }] } });
  const f = captureFetch(201);
  try {
    await o.alarm();
    a.equal(f.calls.length, 1, "one push, to the phone that started the rest, not every device");
    a.equal(f.calls[0].url, d1.sub.endpoint);
    a.equal(f.calls[0].init.headers.Topic, "rest", "and its topic is its timer, so timers never collapse each other");
    const payload = JSON.parse((await decrypt(u8(f.calls[0].init.body), d1.ua, d1.auth)).text);
    a.deepEqual(payload, { title: "Rest done", body: "Next: squat." }, "the newest due");
  } finally { f.restore() }
  const slot = (await st.get("slots"))["rest|" + d1.sub.endpoint];
  a.deepEqual(slot.alerts.map((q) => q.title), ["Later"], "the future one stays");
  a.equal(st.alarm, now + 60000, "and the alarm moves to it");
  const log = (await call("status")).json.log;
  a.equal(log.length, 1);
  a.equal(log[0].kind, "rest"); a.equal(log[0].skipped, 1);
  a.ok(log[0].late >= 1200 && log[0].late < 5000, `late is measured against the alert's own time (${log[0].late} ms)`);
  a.equal(log[0].results[0].status, 201);
});

test("an alert for a device that has gone from the list goes to every device instead", async () => {
  const { o, call, st } = await object();
  const d1 = await device(1); await call("subscribe", { subscription: d1.sub });
  await st.put("slots", { "rest|https://web.push.apple.com/gone": { kind: "rest", to: "https://web.push.apple.com/gone", rev: 1,
    alerts: [{ at: Date.now() - 10, title: "Rest done", body: "" }] } });
  const f = captureFetch(201);
  try { await o.alarm() } finally { f.restore() }
  a.equal(f.calls.length, 1, "never lost to bookkeeping");
  a.equal((await call("status")).json.log[0].to, "all (device not registered)", "and the log says why it went wide");
});

test("a device the push service says is gone is dropped; one that merely failed is kept", async () => {
  const { o, call, st } = await object();
  const gone = await device(1), expired = await device(2), flaky = await device(3), fine = await device(4);
  for (const d of [gone, expired, flaky, fine]) await call("subscribe", { subscription: d.sub });
  // An untargeted alert, so it reaches all four.
  await st.put("slots", { "legacy|*": { kind: "legacy", to: null, rev: 1, alerts: [{ at: Date.now() - 10, title: "Rest done", body: "" }] } });
  const f = captureFetch((url) => url.endsWith("dev1") ? 410 : url.endsWith("dev2") ? 404 : url.endsWith("dev3") ? 503 : 201);
  try { await o.alarm() } finally { f.restore() }
  const left = Object.keys(await st.get("subs")).sort();
  a.deepEqual(left, [flaky.sub.endpoint, fine.sub.endpoint].sort(),
    "410 and 404 mean unsubscribed for good; a 503 is a bad moment, not a dead device");
});

test("turning alerts off on a device takes its pending alerts with it", async () => {
  const { call, st } = await object();
  const d = await device(1); await call("subscribe", { subscription: d.sub });
  await setAlerts(call, "rest", 1, [{ at: later(90000), title: "Rest done" }], d.sub.endpoint);
  await call("unsubscribe", { endpoint: d.sub.endpoint });
  a.equal((await st.get("slots"))["rest|" + d.sub.endpoint], undefined);
  a.equal(st.alarm, null);
});

test("a phone still running the old app keeps its alerts through the switchover", async () => {
  const { call, st } = await object();
  // The pre-slots API: one queue, replaced by every schedule, emptied by cancel.
  const r = await call("schedule", { alerts: [{ at: later(60000), title: "Two" }, { at: later(30000), title: "One" }] });
  a.equal(r.json.scheduled, 2);
  a.deepEqual((await st.get("slots"))["legacy|*"].alerts.map((q) => q.title), ["One", "Two"]);
  await call("schedule", { at: later(90000), title: "Rest done" });
  a.deepEqual((await st.get("slots"))["legacy|*"].alerts.map((q) => q.title), ["Rest done"], "replaced, not appended");
  a.equal((await call("schedule", { at: Date.now() - 10000 })).status, 400);
  await call("cancel", {});
  a.equal((await st.get("slots"))["legacy|*"], undefined); a.equal(st.alarm, null);
  // A queue left pending in storage at the moment of the deploy is picked up, not lost.
  const fresh = await object();
  await fresh.st.put("queue", [{ at: later(40000), title: "Pending at deploy", body: "" }]);
  const s = (await fresh.call("status")).json;
  a.equal(s.queued, 1);
  a.equal(await fresh.st.get("queue"), undefined, "the old key is folded in once");
});

test("wipe removes everything, and an unknown operation is a 404", async () => {
  const { call, st } = await object();
  const d = await device(1);
  await call("subscribe", { subscription: d.sub });
  await setAlerts(call, "rest", 1, [{ at: later(5000) }], d.sub.endpoint);
  await call("wipe", {});
  a.equal(st.m.size, 0); a.equal(st.alarm, null);
  a.equal((await call("nonsense", {})).status, 404);
});
