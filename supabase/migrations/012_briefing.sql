-- ============================================================
-- 012: Briefing Semanal Automático (Módulo 2)
-- ============================================================

CREATE TABLE weekly_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES users(id),
  week_start date NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX weekly_briefings_org_week ON weekly_briefings(organization_id, week_start DESC);

-- RLS
ALTER TABLE weekly_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view org briefings"
  ON weekly_briefings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Managers can insert org briefings"
  ON weekly_briefings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
    )
  );
