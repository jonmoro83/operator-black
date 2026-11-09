// Stand-ins for the Worker's KV and R2 bindings, written against the real surfaces
// rather than a convenient subset. Shared by api.test.js and db.test.js.

function fakeKV() {
  const m = new Map();
  return {
    m,
    async put(key, body, opts) { m.set(key, { body, metadata: (opts || {}).metadata || {} }) },
    async get(key) { return m.has(key) ? m.get(key).body : null },
    async delete(key) { m.delete(key) },
    async list({ prefix, cursor }) {
      // Paginate at 2 so the cursor loop is actually exercised, not just the first page.
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? keys.indexOf(cursor) + 1 : 0;
      const page = keys.slice(from, from + 2);
      const done = from + 2 >= keys.length;
      return {
        keys: page.map((name) => ({ name, metadata: m.get(name).metadata })),
        list_complete: done,
        cursor: done ? undefined : page[page.length - 1],
      };
    },
  };
}

function fakeR2() {
  const m = new Map();
  return {
    m,
    async put(key, body, opts) {
      m.set(key, { body, size: body.length, uploaded: new Date("2026-10-07T09:00:00Z"), customMetadata: (opts || {}).customMetadata || {} });
    },
    async get(key) { const o = m.get(key); return o ? { text: async () => o.body } : null },
    async delete(key) { m.delete(key) },
    async list({ prefix, cursor }) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? keys.indexOf(cursor) + 1 : 0;
      const page = keys.slice(from, from + 2);
      const truncated = from + 2 < keys.length;
      return {
        objects: page.map((key) => ({ key, ...m.get(key) })),
        truncated,
        cursor: truncated ? page[page.length - 1] : undefined,
      };
    },
  };
}

module.exports = { fakeKV, fakeR2 };
