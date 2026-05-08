-- Estrutura rastreavel para planos de acao criados/assistidos pela VAMO IA.

CREATE TABLE IF NOT EXISTS manager_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'chat_ia',
  created_by_ai BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('draft', 'active', 'completed', 'paused', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS manager_action_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES manager_action_plans(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  related_mission_id UUID REFERENCES ai_missions(id) ON DELETE SET NULL,
  related_pdi_plan_id UUID REFERENCES pdi_plans(id) ON DELETE SET NULL,
  related_recommendation_id UUID REFERENCES action_recommendations(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CHECK (status IN ('pending', 'in_progress', 'done', 'blocked', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_manager_action_plans_org ON manager_action_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_manager_action_plans_manager ON manager_action_plans(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_action_plans_status ON manager_action_plans(status);
CREATE INDEX IF NOT EXISTS idx_manager_action_plan_items_plan ON manager_action_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_manager_action_plan_items_target ON manager_action_plan_items(target_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_action_plan_items_status ON manager_action_plan_items(status);

DROP TRIGGER IF EXISTS update_manager_action_plans_updated_at ON manager_action_plans;
CREATE TRIGGER update_manager_action_plans_updated_at
  BEFORE UPDATE ON manager_action_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_manager_action_plan_items_updated_at ON manager_action_plan_items;
CREATE TRIGGER update_manager_action_plan_items_updated_at
  BEFORE UPDATE ON manager_action_plan_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE manager_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_action_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_action_plans_access" ON manager_action_plans;
CREATE POLICY "manager_action_plans_access" ON manager_action_plans
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin', 'consultant')
  );

DROP POLICY IF EXISTS "manager_action_plans_insert" ON manager_action_plans;
CREATE POLICY "manager_action_plans_insert" ON manager_action_plans
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  );

DROP POLICY IF EXISTS "manager_action_plans_update" ON manager_action_plans;
CREATE POLICY "manager_action_plans_update" ON manager_action_plans
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  );

DROP POLICY IF EXISTS "manager_action_plan_items_access" ON manager_action_plan_items;
CREATE POLICY "manager_action_plan_items_access" ON manager_action_plan_items
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      target_user_id = get_user_id()
      OR get_user_role() IN ('manager', 'admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "manager_action_plan_items_insert" ON manager_action_plan_items;
CREATE POLICY "manager_action_plan_items_insert" ON manager_action_plan_items
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  );

DROP POLICY IF EXISTS "manager_action_plan_items_update" ON manager_action_plan_items;
CREATE POLICY "manager_action_plan_items_update" ON manager_action_plan_items
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  );
