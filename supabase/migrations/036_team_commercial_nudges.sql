-- Nudges comerciais do gestor.
-- Mantem compatibilidade com notificacoes existentes e adiciona contexto acionavel.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_href TEXT,
  ADD COLUMN IF NOT EXISTS related_mission_id UUID REFERENCES ai_missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performance_event_id UUID REFERENCES performance_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_source
  ON notifications(organization_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_related_mission
  ON notifications(related_mission_id)
  WHERE related_mission_id IS NOT NULL;
