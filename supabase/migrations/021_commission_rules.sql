-- ============ COMMISSION CONFIGS ============
CREATE TABLE IF NOT EXISTS commission_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  aliquota_base NUMERIC NOT NULL DEFAULT 4,
  acelerador_threshold NUMERIC NOT NULL DEFAULT 110,
  acelerador_rate NUMERIC NOT NULL DEFAULT 6,
  bonus_missao NUMERIC NOT NULL DEFAULT 75,
  salario_base NUMERIC NOT NULL DEFAULT 2500,
  periodo TEXT NOT NULL DEFAULT 'mensal' CHECK (periodo IN ('mensal', 'quinzenal', 'semanal')),
  elegibilidade NUMERIC NOT NULL DEFAULT 80,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_configs_org ON commission_configs(organization_id);

ALTER TABLE commission_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_config_org_read" ON commission_configs
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "commission_config_manager_manage" ON commission_configs
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ AUTOMATION RULES ============
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  action_type TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '[]',
  icon_key TEXT NOT NULL DEFAULT 'Settings2',
  icon_bg TEXT NOT NULL DEFAULT 'bg-muted',
  icon_color TEXT NOT NULL DEFAULT 'text-muted-foreground',
  active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_org_read" ON automation_rules
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "automation_rules_manager_manage" ON automation_rules
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );
