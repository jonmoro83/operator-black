-- One row per JSON document: 'plan/main' and 'logs/YYYY-MM-DD'.
CREATE TABLE IF NOT EXISTS docs (
  path       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
