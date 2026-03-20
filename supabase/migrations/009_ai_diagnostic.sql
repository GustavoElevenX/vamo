-- Allow template_id to be NULL for AI-generated diagnostics
ALTER TABLE diagnostic_sessions ALTER COLUMN template_id DROP NOT NULL;

-- Store company context (the 14 fixed fields collected before AI generates questions)
ALTER TABLE diagnostic_sessions ADD COLUMN IF NOT EXISTS company_context JSONB;

-- Store AI-generated questions + user answers inline (no foreign key needed)
ALTER TABLE diagnostic_sessions ADD COLUMN IF NOT EXISTS ai_qa JSONB;
