-- A short written review of each finished week, made by the Monday cron rather than
-- asked for. One row per person per week: the key is what stops a retried cron from
-- paying for the same week twice.
CREATE TABLE IF NOT EXISTS coach_debrief (
  user        TEXT NOT NULL,
  week        TEXT NOT NULL,             -- the Monday of the week reviewed
  created_at  INTEGER NOT NULL,
  answer      TEXT NOT NULL,
  suggestions TEXT NOT NULL DEFAULT '[]',
  cites       TEXT NOT NULL DEFAULT '[]',
  model       TEXT NOT NULL DEFAULT '',
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  seen        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user, week)
);
