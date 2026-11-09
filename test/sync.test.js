// connect(): the page's read of /api/state on open and on every return from the
// background. The harness's fetch never resolves, so this file swaps in one that answers
// like the Worker, with ETags, and checks the page sends the tag back and does nothing
// with a 304 except carry on.
const { test } = require("node:test");
const a = require("node:assert");
const { loadApp } = require("./harness.js");

function server(x, initial) {
  const calls = [];
  let body = initial, tag = '"1-1-1-0"';
  const headers = (h) => ({ get: (k) => h[k.toLowerCase()] ?? null });
  global.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, headers: (init && init.headers) || {} });
    if (u === "/api/state") {
      const sent = calls[calls.length - 1].headers["if-none-match"];
      if (sent && sent === tag) return { type: "basic", ok: false, status: 304, headers: headers({ etag: tag }), json: async () => { throw new Error("no body") } };
      return { type: "basic", ok: true, status: 200, headers: headers({ etag: tag }), json: async () => JSON.parse(JSON.stringify(body)) };
    }
    // Anything else (alerts status, version): an empty answer is enough.
    return { type: "basic", ok: true, status: 200, headers: headers({}), json: async () => ({}) };
  };
  return { calls, set(next) { body = next; tag = '"' + Math.random().toString().slice(2, 8) + '"' }, states: () => calls.filter((c) => c.url === "/api/state") };
}

test("the first read is in full and the tag is kept; the next sends it and a 304 changes nothing", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: { "2026-10-01": { date: "2026-10-01", rpe: 7 } }, programs: {} });
  x.loaded = true;

  await x.connect();
  a.equal(srv.states().length, 1);
  a.equal(srv.states()[0].headers["if-none-match"], undefined, "nothing to compare against yet");
  a.equal(x.stateTag, '"1-1-1-0"', "the ETag is remembered");
  a.equal(x.logs["2026-10-01"].rpe, 7, "and the state applied");
  a.equal(x.plan.bar, 45);

  await x.connect();
  a.equal(srv.states().length, 2);
  a.equal(srv.states()[1].headers["if-none-match"], '"1-1-1-0"', "the tag goes back");
  a.equal(x.logs["2026-10-01"].rpe, 7, "a 304 leaves the state as it was");
  a.equal(x.stateTag, '"1-1-1-0"');
  a.equal(x.dom.made.status.textContent, "Saved", "and the page still settles on Saved");
});

test("a changed server answers in full, the new tag is kept, and the change lands", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: {}, programs: {} });
  x.loaded = true;
  await x.connect();
  const first = x.stateTag;

  srv.set({ user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: { "2026-10-02": { date: "2026-10-02", pullups: 9 } }, programs: {} });
  await x.connect();
  a.equal(srv.states()[1].headers["if-none-match"], first, "the old tag was offered");
  a.notEqual(x.stateTag, first, "and replaced");
  a.equal(x.logs["2026-10-02"].pullups, 9, "the new log arrived");
});

test("a different person signing in on this phone drops the tag with everything else", async () => {
  const x = loadApp();
  const srv = server(x, { user: "me@example.com", plan: { bar: 45, onboarded: true, schema: x.SCHEMA }, logs: {}, programs: {} });
  x.loaded = true;
  await x.connect();
  a.equal(x.me, "me@example.com");
  srv.set({ user: "other@example.com", plan: { bar: 20, onboarded: true, schema: x.SCHEMA }, logs: {}, programs: {} });
  await x.connect();
  a.equal(x.me, "other@example.com");
  a.equal(x.plan.bar, 20);
  a.ok(x.stateTag && x.stateTag !== '"1-1-1-0"', "the new person's tag, not the old one's");
});
