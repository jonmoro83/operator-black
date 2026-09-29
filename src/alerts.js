// Rest alerts: one Durable Object holds your push subscriptions (one per device that
// enabled alerts) and at most one pending alert. Starting a rest schedules an alarm for
// the exact end time; skipping, ±30s or a new set reschedules or cancels it. When the
// alarm fires, every device gets a push notification.
import { DurableObject } from "cloudflare:workers";
import { sendPush } from "./webpush.js";

const MAX_AHEAD_MS = 60 * 60 * 1000;

export class RestAlerts extends DurableObject {
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const subs = (await this.ctx.storage.get("subs")) || {};

    if (op === "status") {
      const at = await this.ctx.storage.getAlarm();
      return json({ devices: Object.keys(subs).length, pendingAt: at });
    }

    if (op === "subscribe") {
      const s = body.subscription;
      const okEndpoint = s && typeof s.endpoint === "string" &&
        (s.endpoint.startsWith("https://") || (this.env.DEV_ALLOW_ANON === "1" && s.endpoint.startsWith("http://localhost")));
      if (!okEndpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: "Invalid subscription." }, 400);
      subs[s.endpoint] = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, added: Date.now() };
      await this.ctx.storage.put("subs", subs);
      return json({ devices: Object.keys(subs).length });
    }

    if (op === "unsubscribe") {
      delete subs[body.endpoint];
      await this.ctx.storage.put("subs", subs);
      return json({ devices: Object.keys(subs).length });
    }

    if (op === "schedule") {
      const at = Number(body.at);
      if (!Number.isFinite(at) || at < Date.now() - 5000 || at > Date.now() + MAX_AHEAD_MS) {
        return json({ error: "The alert time must be within the next hour." }, 400);
      }
      const title = String(body.title || "Rest done").slice(0, 80);
      const text = String(body.body || "").slice(0, 160);
      await this.ctx.storage.put("pending", { title, body: text });
      await this.ctx.storage.setAlarm(Math.max(at, Date.now() + 250));
      return json({ scheduledFor: at });
    }

    if (op === "cancel") {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.delete("pending");
      return json({ cancelled: true });
    }

    if (op === "test") {
      return json(await this.sendAll({ title: "Rest alerts are on", body: "This is how the end of a rest will look." }));
    }

    return json({ error: "Not found." }, 404);
  }

  async alarm() {
    const pending = await this.ctx.storage.get("pending");
    if (!pending) return;
    await this.ctx.storage.delete("pending");
    await this.sendAll(pending);
  }

  async sendAll(payload) {
    const subs = (await this.ctx.storage.get("subs")) || {};
    const results = [];
    let changed = false;
    for (const s of Object.values(subs)) {
      let status;
      try {
        status = await sendPush(s, JSON.stringify(payload), this.env);
      } catch (e) {
        status = "error";
      }
      results.push({ host: new URL(s.endpoint).host, status });
      if (status === 404 || status === 410) (delete subs[s.endpoint], (changed = true));
    }
    if (changed) await this.ctx.storage.put("subs", subs);
    return { devices: Object.keys(subs).length, results };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
