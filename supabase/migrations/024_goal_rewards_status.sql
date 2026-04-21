-- Add commission bonus to missions
ALTER TABLE ai_missions ADD COLUMN IF NOT EXISTS commission_bonus NUMERIC NOT NULL DEFAULT 0;

-- Index for faster goal status lookups (sellers querying their own org)
CREATE INDEX IF NOT EXISTS idx_program_goals_org ON program_goals(organization_id);
