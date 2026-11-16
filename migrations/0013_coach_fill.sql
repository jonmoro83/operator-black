-- The program chooser filled in from a goal in the person's own words (3.100). Kept
-- apart from coach_log so it is not replayed as part of the conversation, and counted
-- against the same monthly cap.
CREATE TABLE IF NOT EXISTS coach_fill (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  at          INTEGER NOT NULL,
  aim         TEXT NOT NULL,
  result      TEXT NOT NULL DEFAULT '{}',
  model       TEXT NOT NULL DEFAULT '',
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  ok          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS coach_fill_user_at ON coach_fill (user, at);
