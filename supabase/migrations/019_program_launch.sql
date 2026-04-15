-- ============ PROGRAM LAUNCHES ============
-- Registro de lançamentos do programa de gamificação

CREATE TABLE IF NOT EXISTS program_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  launched_by UUID NOT NULL REFERENCES users(id),
  launch_message TEXT NOT NULL,
  team_member_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_launches_org ON program_launches(organization_id, created_at DESC);

ALTER TABLE program_launches ENABLE ROW LEVEL SECURITY;

-- Managers e admins da org podem ver
CREATE POLICY "program_launches_select" ON program_launches
  FOR SELECT USING (
    organization_id = get_user_org_id() OR get_user_role() = 'admin'
  );

-- Managers e admins podem inserir
CREATE POLICY "program_launches_insert" ON program_launches
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin')
  );
