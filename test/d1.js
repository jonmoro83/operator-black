// A D1 stand-in over Node's built-in SQLite, with the real migrations applied. The
// older fake in api.test.js answers a fixed list to every query, which is enough to
// test a handler's logic but never runs the SQL. This does: the schema is the one in
// migrations/, the queries are the ones in src/, and FTS5 with the porter tokenizer is
// the same engine D1 uses. Nothing here is shipped.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATIONS = path.join(__dirname, "..", "migrations");

/** Apply every migrations/*.sql in name order. Returns the file names applied. */
function migrate(db, dir = MIGRATIONS) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  return files;
}

/** D1's surface as src/ uses it: prepare().bind().all()/first()/run()/raw(), batch(), exec(). */
function d1({ migrated = true } = {}) {
  const db = new DatabaseSync(":memory:");
  if (migrated) migrate(db);
  const statement = (sql, params) => ({
    bind: (...p) => statement(sql, p),
    async all() { return { results: db.prepare(sql).all(...params), success: true, meta: {} } },
    async first(col) {
      const row = db.prepare(sql).get(...params);
      if (row === undefined) return null;
      return col === undefined ? row : row[col];
    },
    async run() { const r = db.prepare(sql).run(...params); return { success: true, meta: { changes: r.changes } } },
    async raw() { return db.prepare(sql).all(...params).map((r) => Object.values(r)) },
  });
  return {
    db,
    prepare: (sql) => statement(sql, []),
    // D1 runs a batch as one transaction: all of it lands or none of it does.
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) { db.exec("ROLLBACK"); throw e }
    },
    async exec(sql) { db.exec(sql); return { count: 1, duration: 0 } },
    /** Convenience for assertions: rows of a query, synchronously. */
    rows: (sql, ...p) => db.prepare(sql).all(...p),
    tables: () => db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'lib_chunk_%' ORDER BY name").all().map((r) => r.name),
  };
}

module.exports = { d1, migrate };
