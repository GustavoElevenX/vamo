-- ============================================================
-- 013: Retrospectiva Mensal Automática (Módulo 7)
-- ============================================================

CREATE TABLE monthly_retrospectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX monthly_retrospectives_org ON monthly_retrospectives(organization_id, cycle_end DESC);

-- RLS
ALTER TABLE monthly_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view org retrospectives"
  ON monthly_retrospectives FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Managers can insert org retrospectives"
  ON monthly_retrospectives FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
    )
  );
