-- The shared accessory catalogue: exercises everyone sees, curated by an administrator.
-- A row with hidden = 1 and no name suppresses a built-in instead of adding anything.
-- Hiding is the normal way to retire a movement: it stops being offered, but anyone who
-- has already chosen it keeps it until they change it themselves.
CREATE TABLE IF NOT EXISTS acc_catalog (
  id         TEXT PRIMARY KEY,
  slot       TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  gear       TEXT NOT NULL DEFAULT '',
  hidden     INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
