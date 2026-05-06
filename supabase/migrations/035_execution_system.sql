-- Sistema de Execucao Comercial
-- Centraliza KPI, missoes e XP por eventos reais da plataforma.

ALTER TABLE kpi_definitions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_event TEXT,
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS target_daily NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_weekly NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_monthly NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_type TEXT NOT NULL DEFAULT 'sum',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alert_tolerance NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE kpi_definitions
SET
  source = COALESCE(NULLIF(targets->>'source', ''), source, 'manual'),
  source_event = COALESCE(NULLIF(targets->>'source_event', ''), source_event),
  target_daily = COALESCE(NULLIF(targets->>'daily', '')::NUMERIC, target_daily, 0),
  target_weekly = COALESCE(NULLIF(targets->>'weekly', '')::NUMERIC, target_weekly, 0),
  target_monthly = COALESCE(NULLIF(targets->>'monthly', '')::NUMERIC, target_monthly, 0),
  alert_tolerance = COALESCE(NULLIF(targets->>'alert_tolerance', '')::NUMERIC, alert_tolerance, 10)
WHERE targets IS NOT NULL;

ALTER TABLE kpi_definitions
  ADD CONSTRAINT kpi_definitions_source_check
  CHECK (source IN ('manual', 'crm', 'CRM', 'pdi', 'commission', 'system'));

ALTER TABLE kpi_definitions
  ADD CONSTRAINT kpi_definitions_period_check
  CHECK (period IN ('daily', 'weekly', 'monthly'));

ALTER TABLE kpi_definitions
  ADD CONSTRAINT kpi_definitions_calculation_type_check
  CHECK (calculation_type IN ('sum', 'count', 'average', 'max', 'min'));

ALTER TABLE kpi_entries
  ADD COLUMN IF NOT EXISTS source_event TEXT,
  ADD COLUMN IF NOT EXISTS source_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS source_entity_id UUID,
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES ai_missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE ai_missions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS kpi_id UUID REFERENCES kpi_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_missions_status_check'
      AND conrelid = 'ai_missions'::regclass
  ) THEN
    ALTER TABLE ai_missions DROP CONSTRAINT ai_missions_status_check;
  END IF;
END $$;

ALTER TABLE ai_missions
  ADD CONSTRAINT ai_missions_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled', 'awaiting_approval', 'rejected', 'skipped'));

ALTER TABLE ai_missions
  ADD CONSTRAINT ai_missions_verification_type_check
  CHECK (verification_type IN ('automatic', 'manual', 'hybrid'));

ALTER TABLE ai_missions
  ADD CONSTRAINT ai_missions_type_check
  CHECK (type IN ('activity', 'kpi_target', 'pipeline_cleanup', 'revenue_target', 'manual_validation', 'pdi', 'recognition'));

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_source_event ON kpi_definitions(organization_id, source_event) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_kpi_entries_source_event ON kpi_entries(organization_id, source_event, recorded_at);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_source_entity ON kpi_entries(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_mission ON kpi_entries(mission_id);
CREATE INDEX IF NOT EXISTS idx_ai_missions_status_deadline ON ai_missions(organization_id, status, deadline);
CREATE INDEX IF NOT EXISTS idx_ai_missions_kpi ON ai_missions(organization_id, kpi_id);
