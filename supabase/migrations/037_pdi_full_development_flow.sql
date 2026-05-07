-- Refatoracao PDI: gaps comerciais reais, treinamento aplicado, aprovacao e validacao.

ALTER TABLE pdi_gaps
  ADD COLUMN IF NOT EXISTS impact_value NUMERIC,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE pdi_gaps DROP CONSTRAINT IF EXISTS pdi_gaps_status_check;
ALTER TABLE pdi_gaps
  ADD CONSTRAINT pdi_gaps_status_check
  CHECK (status IN ('open', 'dismissed', 'in_pdi', 'in_training', 'improving', 'resolved'));

ALTER TABLE pdi_plans DROP CONSTRAINT IF EXISTS pdi_plans_status_check;
ALTER TABLE pdi_plans
  ADD CONSTRAINT pdi_plans_status_check
  CHECK (status IN ('recommended', 'pending_approval', 'approved', 'active', 'completed', 'paused', 'rejected', 'cancelled'));

UPDATE pdi_plans
SET status = 'pending_approval'
WHERE status = 'recommended';

ALTER TABLE training_modules
  ADD COLUMN IF NOT EXISTS gap_id UUID REFERENCES pdi_gaps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdi_plan_id UUID REFERENCES pdi_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS script JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS roleplay_prompt TEXT,
  ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pdi_plan_items
  ADD COLUMN IF NOT EXISTS order_index INT,
  ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE pdi_plan_items DROP CONSTRAINT IF EXISTS pdi_plan_items_item_type_check;
ALTER TABLE pdi_plan_items
  ADD CONSTRAINT pdi_plan_items_item_type_check
  CHECK (item_type IN (
    'training',
    'lesson',
    'checklist',
    'roleplay',
    'deal_application',
    'real_case_application',
    'follow_up_application',
    'proposal_application',
    'simulation',
    'manager_review',
    'manager_feedback'
  ));

ALTER TABLE pdi_applications DROP CONSTRAINT IF EXISTS pdi_applications_status_check;
ALTER TABLE pdi_applications
  ADD CONSTRAINT pdi_applications_status_check
  CHECK (status IN ('submitted', 'approved', 'validated', 'needs_revision', 'needs_adjustment', 'rejected'));

ALTER TABLE ai_missions
  ADD COLUMN IF NOT EXISTS pdi_plan_id UUID REFERENCES pdi_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gap_id UUID REFERENCES pdi_gaps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pdi_gaps_org_skill_source_status
  ON pdi_gaps(organization_id, user_id, skill_area, detected_from, status);

CREATE INDEX IF NOT EXISTS idx_pdi_gaps_impact
  ON pdi_gaps(organization_id, severity, impact_value DESC);

CREATE INDEX IF NOT EXISTS idx_training_modules_pdi_plan
  ON training_modules(pdi_plan_id);

CREATE INDEX IF NOT EXISTS idx_training_modules_gap
  ON training_modules(gap_id);

CREATE INDEX IF NOT EXISTS idx_ai_missions_pdi
  ON ai_missions(pdi_plan_id, gap_id);

CREATE OR REPLACE VIEW pdi_manager_development_overview
WITH (security_invoker = true) AS
SELECT
  g.organization_id,
  g.user_id,
  COUNT(*) FILTER (WHERE g.status IN ('open', 'in_training') AND g.severity IN ('high', 'critical')) AS critical_gaps,
  COALESCE(SUM(g.impact_value) FILTER (WHERE g.status IN ('open', 'in_training')), 0) AS estimated_impact,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status IN ('recommended', 'pending_approval')) AS plans_to_approve,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status IN ('approved', 'active')) AS active_plans,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'submitted') AS applications_to_validate,
  AVG(e.delta_value) AS avg_delta
FROM pdi_gaps g
LEFT JOIN pdi_plans p ON p.gap_id = g.id
LEFT JOIN pdi_applications a ON a.plan_id = p.id
LEFT JOIN pdi_evolution_evidence e ON e.plan_id = p.id
GROUP BY g.organization_id, g.user_id;
