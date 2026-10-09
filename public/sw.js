// Offline support for Operator + Black.
//
// - Pages: network first (so a signed-out session still reaches the Access login),
//   falling back to the cached app when offline or the network stalls.
// - Static files: cache first. Google Fonts: served from cache, refreshed in the background.
// - /api is never cached here. The page keeps its own copy of your data and a queue
//   of unsent changes in localStorage.

// Stamped by build.js from the contents of SHELL below. Do not edit by hand: it moves
// when one of those files does, which is what drops the old cache after a deploy.
const VERSION = "ob-18b8cfeb5f";
const SHELL = ["/", "/app.css", "/app.js", "/releases.js", "/icon-32.png", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin", redirect: "manual", cache: "no-store" });
            if (res.ok && res.type === "basic") await cache.put(url, res);
          } catch {}
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) return;
    if (req.mode === "navigate") return event.respondWith(page(req));
    // The app's own css/js is served from cache, then refreshed in the background, so a
    // style or release-note change lands on the next load without a version bump here.
    if (/\.(css|js)$/.test(url.pathname)) return event.respondWith(staleWhileRevalidate(req));
    return event.respondWith(cacheFirst(req));
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    return event.respondWith(staleWhileRevalidate(req));
  }
});

async function page(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await withTimeout(fetch(req), NAV_TIMEOUT_MS);
    // Only a real page from our own origin replaces the cached app. A redirect to the
    // Access login passes straight through so the browser can sign you in.
    if (res.ok && res.type === "basic") await cache.put("/", res.clone());
    return res;
  } catch {
    return (await cache.match("/")) || new Response("Offline, and the app isn't cached yet. Open it once while online.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}

// Rest alerts: the server pushes {title, body} when a rest ends.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Rest done" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Rest done", {
      body: data.body || "",
      // A fresh tag per alert: a replaced notification is not re-announced by Siri.
      tag: data.tag || "ob-" + Date.now(),
      renotify: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) if ("focus" in w) return w.focus();
      return self.clients.openWindow("/");
    })()
  );
});
