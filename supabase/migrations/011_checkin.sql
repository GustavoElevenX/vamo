-- ============================================================
-- 011: Check-in Diário do Colaborador (Módulo 3)
-- ============================================================

CREATE TABLE daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  energy_level int NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
  intention text,
  obstacle text,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Um check-in por usuário por dia
CREATE UNIQUE INDEX daily_checkins_user_date ON daily_checkins(user_id, checkin_date);

-- Busca rápida por org + data (para termômetro de energia)
CREATE INDEX daily_checkins_org_date ON daily_checkins(organization_id, checkin_date);

-- RLS
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins"
  ON daily_checkins FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own checkins"
  ON daily_checkins FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Managers can view org checkins"
  ON daily_checkins FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
    )
  );
