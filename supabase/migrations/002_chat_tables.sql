-- Migration 002: Chat tables for conversational agent (Design Doc §13)
-- Required by lib/langchain/memory/supabaseHistory.ts

CREATE TABLE IF NOT EXISTS chat_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns sessions"
  ON chat_sessions
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX chat_sessions_user_id_idx ON chat_sessions (user_id);


CREATE TABLE IF NOT EXISTS chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role         text NOT NULL,          -- 'human' | 'ai' | 'tool'
  content      text,
  tool_name    text,                   -- populated when role = 'tool'
  tool_result  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS via session ownership join (consistent with the rest of the schema)
CREATE POLICY "user owns messages"
  ON chat_messages
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE INDEX chat_messages_session_id_idx ON chat_messages (session_id, created_at);
