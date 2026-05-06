-- ============ NOTIFICATIONS ============
-- Mensagens enviadas pelo gestor para vendedores via Vamo IA

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Vendedor vê apenas suas próprias notificações
CREATE POLICY "notifications_user_read" ON notifications
  FOR SELECT USING (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'));

-- Gestores e admins podem inserir
CREATE POLICY "notifications_manager_insert" ON notifications
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

-- Apenas o destinatário pode marcar como lida
CREATE POLICY "notifications_user_update" ON notifications
  FOR UPDATE USING (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'));
