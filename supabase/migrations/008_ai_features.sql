-- AI Analyses (cached AI diagnostic reports)
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  analysis_type TEXT NOT NULL DEFAULT 'diagnostic' CHECK (analysis_type IN ('diagnostic', 'behavioral')),
  result JSONB NOT NULL DEFAULT '{}',
  model_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_session ON ai_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_org ON ai_analyses(organization_id);

-- Behavioral Profiles (DISC simplified)
CREATE TABLE IF NOT EXISTS behavioral_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]',
  profile_result JSONB NOT NULL DEFAULT '{}',
  model_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_behavioral_profiles_user ON behavioral_profiles(user_id);

-- AI Missions (generated gamified missions)
CREATE TABLE IF NOT EXISTS ai_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES diagnostic_sessions(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('lead_generation', 'sales_process', 'team_management', 'tools_technology')),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  xp_reward INTEGER NOT NULL DEFAULT 50,
  criteria JSONB NOT NULL DEFAULT '{}',
  resources JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_missions_user ON ai_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_missions_org ON ai_missions(organization_id);

-- RLS Policies for AI tables
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_missions ENABLE ROW LEVEL SECURITY;

-- ai_analyses: users can read their own org's analyses
CREATE POLICY "ai_analyses_select" ON ai_analyses FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "ai_analyses_insert" ON ai_analyses FOR INSERT
  WITH CHECK (organization_id = get_user_org_id());

-- behavioral_profiles: users can read/write their own
CREATE POLICY "behavioral_profiles_select" ON behavioral_profiles FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "behavioral_profiles_insert" ON behavioral_profiles FOR INSERT
  WITH CHECK (user_id = get_user_id() AND organization_id = get_user_org_id());

CREATE POLICY "behavioral_profiles_update" ON behavioral_profiles FOR UPDATE
  USING (user_id = get_user_id() AND organization_id = get_user_org_id());

-- ai_missions: users can read/update their own missions
CREATE POLICY "ai_missions_select" ON ai_missions FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "ai_missions_insert" ON ai_missions FOR INSERT
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "ai_missions_update" ON ai_missions FOR UPDATE
  USING (user_id = get_user_id() AND organization_id = get_user_org_id());
