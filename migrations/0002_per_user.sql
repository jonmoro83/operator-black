-- Per-user data: every document belongs to the signed-in Access user (their email).
-- Existing single-user rows are parked under '__legacy__' until the owner's first
-- sign-in claims them (see claimLegacy in src/api.js).
CREATE TABLE docs_v2 (
  user       TEXT NOT NULL,
  path       TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user, path)
);
INSERT INTO docs_v2 (user, path, data, updated_at) SELECT '__legacy__', path, data, updated_at FROM docs;
DROP TABLE docs;
ALTER TABLE docs_v2 RENAME TO docs;
