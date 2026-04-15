-- ============ CHAT (Gestor ↔ Vendedores) ============
-- Chat entre gestor e vendedores, com suporte a conversas 1:1 e em grupo.
-- Distinto de `notifications` (one-way): aqui é bidirecional.

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT, -- rótulo opcional (usado em grupos)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_org ON chat_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_msg ON chat_conversations(last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conv ON chat_participants(conversation_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org ON chat_messages(organization_id);

-- Trigger: atualiza last_message_at ao inserir mensagem
CREATE OR REPLACE FUNCTION update_chat_conversation_last_msg()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_msg_last ON chat_messages;
CREATE TRIGGER trg_chat_msg_last
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_conversation_last_msg();

-- ============ RLS ============
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversas: usuário vê conversas da sua organização onde é participante
-- (gestores/admins veem todas da sua org)
CREATE POLICY "chat_conv_select" ON chat_conversations
  FOR SELECT USING (
    organization_id = get_user_org_id() AND (
      get_user_role() IN ('manager', 'admin') OR
      EXISTS (
        SELECT 1 FROM chat_participants p
        WHERE p.conversation_id = chat_conversations.id
          AND p.user_id = get_user_id()
      )
    )
  );

CREATE POLICY "chat_conv_insert" ON chat_conversations
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "chat_conv_update" ON chat_conversations
  FOR UPDATE USING (
    organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin')
  );

-- Participantes: visíveis aos demais participantes da mesma conversa
CREATE POLICY "chat_participants_select" ON chat_participants
  FOR SELECT USING (
    get_user_role() IN ('manager', 'admin') OR
    user_id = get_user_id() OR
    EXISTS (
      SELECT 1 FROM chat_participants p2
      WHERE p2.conversation_id = chat_participants.conversation_id
        AND p2.user_id = get_user_id()
    )
  );

CREATE POLICY "chat_participants_insert" ON chat_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = conversation_id AND c.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "chat_participants_update" ON chat_participants
  FOR UPDATE USING (
    user_id = get_user_id() OR get_user_role() IN ('manager', 'admin')
  );

-- Mensagens: usuário vê mensagens de conversas onde participa
CREATE POLICY "chat_msg_select" ON chat_messages
  FOR SELECT USING (
    organization_id = get_user_org_id() AND (
      get_user_role() IN ('manager', 'admin') OR
      EXISTS (
        SELECT 1 FROM chat_participants p
        WHERE p.conversation_id = chat_messages.conversation_id
          AND p.user_id = get_user_id()
      )
    )
  );

CREATE POLICY "chat_msg_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = get_user_id() AND organization_id = get_user_org_id()
  );
