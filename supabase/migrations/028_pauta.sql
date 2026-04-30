CREATE TABLE IF NOT EXISTS pauta_reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content JSONB NOT NULL,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, week_start)
);

ALTER TABLE pauta_reunioes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pauta_manager" ON pauta_reunioes;
CREATE POLICY "pauta_manager" ON pauta_reunioes
  FOR ALL USING (
    organization_id = get_user_org_id() AND
    get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_org_id() AND
    get_user_role() IN ('manager', 'admin')
  );
