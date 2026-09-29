// Entry point: www redirects to the bare domain, /api/* goes to the API,
// everything else is a static file from public/. The weekly cron takes a backup.
import { handleApi, backupNow } from "./api.js";
export { RestAlerts } from "./alerts.js";

const CANONICAL_HOST = "operatorblack.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(backupNow(env, { manual: false }));
  },
};
