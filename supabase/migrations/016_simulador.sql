-- ============================================================
-- 016: Simulador de Proposta com IA (Módulo 5)
-- ============================================================

CREATE TABLE IF NOT EXISTS simulation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario jsonb NOT NULL DEFAULT '{}',
  messages jsonb NOT NULL DEFAULT '[]',
  feedback jsonb,
  difficulty int NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS simulation_sessions_user ON simulation_sessions(user_id, created_at DESC);

-- RLS
ALTER TABLE simulation_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own simulations"
    ON simulation_sessions FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own simulations"
    ON simulation_sessions FOR INSERT
    WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own simulations"
    ON simulation_sessions FOR UPDATE
    USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
