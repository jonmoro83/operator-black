// The service worker's fetch behavior, which nothing covered: build.test.js checks that
// its cache name is stamped, not what it serves. The worker is run here against a cache
// and a network that can be switched off.
const { test } = require("node:test");
const a = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ORIGIN = "https://operatorblack.com";

function worker() {
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
  const net = { online: true, serve: (url) => "network:" + url, asked: [] };
  const stores = new Map(), handlers = {};
  const key = (r) => new URL(typeof r === "string" ? r : r.url, ORIGIN).href;
  const bare = (k) => { const u = new URL(k); u.search = ""; return u.href };
  const cacheOf = (m) => ({
    async put(r, res) { m.set(key(r), res) },
    async match(r, o) {
      const k = key(r);
      if (m.has(k)) return m.get(k);
      if (o && o.ignoreSearch) for (const [kk, v] of m) if (bare(kk) === bare(k)) return v;
      return undefined;
    },
  });
  const caches = {
    async open(n) { if (!stores.has(n)) stores.set(n, new Map()); return cacheOf(stores.get(n)) },
    async keys() { return [...stores.keys()] },
    async delete(n) { stores.delete(n) },
  };
  const fetch = async (r) => {
    const url = key(r); net.asked.push(url);
    if (!net.online) throw new TypeError("Failed to fetch");
    const res = { ok: true, type: "basic", body: net.serve(url), clone() { return this } };
    return res;
  };
  const self = { addEventListener: (t, f) => (handlers[t] = f), location: { origin: ORIGIN },
    skipWaiting: async () => {}, clients: { claim: async () => {} }, registration: {} };
  vm.runInNewContext(src, { self, caches, fetch, URL, Response, setTimeout, clearTimeout });
  const settle = async (name) => { let p; handlers[name]({ waitUntil: (x) => (p = x) }); await p };
  const get = async (url, mode) => {
    let out;
    handlers.fetch({ request: { method: "GET", url: new URL(url, ORIGIN).href, mode: mode || "no-cors" }, respondWith: (x) => (out = x) });
    return out;
  };
  return { net, stores, install: async () => { await settle("install"); await settle("activate") }, get };
}

test("the first launch with no signal after a deploy still gets its script and styles", async () => {
  const w = worker();
  w.net.serve = (url) => "v2:" + url;
  await w.install();   // a new worker: a new cache holding only what it precached

  // The page asks for its files by hash. The precache holds them without one, and the
  // old cache that had the hashed copies was deleted on activate. This is the launch
  // that got a page and nothing to run.
  w.net.online = false;
  const page = await w.get("/", "navigate");
  a.equal(page.body, "v2:" + ORIGIN + "/");
  for (const file of ["/app.js?b=0123456789", "/app.css?b=0123456789", "/releases.js?b=abcdef0123"]) {
    const res = await w.get(file);
    a.ok(res, `${file} is answered offline`);
    a.equal(res.body, "v2:" + ORIGIN + file.replace(/\?.*$/, ""), "from the copy fetched alongside that page");
  }
});

test("online, the hashed address wins over the precache, and is then cached under its own name", async () => {
  const w = worker();
  w.net.serve = (url) => "v2:" + url;
  await w.install();

  // A deploy has happened since this worker installed. The page is fetched network-first
  // and asks for the new bundle; an older precache answering for it would run the wrong
  // code under a page that says it is current.
  w.net.serve = (url) => "v3:" + url;
  const first = await w.get("/app.js?b=newhash000");
  a.equal(first.body, "v3:" + ORIGIN + "/app.js?b=newhash000", "the network's, not the precache's");

  w.net.online = false;
  const again = await w.get("/app.js?b=newhash000");
  a.equal(again.body, "v3:" + ORIGIN + "/app.js?b=newhash000", "and offline it is that exact copy that comes back");
});

test("the fallback is for the app's own files, and a miss is still a miss", async () => {
  const w = worker();
  await w.install();
  w.net.online = false;
  // A font stylesheet's query string says which fonts. Ignoring it would be a wrong answer.
  const cache = w.stores.values().next().value;
  cache.set("https://fonts.googleapis.com/css2?family=B612", { ok: true, type: "opaque", body: "b612", clone() { return this } });
  await a.rejects(w.get("https://fonts.googleapis.com/css2?family=Barlow"), /Failed to fetch/);
  await a.rejects(w.get("/never-cached.js?b=1"), /Failed to fetch/, "nothing cached, nothing invented");
  // The API is never the worker's business, online or off.
  a.equal(await w.get("/api/state"), undefined);
});
