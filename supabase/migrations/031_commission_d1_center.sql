-- ============ COMMISSION D-1 CENTER ============

ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS category_id TEXT,
  ADD COLUMN IF NOT EXISTS category_name TEXT,
  ADD COLUMN IF NOT EXISTS commercial_table_id TEXT,
  ADD COLUMN IF NOT EXISTS commercial_table_name TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE commission_periods
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS last_d1_update_at TIMESTAMPTZ;

UPDATE commission_periods
SET
  company_id = organization_id,
  name = COALESCE(name, label),
  start_date = COALESCE(start_date, date_trunc('month', opened_at)::date),
  end_date = COALESCE(end_date, (date_trunc('month', opened_at) + interval '1 month - 1 day')::date)
WHERE company_id IS NULL
   OR name IS NULL
   OR start_date IS NULL
   OR end_date IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commission_periods_status_check'
  ) THEN
    ALTER TABLE commission_periods DROP CONSTRAINT commission_periods_status_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commission_periods_status_d1_check'
  ) THEN
    ALTER TABLE commission_periods
      ADD CONSTRAINT commission_periods_status_d1_check
      CHECK (status IN ('open', 'calculating', 'pending_approval', 'approved', 'paid', 'in_review', 'closed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'seller',
    'product',
    'category',
    'commercial_table',
    'seller_product',
    'seller_commercial_table',
    'company_default'
  )),
  seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  product_id TEXT,
  category_id TEXT,
  commercial_table_id TEXT,
  percentage NUMERIC NOT NULL DEFAULT 0 CHECK (percentage >= 0),
  calculation_base TEXT NOT NULL DEFAULT 'sale_amount' CHECK (calculation_base IN ('sale_amount', 'received_amount')),
  priority INTEGER NOT NULL DEFAULT 99,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

UPDATE commission_rules SET company_id = organization_id WHERE company_id IS NULL;

CREATE TABLE IF NOT EXISTS commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  customer_name TEXT,
  product_id TEXT,
  product_name TEXT,
  category_id TEXT,
  category_name TEXT,
  commercial_table_id TEXT,
  commercial_table_name TEXT,
  commission_rule_id UUID REFERENCES commission_rules(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  period_reference TEXT NOT NULL,
  period_id UUID REFERENCES commission_periods(id) ON DELETE SET NULL,
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'confirmed',
    'pending',
    'disputed',
    'cancelled',
    'adjusted',
    'paid'
  )),
  status_reason TEXT,
  competence_date DATE NOT NULL,
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_reference, sale_id, status)
);

UPDATE commission_entries SET company_id = organization_id WHERE company_id IS NULL;

CREATE TABLE IF NOT EXISTS commission_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID,
  commission_entry_id UUID NOT NULL REFERENCES commission_entries(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'approved', 'rejected', 'corrected')),
  manager_response TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

UPDATE commission_disputes SET company_id = organization_id WHERE company_id IS NULL;

ALTER TABLE commission_audit_logs
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE commission_audit_logs
SET company_id = organization_id
WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_rules_org ON commission_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_seller ON commission_rules(seller_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_active_priority ON commission_rules(active, priority);
CREATE INDEX IF NOT EXISTS idx_commission_entries_org_period ON commission_entries(organization_id, period_reference);
CREATE INDEX IF NOT EXISTS idx_commission_entries_seller ON commission_entries(seller_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_status ON commission_entries(status);
CREATE INDEX IF NOT EXISTS idx_commission_entries_sale ON commission_entries(sale_id);
CREATE INDEX IF NOT EXISTS idx_commission_disputes_org_status ON commission_disputes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_disputes_seller ON commission_disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_commission_disputes_entry ON commission_disputes(commission_entry_id);

DROP TRIGGER IF EXISTS update_commission_rules_updated_at ON commission_rules;
CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_entries_updated_at ON commission_entries;
CREATE TRIGGER update_commission_entries_updated_at
  BEFORE UPDATE ON commission_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_disputes_updated_at ON commission_disputes;
CREATE TRIGGER update_commission_disputes_updated_at
  BEFORE UPDATE ON commission_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_rules_org_read" ON commission_rules;
CREATE POLICY "commission_rules_org_read" ON commission_rules
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "commission_rules_manager_manage" ON commission_rules;
CREATE POLICY "commission_rules_manager_manage" ON commission_rules
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_entries_access" ON commission_entries;
CREATE POLICY "commission_entries_access" ON commission_entries
  FOR SELECT USING (
    seller_id = get_user_id()
    OR (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin', 'consultant'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_entries_manager_manage" ON commission_entries;
CREATE POLICY "commission_entries_manager_manage" ON commission_entries
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_entries_seller_dispute" ON commission_entries;
CREATE POLICY "commission_entries_seller_dispute" ON commission_entries
  FOR UPDATE USING (seller_id = get_user_id())
  WITH CHECK (seller_id = get_user_id());

DROP POLICY IF EXISTS "commission_disputes_access" ON commission_disputes;
CREATE POLICY "commission_disputes_access" ON commission_disputes
  FOR SELECT USING (
    seller_id = get_user_id()
    OR (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin', 'consultant'))
    OR get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "commission_disputes_seller_insert" ON commission_disputes;
CREATE POLICY "commission_disputes_seller_insert" ON commission_disputes
  FOR INSERT WITH CHECK (
    seller_id = get_user_id()
    AND organization_id = get_user_org_id()
  );

DROP POLICY IF EXISTS "commission_disputes_manager_manage" ON commission_disputes;
CREATE POLICY "commission_disputes_manager_manage" ON commission_disputes
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );
