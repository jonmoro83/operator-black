-- Who did what, as an administrator. Deleting someone's training history is the most
-- destructive thing this app can do, so it leaves a record that is not itself deletable
-- through the app.
CREATE TABLE IF NOT EXISTS admin_log (
  at      INTEGER NOT NULL,
  actor   TEXT NOT NULL,
  action  TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS admin_log_at ON admin_log (at DESC);
