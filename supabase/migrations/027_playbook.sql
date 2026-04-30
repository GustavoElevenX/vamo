CREATE TABLE IF NOT EXISTS playbook_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playbook_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES playbook_steps(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(step_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_playbook_steps_org ON playbook_steps(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_playbook_compl_deal ON playbook_step_completions(deal_id);

ALTER TABLE playbook_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_step_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playbook_steps_org" ON playbook_steps;
CREATE POLICY "playbook_steps_org" ON playbook_steps
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "playbook_completions_access" ON playbook_step_completions;
CREATE POLICY "playbook_completions_access" ON playbook_step_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = playbook_step_completions.deal_id
        AND d.organization_id = get_user_org_id()
        AND (d.owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = playbook_step_completions.deal_id
        AND d.organization_id = get_user_org_id()
        AND (d.owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
    )
  );
