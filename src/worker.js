// Entry point: www redirects to the bare domain, /api/* goes to the API,
// everything else is a static file from public/. The weekly cron backs up every user.
import { handleApi, backupEveryone, calendarFeed, weeklyDebriefs, DEBRIEF_CRON } from "./api.js";
export { RestAlerts } from "./alerts.js";

const CANONICAL_HOST = "operatorblack.com";

export function pageVersion(etag) {
  return (etag || "").replace(/^W\//, "").replace(/"/g, "").slice(0, 16) || "dev";
}

// Defense in depth behind Access. The page renders the coach's model output and an
// administrator's catalog text through innerHTML (escaped, but a slip there should not
// become script), so scripts come only from this origin: no inline handlers, no eval.
// Inline *styles* stay allowed because the templates use style="" attributes throughout.
// data: covers the inlined touch icon and the beep's WAV; blob: the CSV download.
// Not exported: workerd takes every export of the entry module for a handler, and a
// string is not one. Exported, it stopped `wrangler dev` from starting at all.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function securityHeaders(res, html) {
  const h = new Headers(res.headers);
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  if (html) {
    h.set("content-security-policy", CSP);
    h.set("x-frame-options", "DENY");
  }
  return h;
}

// A cron's results as counts by outcome. No addresses: a log line is not the place.
export function tally(rows) {
  const out = { people: 0 };
  for (const r of rows || []) {
    out.people++;
    const k = r.skipped ? "skipped: " + r.skipped : r.ok === false ? "failed" : "done";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return handleApi(request, env);
    // The calendar feed is the one unauthenticated path: calendar apps cannot sign in, so
    // the token in the URL stands in for the login. It needs a matching Access bypass
    // policy for /cal/* in Zero Trust, or Access rejects it before the Worker is reached.
    const cal = url.pathname.match(/^\/cal\/([0-9a-f]{32})\.ics$/);
    if (cal) return calendarFeed(cal[1], env);
    const res = await env.ASSETS.fetch(request);
    // Stamp the page with its own fingerprint (the asset's ETag) so the app can tell
    // whether a newer page has been deployed since it loaded.
    const html = res.status === 200 && (res.headers.get("content-type") || "").includes("text/html");
    const out = new Response(res.body, { status: res.status, statusText: res.statusText, headers: securityHeaders(res, html) });
    if (html) {
      const ver = pageVersion(res.headers.get("etag"));
      return new HTMLRewriter()
        .on("head", { element(el) { el.append(`<meta name="app-version" content="${ver}">`, { html: true }); } })
        .transform(out);
    }
    return out;
  },

  async scheduled(event, env, ctx) {
    // Two crons: Sunday's backup, and Monday's debrief of the week that just ended.
    // What each run did goes to the log as counts, so a cron that quietly did nothing
    // can be told from one that never fired.
    const job = event.cron === DEBRIEF_CRON ? weeklyDebriefs(env) : backupEveryone(env);
    ctx.waitUntil(job.then(
      (r) => console.log("cron", event.cron, JSON.stringify(tally(r))),
      (e) => console.error("cron failed", event.cron, (e && e.stack) || String(e))
    ));
  },
};
