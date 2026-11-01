// Rest and interval alerts. One Durable Object per person holds their push
// subscriptions (one per device that turned alerts on) and their pending alerts.
//
// Pending alerts live in slots: one per timer per device -- the rest timer on the
// phone, the interval timer on the phone, the generic timer, a test. A write replaces
// one slot's whole list and carries the client's revision number, and a write older
// than what the slot already holds is ignored.
//
// It used to be one queue per person that every schedule replaced and every cancel
// emptied. Three timers shared it, so a rest starting wiped the generic timer's alert,
// and starting intervals out of a running rest sent a cancel and a schedule as two
// requests -- if the cancel arrived second, every interval alert was erased. Slots
// with revisions make that impossible rather than unlikely.
import { DurableObject } from "cloudflare:workers";
import { sendPush } from "./webpush.js";

const MAX_AHEAD_MS = 2 * 60 * 60 * 1000;
const MAX_QUEUE = 80;
const LOG_KEEP = 30;
const KIND = /^[a-z]{1,12}$/;
const LEGACY = "legacy";

export class RestAlerts extends DurableObject {
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const subs = (await this.ctx.storage.get("subs")) || {};

    if (op === "status") {
      const slots = await this.slots();
      const at = await this.ctx.storage.getAlarm();
      // `lastSend` is the only record of what the push service actually said. Without
      // it, a subscription Apple has rejected looks identical to one that works.
      const lastSend = (await this.ctx.storage.get("lastSend")) || null;
      const dead = (await this.ctx.storage.get("dead")) || [];
      const log = (await this.ctx.storage.get("log")) || [];
      const live = Object.values(slots).filter((s) => s.alerts.length);
      return json({
        devices: Object.keys(subs).length, pendingAt: at,
        queued: live.reduce((n, s) => n + s.alerts.length, 0),
        slots: live.map((s) => ({ kind: s.kind, n: s.alerts.length, next: s.alerts[0].at, to: s.to ? host(s.to) : "all" })),
        lastSend, dead, log,
      });
    }

    if (op === "subscribe") {
      const s = body.subscription;
      if (!this.okEndpoint(s && s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: "Invalid subscription." }, 400);
      subs[s.endpoint] = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, added: Date.now() };
      await this.ctx.storage.put("subs", subs);
      const dead = ((await this.ctx.storage.get("dead")) || []).filter((e) => e !== s.endpoint);
      await this.ctx.storage.put("dead", dead);
      return json({ devices: Object.keys(subs).length });
    }

    if (op === "unsubscribe") {
      delete subs[body.endpoint];
      await this.ctx.storage.put("subs", subs);
      // A device that turned alerts off takes its pending alerts with it.
      const slots = await this.slots();
      for (const [k, s] of Object.entries(slots)) if (s.to && s.to === body.endpoint) delete slots[k];
      await this.saveSlots(slots);
      return json({ devices: Object.keys(subs).length });
    }

    if (op === "set") {
      // {kind, rev, alerts: [{at, title, body}], endpoint}. An empty list is a cancel.
      const kind = String(body.kind || ""), rev = Number(body.rev), list = body.alerts;
      if (!KIND.test(kind) || kind === LEGACY) return json({ error: "Unknown alert kind." }, 400);
      if (!Number.isFinite(rev)) return json({ error: "A revision is required." }, 400);
      if (!Array.isArray(list) || list.length > MAX_QUEUE) return json({ error: "Too many alerts." }, 400);
      const to = body.endpoint == null || body.endpoint === "" ? null : String(body.endpoint);
      if (to && !this.okEndpoint(to)) return json({ error: "Invalid endpoint." }, 400);
      const alerts = this.validate(list);
      if (!alerts) return json({ error: "Alert times must be within the next two hours." }, 400);
      const slots = await this.slots(), key = kind + "|" + (to || "*"), cur = slots[key];
      // Older than what is here: a request that lost a race on the way in. Applying it
      // would undo something newer, which is the whole bug this design is for.
      if (cur && cur.rev > rev) return json({ applied: false, stale: true, rev: cur.rev, next: cur.alerts.length ? cur.alerts[0].at : null });
      // An empty slot is kept, not deleted: its revision is what stops a late,
      // older schedule from bringing a cancelled alert back.
      slots[key] = { kind, to, rev, alerts };
      const next = await this.saveSlots(slots);
      return json({ applied: true, kind, rev, scheduled: alerts.length, next: alerts.length ? alerts[0].at : null, pendingAt: next });
    }

    // What clients before the slots called. Kept so a phone still running a cached copy
    // of the old app keeps its alerts through the switchover. No revision to protect
    // it, which is exactly how it always behaved.
    if (op === "schedule") {
      const list = Array.isArray(body.alerts) ? body.alerts : [body];
      if (!list.length || list.length > MAX_QUEUE) return json({ error: "Too many alerts." }, 400);
      const alerts = this.validate(list);
      if (!alerts) return json({ error: "Alert times must be within the next two hours." }, 400);
      const slots = await this.slots();
      slots[LEGACY + "|*"] = { kind: LEGACY, to: null, rev: Date.now(), alerts };
      await this.saveSlots(slots);
      return json({ scheduled: alerts.length, next: alerts[0].at });
    }
    if (op === "cancel") {
      const slots = await this.slots();
      delete slots[LEGACY + "|*"];
      await this.saveSlots(slots);
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
      return json(await this.send({ title: "Rest alerts are on", body: "This is how the end of a rest will look." }, null, "test"));
    }

    return json({ error: "Not found." }, 404);
  }

  okEndpoint(e) {
    return typeof e === "string" &&
      (e.startsWith("https://") || (this.env.DEV_ALLOW_ANON === "1" && e.startsWith("http://localhost")));
  }

  // Every alert in a list inside the window, or null for the whole list: a schedule is
  // refused whole rather than half-stored.
  validate(list) {
    const now = Date.now(), out = [];
    for (const a of list) {
      const at = Number(a && a.at);
      if (!Number.isFinite(at) || at < now - 5000 || at > now + MAX_AHEAD_MS) return null;
      out.push({ at, title: String(a.title || "Rest done").slice(0, 80), body: String(a.body || "").slice(0, 160) });
    }
    return out.sort((x, y) => x.at - y.at);
  }

  async slots() {
    const slots = (await this.ctx.storage.get("slots")) || {};
    // The single queue from before the slots, if one was pending at the deploy.
    const old = await this.ctx.storage.get("queue");
    if (Array.isArray(old)) {
      if (old.length && !slots[LEGACY + "|*"]) slots[LEGACY + "|*"] = { kind: LEGACY, to: null, rev: 0, alerts: old };
      await this.ctx.storage.delete("queue");
      await this.ctx.storage.put("slots", slots);
    }
    return slots;
  }

  // Store the slots and point the alarm at the earliest alert in any of them.
  async saveSlots(slots) {
    await this.ctx.storage.put("slots", slots);
    let next = null;
    for (const s of Object.values(slots)) if (s.alerts.length && (next == null || s.alerts[0].at < next)) next = s.alerts[0].at;
    if (next == null) { await this.ctx.storage.deleteAlarm(); return null }
    const at = Math.max(next, Date.now() + 250);
    await this.ctx.storage.setAlarm(at);
    return at;
  }

  async alarm() {
    const slots = await this.slots(), now = Date.now();
    for (const s of Object.values(slots)) {
      const due = s.alerts.filter((a) => a.at <= now + 500);
      if (!due.length) continue;
      s.alerts = s.alerts.filter((a) => a.at > now + 500);
      // If several came due at once (a late alarm), only the newest is still worth showing.
      const a = due[due.length - 1];
      await this.send({ title: a.title, body: a.body }, s.to, s.kind, a.at, due.length - 1);
    }
    await this.saveSlots(slots);
  }

  /* One alert, to the device that set it -- or to every device for a slot with no
     device, or one whose device has gone from the list, so an alert is never lost to
     bookkeeping. The push service's answer is kept per device: a 404 or 410 means the
     subscription is gone for good, and deleting it here while the phone keeps its
     endpoint is how you get "alerts are on" and silence with no error anywhere. And
     every send goes in a short log with how late it went out, which is the one
     number that says whether alerts arrive on time. */
  async send(payload, to, kind, due, skipped) {
    const subs = (await this.ctx.storage.get("subs")) || {};
    const targeted = to && subs[to];
    const targets = targeted ? [subs[to]] : Object.values(subs);
    const dead = new Set((await this.ctx.storage.get("dead")) || []);
    const results = [], sentAt = Date.now();
    let changed = false;
    for (const s of targets) {
      let status;
      try {
        status = await sendPush(s, JSON.stringify(payload), this.env, { topic: kind || "rest" });
      } catch (e) {
        status = "error:" + ((e && e.name) || "?");
      }
      results.push({ host: host(s.endpoint), status });
      if (status === 404 || status === 410) {
        delete subs[s.endpoint];
        dead.add(s.endpoint);
        changed = true;
      }
    }
    if (changed) {
      await this.ctx.storage.put("subs", subs);
      await this.ctx.storage.put("dead", [...dead].slice(-5));
    }
    await this.ctx.storage.put("lastSend", { at: sentAt, title: payload.title, results });
    const log = (await this.ctx.storage.get("log")) || [];
    log.push({ kind: kind || "", title: payload.title, due: due || sentAt, sent: sentAt,
      late: due ? sentAt - due : 0, skipped: skipped || 0,
      to: targeted ? "device" : to ? "all (device not registered)" : "all", results });
    await this.ctx.storage.put("log", log.slice(-LOG_KEEP));
    return { devices: Object.keys(subs).length, results };
  }
}

function host(endpoint) {
  try { return new URL(endpoint).host } catch { return "?" }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
