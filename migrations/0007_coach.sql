-- Every exchange with the coach, kept per user.
--
-- Three reasons, and the first is the one that matters: the coach gives advice about
-- training and the only way to judge whether it is any good is to look back at what it
-- said and what happened next. Second, it is how spending is counted -- the Worker caps
-- calls per calendar month off this table. Third, a thread needs its own history.
--
-- `cites` is JSON: which book passages the answer was built on, so a claim can be
-- checked against the page it came from.
CREATE TABLE IF NOT EXISTS coach_log (
  id         TEXT PRIMARY KEY,
  user       TEXT NOT NULL,
  asked_at   INTEGER NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL DEFAULT '',
  cites      TEXT NOT NULL DEFAULT '[]',
  model      TEXT NOT NULL DEFAULT '',
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  ok         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS coach_log_user_time ON coach_log (user, asked_at DESC);
