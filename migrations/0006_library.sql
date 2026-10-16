-- The private library. Text extracted from books that live on disk, so the coach can
-- answer from what they actually say rather than from a model's recollection of them.
--
-- The content never enters the repository. These are commercial books; the repo is
-- public, and an exception is how two of them ended up in it once already. What is
-- committed is the extractor and the ingest script in tools/ -- the text goes straight
-- from a local PDF into D1, which sits behind Cloudflare Access.
--
-- Shared across users rather than per-user: it is reference material, not anyone's
-- training data, and the Access policy is what limits who can read it.
CREATE TABLE IF NOT EXISTS lib_doc (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  short      TEXT NOT NULL DEFAULT '',
  chunks     INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- FTS5, which D1 supports. `doc` and `ref` are carried but not indexed: a search is
-- over the prose, and the other two are there to attribute what comes back.
CREATE VIRTUAL TABLE IF NOT EXISTS lib_chunk USING fts5(doc UNINDEXED, ref UNINDEXED, body);
