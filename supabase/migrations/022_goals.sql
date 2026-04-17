-- ============ PROGRAM GOALS ============
-- Armazena metas da empresa, do time e individuais por organização
CREATE TABLE IF NOT EXISTS program_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_goal JSONB NOT NULL DEFAULT '{}',
  team_goal JSONB NOT NULL DEFAULT '{}',
  individual_goals JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_program_goals_org ON program_goals(organization_id);

ALTER TABLE program_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_goals_org_read" ON program_goals
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "program_goals_manager_manage" ON program_goals
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );
