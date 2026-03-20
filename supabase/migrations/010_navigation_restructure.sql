-- ============================================================
-- Migration 010: Navigation Restructure - New tables
-- ============================================================

-- AI Alerts for manager monitoring
CREATE TABLE IF NOT EXISTS ai_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('performance', 'engagement', 'opportunity', 'milestone', 'system')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'opportunity', 'positive')),
  title TEXT NOT NULL,
  description TEXT,
  entity_type TEXT CHECK (entity_type IN ('user', 'team', 'kpi', 'mission', 'system')),
  entity_id UUID,
  quick_action TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_alerts_org ON ai_alerts(organization_id, created_at DESC);
CREATE INDEX idx_ai_alerts_unread ON ai_alerts(organization_id, read) WHERE read = FALSE;

-- Earning projections for seller view
CREATE TABLE IF NOT EXISTS earning_projections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL CHECK (scenario IN ('current', 'active_missions', 'maximum')),
  projected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  missions_included INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_earning_projections_user ON earning_projections(user_id, calculated_at DESC);

-- Platform ROI tracking
CREATE TABLE IF NOT EXISTS platform_roi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  investment NUMERIC(12,2) NOT NULL DEFAULT 0,
  additional_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  time_saved_hours NUMERIC(8,2) DEFAULT 0,
  turnover_reduction_pct NUMERIC(5,2) DEFAULT 0,
  roi_multiplier NUMERIC(8,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_platform_roi_org ON platform_roi(organization_id, calculated_at DESC);

-- Feed posts for recognition/celebrations
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('achievement', 'recognition', 'celebration', 'milestone')),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feed_posts_org ON feed_posts(organization_id, created_at DESC);

-- Feed likes
CREATE TABLE IF NOT EXISTS feed_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- System logs for developer view
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_logs_org ON system_logs(organization_id, created_at DESC);
CREATE INDEX idx_system_logs_level ON system_logs(organization_id, level, created_at DESC);

-- Integration health for developer view
CREATE TABLE IF NOT EXISTS integration_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected', 'attention', 'disconnected', 'error')),
  last_sync TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_health_org ON integration_health(organization_id);

-- Webhooks for developer view
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  secret TEXT,
  last_delivery TIMESTAMPTZ,
  success_rate NUMERIC(5,2) DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_org ON webhooks(organization_id);

-- Enable RLS on all new tables
ALTER TABLE ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE earning_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_roi ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-scoped read)
CREATE POLICY "Users can view own org alerts" ON ai_alerts
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users can view own projections" ON earning_projections
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users can view own org ROI" ON platform_roi
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users can view own org feed" ON feed_posts
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users can insert feed posts" ON feed_posts
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Users can like posts" ON feed_likes
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Developers can view system logs" ON system_logs
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid() AND role IN ('developer', 'admin')
  ));

CREATE POLICY "Developers can view integration health" ON integration_health
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid() AND role IN ('developer', 'admin', 'manager')
  ));

CREATE POLICY "Developers can manage webhooks" ON webhooks
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid() AND role IN ('developer', 'admin')
  ));
