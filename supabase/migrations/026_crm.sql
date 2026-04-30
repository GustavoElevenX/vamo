-- ============ CRM ============

CREATE TABLE IF NOT EXISTS crm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  segment TEXT,
  website TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'prospecting',
  probability INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close DATE,
  lost_reason TEXT,
  notes TEXT,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  outcome TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_org ON crm_deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON crm_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON crm_deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_last_act ON crm_deals(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON crm_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_accounts_org ON crm_accounts(organization_id);

CREATE OR REPLACE FUNCTION update_deal_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crm_deals
  SET last_activity_at = NEW.occurred_at, updated_at = now()
  WHERE id = NEW.deal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_last_activity ON crm_activities;
CREATE TRIGGER trg_deal_last_activity
  AFTER INSERT ON crm_activities
  FOR EACH ROW EXECUTE FUNCTION update_deal_last_activity();

ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_accounts_org" ON crm_accounts;
CREATE POLICY "crm_accounts_org" ON crm_accounts
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "crm_deals_access" ON crm_deals;
CREATE POLICY "crm_deals_access" ON crm_deals
  FOR ALL USING (
    organization_id = get_user_org_id() AND
    (owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  )
  WITH CHECK (
    organization_id = get_user_org_id() AND
    (owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "crm_activities_access" ON crm_activities;
CREATE POLICY "crm_activities_access" ON crm_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = crm_activities.deal_id
        AND d.organization_id = get_user_org_id()
        AND (d.owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = crm_activities.deal_id
        AND d.organization_id = get_user_org_id()
        AND (d.owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
    )
  );
