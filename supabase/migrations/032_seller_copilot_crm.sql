-- ============ SELLER COPILOT CRM ============

ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS next_action_title TEXT,
  ADD COLUMN IF NOT EXISTS next_action_type TEXT DEFAULT 'follow_up',
  ADD COLUMN IF NOT EXISTS next_action_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS forecast_category TEXT NOT NULL DEFAULT 'pipeline',
  ADD COLUMN IF NOT EXISTS ai_priority_score INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_deals_next_action_type_check'
  ) THEN
    ALTER TABLE crm_deals
      ADD CONSTRAINT crm_deals_next_action_type_check
      CHECK (
        next_action_type IS NULL OR
        next_action_type IN ('follow_up', 'call', 'email', 'proposal', 'meeting', 'review', 'other')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_deals_next_action_status_check'
  ) THEN
    ALTER TABLE crm_deals
      ADD CONSTRAINT crm_deals_next_action_status_check
      CHECK (next_action_status IN ('open', 'done', 'snoozed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_deals_forecast_category_check'
  ) THEN
    ALTER TABLE crm_deals
      ADD CONSTRAINT crm_deals_forecast_category_check
      CHECK (forecast_category IN ('pipeline', 'best_case', 'commit', 'closed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_deals_ai_priority_score_check'
  ) THEN
    ALTER TABLE crm_deals
      ADD CONSTRAINT crm_deals_ai_priority_score_check
      CHECK (ai_priority_score BETWEEN 0 AND 100);
  END IF;
END $$;

UPDATE crm_deals
SET
  next_action_title = COALESCE(next_action_title, 'Definir proximo passo'),
  next_action_type = COALESCE(next_action_type, 'follow_up'),
  next_action_status = COALESCE(next_action_status, 'open'),
  forecast_category = CASE
    WHEN stage = 'closed_won' THEN 'closed'
    WHEN probability >= 75 THEN 'commit'
    WHEN probability >= 40 THEN 'best_case'
    ELSE COALESCE(forecast_category, 'pipeline')
  END,
  ai_priority_score = GREATEST(
    COALESCE(ai_priority_score, 0),
    LEAST(
      100,
      COALESCE(probability, 0)
      + CASE WHEN last_activity_at IS NULL THEN 25 ELSE 0 END
      + CASE
          WHEN expected_close IS NOT NULL AND expected_close <= current_date + interval '7 days' THEN 20
          ELSE 0
        END
    )
  )
WHERE stage NOT IN ('closed_won', 'closed_lost')
  AND (
    next_action_title IS NULL
    OR next_action_type IS NULL
    OR forecast_category = 'pipeline'
    OR ai_priority_score = 0
  );

CREATE INDEX IF NOT EXISTS idx_deals_next_action_due
  ON crm_deals(organization_id, owner_id, next_action_status, next_action_due_at)
  WHERE next_action_status = 'open';

CREATE INDEX IF NOT EXISTS idx_deals_forecast_category
  ON crm_deals(organization_id, owner_id, forecast_category);

CREATE INDEX IF NOT EXISTS idx_deals_ai_priority
  ON crm_deals(organization_id, owner_id, ai_priority_score DESC);
