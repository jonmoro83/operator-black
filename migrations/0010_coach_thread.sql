-- Conversations rather than one-shot questions. A thread id groups the turns that
-- belong together; starting a new topic mints a new one. Old rows have none and read
-- as a single historical thread, which is what they were.
ALTER TABLE coach_log ADD COLUMN thread TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS coach_log_thread ON coach_log (user, thread, asked_at);
