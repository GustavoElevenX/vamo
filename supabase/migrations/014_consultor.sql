-- ============================================================
-- 014: Modo Consultor (Módulo 8)
-- ============================================================

-- Nota: o role de user é armazenado como text na tabela users,
-- então não precisa de ALTER TYPE. Basta adicionar o valor 'consultant'
-- na lógica da aplicação (constants.ts e types/index.ts).

-- Tabela de carteira do consultor (quais orgs ele gerencia)
CREATE TABLE consultant_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consultant_user_id, organization_id)
);

CREATE INDEX consultant_portfolio_user ON consultant_portfolio(consultant_user_id);

-- RLS
ALTER TABLE consultant_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants can view own portfolio"
  ON consultant_portfolio FOR SELECT
  USING (
    consultant_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Admins can manage portfolio"
  ON consultant_portfolio FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- Permitir que consultores acessem dados das orgs da sua carteira
-- Política adicional para daily_checkins
CREATE POLICY "Consultants can view portfolio checkins"
  ON daily_checkins FOR SELECT
  USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      JOIN users u ON u.id = cp.consultant_user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Política adicional para weekly_briefings
CREATE POLICY "Consultants can view portfolio briefings"
  ON weekly_briefings FOR SELECT
  USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      JOIN users u ON u.id = cp.consultant_user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Política adicional para monthly_retrospectives
CREATE POLICY "Consultants can view portfolio retrospectives"
  ON monthly_retrospectives FOR SELECT
  USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      JOIN users u ON u.id = cp.consultant_user_id
      WHERE u.auth_id = auth.uid()
    )
  );
