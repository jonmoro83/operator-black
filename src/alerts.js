// Rest and interval alerts: one Durable Object holds your push subscriptions (one per
// device that enabled alerts) and a queue of pending alerts. A lifting rest queues one
// alert at its end time; an interval session queues one per interval change. Any new
// schedule replaces the queue; cancel clears it. The DO alarm fires at the next alert's
// time and pushes it to every device.
import { DurableObject } from "cloudflare:workers";
import { sendPush } from "./webpush.js";

const MAX_AHEAD_MS = 2 * 60 * 60 * 1000;
const MAX_QUEUE = 80;

export class RestAlerts extends DurableObject {
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const subs = (await this.ctx.storage.get("subs")) || {};

    if (op === "status") {
      const at = await this.ctx.storage.getAlarm();
      const queue = (await this.ctx.storage.get("queue")) || [];
      // `lastSend` is the only record of what the push service actually said. Without
      // it, a subscription Apple has rejected looks identical to one that works: the
      // phone still has its endpoint, the card still says On, and nothing arrives.
      const lastSend = (await this.ctx.storage.get("lastSend")) || null;
      const dead = (await this.ctx.storage.get("dead")) || [];
      return json({ devices: Object.keys(subs).length, pendingAt: at, queued: queue.length, lastSend, dead });
    }

    if (op === "subscribe") {
      const s = body.subscription;
      const okEndpoint = s && typeof s.endpoint === "string" &&
        (s.endpoint.startsWith("https://") || (this.env.DEV_ALLOW_ANON === "1" && s.endpoint.startsWith("http://localhost")));
      if (!okEndpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: "Invalid subscription." }, 400);
      subs[s.endpoint] = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, added: Date.now() };
      await this.ctx.storage.put("subs", subs);
      const dead = ((await this.ctx.storage.get("dead")) || []).filter((e) => e !== s.endpoint);
      await this.ctx.storage.put("dead", dead);
      return json({ devices: Object.keys(subs).length });
    }

    if (op === "unsubscribe") {
      delete subs[body.endpoint];
      await this.ctx.storage.put("subs", subs);
      return json({ devices: Object.keys(subs).length });
    }

    if (op === "schedule") {
      // {at, title, body} for one alert, or {alerts: [{at, title, body}, ...]}
      const list = Array.isArray(body.alerts) ? body.alerts : [body];
      if (!list.length || list.length > MAX_QUEUE) return json({ error: "Too many alerts." }, 400);
      const now = Date.now(), queue = [];
      for (const a of list) {
        const at = Number(a.at);
        if (!Number.isFinite(at) || at < now - 5000 || at > now + MAX_AHEAD_MS) {
          return json({ error: "Alert times must be within the next two hours." }, 400);
        }
        queue.push({ at, title: String(a.title || "Rest done").slice(0, 80), body: String(a.body || "").slice(0, 160) });
      }
      queue.sort((x, y) => x.at - y.at);
      await this.ctx.storage.put("queue", queue);
      await this.ctx.storage.setAlarm(Math.max(queue[0].at, now + 250));
      return json({ scheduled: queue.length, next: queue[0].at });
    }

    if (op === "cancel") {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.delete("queue");
      return json({ canceled: true });
    }

    // Everything this object holds, for a user being removed. Called only by the admin
    // route; there is no way to reach it as yourself, because there is no reason to.
    if (op === "wipe") {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return json({ wiped: true });
    }

    if (op === "test") {
      return json(await this.sendAll({ title: "Rest alerts are on", body: "This is how the end of a rest will look." }));
    }

    return json({ error: "Not found." }, 404);
  }

  async alarm() {
    const queue = (await this.ctx.storage.get("queue")) || [];
    const now = Date.now();
    const due = queue.filter((a) => a.at <= now + 500);
    const rest = queue.filter((a) => a.at > now + 500);
    // If several came due at once (a late alarm), only the newest is still worth showing.
    if (due.length) await this.sendAll({ title: due[due.length - 1].title, body: due[due.length - 1].body });
    if (rest.length) {
      await this.ctx.storage.put("queue", rest);
      await this.ctx.storage.setAlarm(rest[0].at);
    } else await this.ctx.storage.delete("queue");
  }

  /* The results of this were returned to the caller and, from `alarm()`, dropped on
     the floor -- which is the one place it matters, because that is every real alert.
     A 404 or 410 means the subscription is gone for good, and deleting it here while
     the phone keeps its endpoint in localStorage is how you get "alerts are on" and
     silence with no error anywhere. Both the results and the dead endpoints are kept
     now, so `/push/status` can say so and the app can re-subscribe properly. */
  async sendAll(payload) {
    const subs = (await this.ctx.storage.get("subs")) || {};
    const results = [];
    let changed = false;
    const dead = new Set((await this.ctx.storage.get("dead")) || []);
    for (const s of Object.values(subs)) {
      let status;
      try {
        status = await sendPush(s, JSON.stringify(payload), this.env);
      } catch (e) {
        status = "error:" + ((e && e.name) || "?");
      }
      results.push({ host: new URL(s.endpoint).host, status });
      if (status === 404 || status === 410) {
        delete subs[s.endpoint];
        dead.add(s.endpoint);
        changed = true;
      }
    }
    if (changed) await this.ctx.storage.put("subs", subs);
    await this.ctx.storage.put("lastSend", { at: Date.now(), title: payload.title, results });
    // Keep only the handful that matter; this is a diagnosis aid, not a ledger.
    if (changed) await this.ctx.storage.put("dead", [...dead].slice(-5));
    return { devices: Object.keys(subs).length, results };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
