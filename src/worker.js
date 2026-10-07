// Entry point: www redirects to the bare domain, /api/* goes to the API,
// everything else is a static file from public/. The weekly cron backs up every user.
import { handleApi, backupEveryone, calendarFeed } from "./api.js";
export { RestAlerts } from "./alerts.js";

const CANONICAL_HOST = "operatorblack.com";

export function pageVersion(etag) {
  return (etag || "").replace(/^W\//, "").replace(/"/g, "").slice(0, 16) || "dev";
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
    if (res.status === 200 && (res.headers.get("content-type") || "").includes("text/html")) {
      const ver = pageVersion(res.headers.get("etag"));
      return new HTMLRewriter()
        .on("head", { element(el) { el.append(`<meta name="app-version" content="${ver}">`, { html: true }); } })
        .transform(res);
    }
    return res;
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(backupEveryone(env));
  },
};
