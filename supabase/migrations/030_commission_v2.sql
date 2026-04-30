-- ============ COMMISSION V2 ============

ALTER TABLE commission_configs
  ADD COLUMN IF NOT EXISTS piso_comissao NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teto_comissao NUMERIC,
  ADD COLUMN IF NOT EXISTS bonus_kpi NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modelo TEXT NOT NULL DEFAULT 'fixo_mais_percentual',
  ADD COLUMN IF NOT EXISTS faixas JSONB NOT NULL DEFAULT '[{"ate":100,"aliquota":4},{"ate":110,"aliquota":5},{"acima":110,"aliquota":6}]',
  ADD COLUMN IF NOT EXISTS regras_kpi JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS acelerador_ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acelerador_multiplicador NUMERIC NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS dia_corte INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fechamento_automatico BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commission_configs_modelo_check'
  ) THEN
    ALTER TABLE commission_configs
      ADD CONSTRAINT commission_configs_modelo_check
      CHECK (modelo IN ('fixo_mais_percentual', 'apenas_percentual', 'apenas_fixo'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commission_configs_dia_corte_check'
  ) THEN
    ALTER TABLE commission_configs
      ADD CONSTRAINT commission_configs_dia_corte_check
      CHECK (dia_corte BETWEEN 1 AND 31);
  END IF;
END $$;

UPDATE commission_configs
SET
  faixas = jsonb_build_array(
    jsonb_build_object('ate', 100, 'aliquota', aliquota_base),
    jsonb_build_object('ate', acelerador_threshold, 'aliquota', acelerador_rate),
    jsonb_build_object('acima', acelerador_threshold, 'aliquota', acelerador_rate)
  )
WHERE faixas = '[]'::jsonb
   OR faixas IS NULL;

CREATE TABLE IF NOT EXISTS commission_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'calculating', 'pending_approval', 'approved', 'paid')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  total_payroll NUMERIC NOT NULL DEFAULT 0,
  total_bonus NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);

CREATE TABLE IF NOT EXISTS commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES commission_periods(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  sales_revenue NUMERIC NOT NULL DEFAULT 0,
  sales_commission NUMERIC NOT NULL DEFAULT 0,
  mission_bonus NUMERIC NOT NULL DEFAULT 0,
  kpi_bonus NUMERIC NOT NULL DEFAULT 0,
  accelerator_mult NUMERIC NOT NULL DEFAULT 1,
  total NUMERIC NOT NULL DEFAULT 0,
  goal_pct NUMERIC NOT NULL DEFAULT 0,
  missions_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'calculated', 'pending_approval', 'approved', 'paid', 'disputed')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, user_id)
);

CREATE TABLE IF NOT EXISTS commission_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id UUID NOT NULL REFERENCES commission_calculations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('venda', 'missao', 'kpi', 'acelerador', 'ajuste')),
  descricao TEXT NOT NULL,
  referencia_id UUID,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_referencia DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id UUID REFERENCES commission_periods(id) ON DELETE SET NULL,
  calculation_id UUID REFERENCES commission_calculations(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_periods_org ON commission_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_periods_status ON commission_periods(status);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_period ON commission_calculations(period_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_org_user ON commission_calculations(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_status ON commission_calculations(status);
CREATE INDEX IF NOT EXISTS idx_commission_line_items_calc ON commission_line_items(calculation_id);
CREATE INDEX IF NOT EXISTS idx_commission_line_items_user ON commission_line_items(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_audit_logs_org ON commission_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_audit_logs_period ON commission_audit_logs(period_id);

DROP TRIGGER IF EXISTS update_commission_configs_updated_at ON commission_configs;
CREATE TRIGGER update_commission_configs_updated_at
  BEFORE UPDATE ON commission_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_periods_updated_at ON commission_periods;
CREATE TRIGGER update_commission_periods_updated_at
  BEFORE UPDATE ON commission_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_calculations_updated_at ON commission_calculations;
CREATE TRIGGER update_commission_calculations_updated_at
  BEFORE UPDATE ON commission_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE commission_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_periods_org_read" ON commission_periods;
CREATE POLICY "commission_periods_org_read" ON commission_periods
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "commission_periods_manager_manage" ON commission_periods;
CREATE POLICY "commission_periods_manager_manage" ON commission_periods
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_calculations_access" ON commission_calculations;
CREATE POLICY "commission_calculations_access" ON commission_calculations
  FOR SELECT USING (
    user_id = get_user_id()
    OR (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin', 'consultant'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_calculations_manager_manage" ON commission_calculations;
CREATE POLICY "commission_calculations_manager_manage" ON commission_calculations
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_line_items_access" ON commission_line_items;
CREATE POLICY "commission_line_items_access" ON commission_line_items
  FOR SELECT USING (
    user_id = get_user_id()
    OR EXISTS (
      SELECT 1 FROM commission_calculations c
      WHERE c.id = commission_line_items.calculation_id
        AND c.organization_id = get_user_org_id()
        AND get_user_role() IN ('manager', 'admin', 'consultant')
    )
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_line_items_manager_manage" ON commission_line_items;
CREATE POLICY "commission_line_items_manager_manage" ON commission_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM commission_calculations c
      WHERE c.id = commission_line_items.calculation_id
        AND c.organization_id = get_user_org_id()
        AND get_user_role() IN ('manager', 'admin')
    )
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commission_calculations c
      WHERE c.id = commission_line_items.calculation_id
        AND c.organization_id = get_user_org_id()
        AND get_user_role() IN ('manager', 'admin')
    )
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_audit_logs_manager_read" ON commission_audit_logs;
CREATE POLICY "commission_audit_logs_manager_read" ON commission_audit_logs
  FOR SELECT USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin', 'consultant'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_audit_logs_manager_insert" ON commission_audit_logs;
CREATE POLICY "commission_audit_logs_manager_insert" ON commission_audit_logs
  FOR INSERT WITH CHECK (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );
