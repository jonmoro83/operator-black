-- Why the model stopped. Without it an empty answer is indistinguishable from a
-- truncated one, and the first time it happened there was nothing to look at: the
-- card rendered its citations, which come from our own retrieval, above no text at all.
ALTER TABLE coach_log ADD COLUMN stop TEXT NOT NULL DEFAULT '';
