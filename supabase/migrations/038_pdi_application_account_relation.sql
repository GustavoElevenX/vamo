-- Relacao formal entre aplicacao de PDI e cliente/carteira.

ALTER TABLE pdi_applications
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL;

UPDATE pdi_applications a
SET account_id = d.account_id
FROM crm_deals d
WHERE a.account_id IS NULL
  AND a.deal_id = d.id
  AND d.account_id IS NOT NULL;

UPDATE pdi_applications a
SET account_id = (a.evidence->>'accountId')::uuid
WHERE a.account_id IS NULL
  AND a.evidence ? 'accountId'
  AND a.evidence->>'accountId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM crm_accounts c
    WHERE c.id = (a.evidence->>'accountId')::uuid
      AND c.organization_id = a.organization_id
  );

CREATE INDEX IF NOT EXISTS idx_pdi_applications_account
  ON pdi_applications(account_id);

UPDATE ai_missions m
SET status = 'awaiting_approval',
    updated_at = now()
FROM pdi_plans p
WHERE m.pdi_plan_id = p.id
  AND m.type = 'pdi'
  AND m.status = 'pending'
  AND p.status IN ('recommended', 'pending_approval');
