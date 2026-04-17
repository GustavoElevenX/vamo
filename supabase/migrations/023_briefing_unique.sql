-- ============================================================
-- 023: Adicionar constraint UNIQUE em weekly_briefings
-- Necessário para upsert (ON CONFLICT) funcionar corretamente
-- ============================================================

-- Remove linhas duplicadas, mantendo a mais recente por (org, semana)
DELETE FROM weekly_briefings
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, week_start) id
  FROM weekly_briefings
  ORDER BY organization_id, week_start, created_at DESC
);

-- Remove índice antigo (não-único)
DROP INDEX IF EXISTS weekly_briefings_org_week;

-- Cria índice único (necessário para upsert ON CONFLICT)
CREATE UNIQUE INDEX weekly_briefings_org_week ON weekly_briefings(organization_id, week_start);

-- Política de UPDATE para que o upsert funcione via RLS
CREATE POLICY "Managers can update org briefings"
  ON weekly_briefings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE auth_id = auth.uid() AND role IN ('manager', 'admin')
    )
  );
