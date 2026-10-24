-- Diagnostics the app sends when something is wrong, so a bug report does not depend
-- on getting text off a phone. Two attempts at a copy button both produced nothing
-- the person could send, which is a poor channel for the one thing that unblocks a
-- fix. The app posts here instead and the developer reads it with wrangler.
CREATE TABLE IF NOT EXISTS reports (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user     TEXT NOT NULL,
  at       INTEGER NOT NULL,
  kind     TEXT NOT NULL,
  version  TEXT,
  ua       TEXT,
  body     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_at ON reports (at DESC);
