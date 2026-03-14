-- Diagnostic Templates
CREATE TABLE IF NOT EXISTS diagnostic_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Diagnostic Questions
CREATE TABLE IF NOT EXISTS diagnostic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES diagnostic_templates(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('lead_generation', 'sales_process', 'team_management', 'tools_technology')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  order_index INTEGER NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_questions_template ON diagnostic_questions(template_id);

-- Diagnostic Sessions
CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES diagnostic_templates(id),
  conducted_by UUID NOT NULL REFERENCES users(id),
  respondent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  total_score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  health_pct NUMERIC NOT NULL DEFAULT 0,
  quadrant TEXT CHECK (quadrant IN ('critical', 'at_risk', 'developing', 'optimized')),
  area_scores JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_org ON diagnostic_sessions(organization_id);

-- Diagnostic Answers
CREATE TABLE IF NOT EXISTS diagnostic_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES diagnostic_questions(id),
  score NUMERIC NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_answers_session ON diagnostic_answers(session_id);
