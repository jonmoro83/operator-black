-- Rebuild the chunk index with Porter stemming.
--
-- The default tokenizer matches whole words, so "how long should my recovery weeks be"
-- finds the passage but "am I recovering well enough" does not -- "recovering" and
-- "recovery" are unrelated strings to it. People ask questions in the second shape,
-- and the strict pass makes it worse: one unmatched word and the whole query drops to
-- the loose fallback. Porter folds both to "recoveri" and they meet.
--
-- The table has to be recreated to change its tokenizer, so the content is reloaded
-- from the local PDFs afterwards with tools/library.py.
DROP TABLE IF EXISTS lib_chunk;
CREATE VIRTUAL TABLE lib_chunk USING fts5(doc UNINDEXED, ref UNINDEXED, body, tokenize = 'porter');
DELETE FROM lib_doc;
