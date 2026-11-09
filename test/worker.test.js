// The Worker entry: routing, the www redirect, the version stamp and the security
// headers every page leaves with. Node has no HTMLRewriter, so a small stand-in appends
// to <head> the way the real one does for the one call the Worker makes.
const { test } = require("node:test");
const a = require("node:assert");

globalThis.HTMLRewriter = class {
  constructor() { this.handlers = [] }
  on(sel, h) { this.handlers.push([sel, h]); return this }
  transform(res) {
    const handlers = this.handlers;
    const body = new ReadableStream({
      async start(c) {
        let html = await res.text();
        for (const [sel, h] of handlers) {
          if (sel !== "head" || !h.element) continue;
          h.element({ append(s) { html = html.replace("</head>", s + "</head>") } });
        }
        c.enqueue(new TextEncoder().encode(html));
        c.close();
      },
    });
    return new Response(body, { status: res.status, headers: res.headers });
  }
};

// worker.js re-exports the Durable Object, whose `cloudflare:workers` import Node cannot
// resolve. Same approach as push.test.js: load a copy with that one line removed.
let worker;
async function load() {
  if (worker) return worker;
  const fs = require("node:fs"), path = require("node:path"), { pathToFileURL } = require("node:url");
  const srcDir = path.join(__dirname, "..", "src");
  const src = fs.readFileSync(path.join(srcDir, "worker.js"), "utf8").replace(/^export \{ RestAlerts \} from "\.\/alerts\.js";$/m, "");
  if (src.includes("alerts.js")) throw new Error("the RestAlerts re-export was not where this test expects it");
  const file = path.join(srcDir, `.worker-under-test-${process.pid}.js`);
  fs.writeFileSync(file, src);
  try { worker = (await import(pathToFileURL(file).href)).default } finally { fs.unlinkSync(file) }
  return worker;
}

function env({ html = "<!doctype html><html><head></head><body></body></html>", etag = 'W/"abc123def456xyz"' } = {}) {
  return {
    ASSETS: {
      async fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/" || u.pathname === "/index.html") {
          return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", etag } });
        }
        if (u.pathname === "/app.css") return new Response("body{}", { headers: { "content-type": "text/css" } });
        return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
      },
    },
  };
}

test("www redirects to the bare domain, permanently", async () => {
  const w = await load();
  const res = await w.fetch(new Request("https://www.operatorblack.com/setup?x=1"), env());
  a.equal(res.status, 301);
  a.equal(res.headers.get("location"), "https://operatorblack.com/setup?x=1");
});

test("the page carries a CSP, frame denial, nosniff, a referrer policy and its version", async () => {
  const w = await load();
  const res = await w.fetch(new Request("https://operatorblack.com/"), env());
  a.equal(res.status, 200);
  const csp = res.headers.get("content-security-policy");
  a.ok(csp, "there is a Content-Security-Policy");
  a.match(csp, /script-src 'self'(;|$)/, "scripts only from this origin, no inline, no eval");
  a.doesNotMatch(csp, /script-src[^;]*unsafe/, "no unsafe-* on scripts");
  a.match(csp, /frame-ancestors 'none'/);
  a.match(csp, /font-src [^;]*fonts\.gstatic\.com/, "Google Fonts still load");
  a.match(csp, /style-src [^;]*fonts\.googleapis\.com/);
  a.match(csp, /img-src [^;]*data:/, "the inlined touch icon");
  a.match(csp, /media-src [^;]*data:/, "the beep's WAV");
  a.equal(res.headers.get("x-frame-options"), "DENY");
  a.equal(res.headers.get("x-content-type-options"), "nosniff");
  a.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  const body = await res.text();
  a.match(body, /<meta name="app-version" content="abc123def456xyz">/, "the ETag becomes the page's version");
});

test("other static files get nosniff but no CSP, and keep their own type", async () => {
  const w = await load();
  const res = await w.fetch(new Request("https://operatorblack.com/app.css"), env());
  a.equal(res.status, 200);
  a.equal(res.headers.get("content-type"), "text/css");
  a.equal(res.headers.get("x-content-type-options"), "nosniff");
  a.equal(res.headers.get("content-security-policy"), null, "a stylesheet needs no page policy");
  a.equal(res.headers.get("x-frame-options"), null);
});

test("a missing file is still a 404 and not stamped", async () => {
  const w = await load();
  const res = await w.fetch(new Request("https://operatorblack.com/nope.txt"), env());
  a.equal(res.status, 404);
  a.equal(await res.text(), "not found");
});

test("no inline event handlers remain in the app, since the CSP would silently drop them", () => {
  const fs = require("node:fs"), path = require("node:path");
  const dir = path.join(__dirname, "..", "src", "app");
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const m = src.match(/\son[a-z]+="[^"]*"/);
    a.equal(m, null, `${f} has an inline handler: ${m && m[0]}`);
  }
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  a.equal(html.match(/\son[a-z]+="/), null, "index.html has an inline handler");
  a.equal(html.match(/<script>[^<]/), null, "index.html has an inline script");
});
