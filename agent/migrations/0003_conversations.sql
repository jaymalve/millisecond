-- One row per manual (chat) conversation with the investigator agent —
-- the D1-backed counterpart to watchdog_alerts, but for user-initiated,
-- multi-turn chats instead of one-shot autonomous investigations.
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_conversations_updated_at ON conversations (updated_at);

-- One row per turn (question + the agent's full response transcript for
-- that turn) within a conversation. items_json is the same
-- TranscriptItem[] shape watchdog_alerts.transcript_json uses, with a
-- leading {kind:"question"} item so replaying a conversation needs no
-- separate "who asked what" bookkeeping.
CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  items_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages (conversation_id, created_at);
