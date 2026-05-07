-- ============ PERFORMANCE OS + PDI APLICADO ============

-- Nucleo de eventos: toda acao relevante vira consequencia rastreavel.
CREATE TABLE IF NOT EXISTS performance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  source_module TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  impact_score NUMERIC NOT NULL DEFAULT 0,
  priority_score NUMERIC NOT NULL DEFAULT 0,
  risk_score NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES performance_events(id) ON DELETE CASCADE,
  impacted_module TEXT NOT NULL,
  impacted_entity_type TEXT,
  impacted_entity_id UUID,
  impact_type TEXT NOT NULL,
  impact_value NUMERIC,
  impact_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS action_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES performance_events(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_module TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  suggested_action_label TEXT,
  suggested_action_href TEXT,
  suggested_action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT action_recommendations_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT action_recommendations_status_check
    CHECK (status IN ('open', 'accepted', 'done', 'dismissed', 'expired'))
);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_entity_type TEXT NOT NULL,
  from_entity_id UUID NOT NULL,
  to_entity_type TEXT NOT NULL,
  to_entity_id UUID NOT NULL,
  relationship_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PDI nasce de gap real e volta para aplicacao, evidencia e KPI.
CREATE TABLE IF NOT EXISTS pdi_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gap_type TEXT NOT NULL,
  skill_area TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  detected_from TEXT NOT NULL,
  source_entity_type TEXT,
  source_entity_id UUID,
  severity TEXT NOT NULL DEFAULT 'medium',
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CHECK (status IN ('open', 'in_pdi', 'improving', 'resolved', 'dismissed'))
);

CREATE TABLE IF NOT EXISTS pdi_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  gap_id UUID REFERENCES pdi_gaps(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'recommended',
  recommended_by TEXT NOT NULL DEFAULT 'ai',
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  target_kpi_key TEXT,
  baseline_value NUMERIC,
  target_value NUMERIC,
  current_value NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('recommended', 'approved', 'active', 'completed', 'paused', 'rejected')),
  CHECK (recommended_by IN ('ai', 'manager', 'system'))
);

CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  skill_area TEXT NOT NULL,
  module_type TEXT NOT NULL DEFAULT 'micro_training',
  estimated_minutes INT NOT NULL DEFAULT 5,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (module_type IN ('micro_training', 'roleplay', 'checklist', 'script', 'case', 'simulation'))
);

CREATE TABLE IF NOT EXISTS pdi_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pdi_plans(id) ON DELETE CASCADE,
  training_module_id UUID REFERENCES training_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'training',
  status TEXT NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (item_type IN ('training', 'roleplay', 'deal_application', 'follow_up_application', 'proposal_application', 'simulation', 'manager_review')),
  CHECK (status IN ('pending', 'in_progress', 'done', 'skipped'))
);

CREATE TABLE IF NOT EXISTS pdi_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pdi_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,
  application_type TEXT NOT NULL DEFAULT 'deal',
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (application_type IN ('deal', 'follow_up', 'proposal', 'roleplay', 'simulation')),
  CHECK (status IN ('submitted', 'validated', 'needs_adjustment', 'rejected'))
);

CREATE TABLE IF NOT EXISTS pdi_evolution_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pdi_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID,
  kpi_key TEXT,
  baseline_value NUMERIC,
  current_value NUMERIC,
  delta_value NUMERIC,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saude calibra missao, nudge e pauta humana.
CREATE TABLE IF NOT EXISTS health_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL,
  energy_level INT NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
  risk_level TEXT NOT NULL DEFAULT 'low',
  calibration_type TEXT NOT NULL DEFAULT 'support',
  recommended_manager_action TEXT NOT NULL,
  seller_focus TEXT NOT NULL,
  mission_intensity_modifier NUMERIC NOT NULL DEFAULT 1,
  one_on_one_agenda JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CHECK (calibration_type IN ('support', 'focus', 'sustain', 'sprint'))
);

-- IA contextual pode ser auditada e reutilizada nas telas.
CREATE TABLE IF NOT EXISTS contextual_ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES performance_events(id) ON DELETE SET NULL,
  source_module TEXT NOT NULL,
  output_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comissao rastreavel por recebimento do deal.
CREATE TABLE IF NOT EXISTS deal_payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  received_at DATE,
  due_at DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('pending', 'received', 'overdue', 'cancelled'))
);

ALTER TABLE commission_calculations
  ADD COLUMN IF NOT EXISTS forecast_commission NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS released_commission NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_commission NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_commission NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS block_reason TEXT,
  ADD COLUMN IF NOT EXISTS explanation JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE commission_line_items
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS release_status TEXT NOT NULL DEFAULT 'forecast',
  ADD COLUMN IF NOT EXISTS release_reason TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_id UUID REFERENCES deal_payment_receipts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commission_line_items_release_status_check'
  ) THEN
    ALTER TABLE commission_line_items
      ADD CONSTRAINT commission_line_items_release_status_check
      CHECK (release_status IN ('forecast', 'released', 'pending', 'blocked'));
  END IF;
END $$;

ALTER TABLE xp_transactions
  ADD COLUMN IF NOT EXISTS performance_event_id UUID REFERENCES performance_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS impact_expected TEXT;

ALTER TABLE xp_transactions DROP CONSTRAINT IF EXISTS xp_transactions_source_type_check;
ALTER TABLE xp_transactions
  ADD CONSTRAINT xp_transactions_source_type_check
  CHECK (source_type IN (
    'kpi',
    'badge',
    'challenge',
    'checklist',
    'bonus',
    'crm_activity',
    'crm_deal',
    'goal',
    'mission',
    'pdi_application',
    'kpi_improvement',
    'manager_recognition'
  ));

-- Indices obrigatorios.
CREATE INDEX IF NOT EXISTS idx_performance_events_org ON performance_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_performance_events_actor ON performance_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_performance_events_target ON performance_events(target_user_id);
CREATE INDEX IF NOT EXISTS idx_performance_events_type ON performance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_performance_events_source ON performance_events(source_module);
CREATE INDEX IF NOT EXISTS idx_performance_events_entity ON performance_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_performance_events_occurred ON performance_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_impacts_org ON event_impacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_event_impacts_event ON event_impacts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_impacts_module ON event_impacts(impacted_module);
CREATE INDEX IF NOT EXISTS idx_event_impacts_entity ON event_impacts(impacted_entity_type, impacted_entity_id);

CREATE INDEX IF NOT EXISTS idx_action_recommendations_org ON action_recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_action_recommendations_target ON action_recommendations(target_user_id);
CREATE INDEX IF NOT EXISTS idx_action_recommendations_status ON action_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_action_recommendations_event ON action_recommendations(event_id);
CREATE INDEX IF NOT EXISTS idx_action_recommendations_due ON action_recommendations(due_at);

CREATE INDEX IF NOT EXISTS idx_entity_relationships_org ON entity_relationships(organization_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON entity_relationships(from_entity_type, from_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON entity_relationships(to_entity_type, to_entity_id);

CREATE INDEX IF NOT EXISTS idx_pdi_gaps_org_user ON pdi_gaps(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pdi_gaps_status ON pdi_gaps(status);
CREATE INDEX IF NOT EXISTS idx_pdi_gaps_skill ON pdi_gaps(skill_area);
CREATE INDEX IF NOT EXISTS idx_pdi_plans_org_user ON pdi_plans(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pdi_plans_manager ON pdi_plans(manager_id);
CREATE INDEX IF NOT EXISTS idx_pdi_plans_gap ON pdi_plans(gap_id);
CREATE INDEX IF NOT EXISTS idx_pdi_plans_status ON pdi_plans(status);
CREATE INDEX IF NOT EXISTS idx_training_modules_org_skill ON training_modules(organization_id, skill_area);
CREATE INDEX IF NOT EXISTS idx_pdi_plan_items_plan ON pdi_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_pdi_applications_plan ON pdi_applications(plan_id);
CREATE INDEX IF NOT EXISTS idx_pdi_applications_user ON pdi_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_pdi_applications_deal ON pdi_applications(deal_id);
CREATE INDEX IF NOT EXISTS idx_pdi_applications_account ON pdi_applications(account_id);
CREATE INDEX IF NOT EXISTS idx_pdi_evidence_plan ON pdi_evolution_evidence(plan_id);
CREATE INDEX IF NOT EXISTS idx_health_calibrations_org_user ON health_calibrations(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_health_calibrations_checkin ON health_calibrations(checkin_id);
CREATE INDEX IF NOT EXISTS idx_contextual_ai_outputs_org_user ON contextual_ai_outputs(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_contextual_ai_outputs_entity ON contextual_ai_outputs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deal_payment_receipts_org ON deal_payment_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_payment_receipts_deal ON deal_payment_receipts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_payment_receipts_status ON deal_payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_event ON xp_transactions(performance_event_id);
CREATE INDEX IF NOT EXISTS idx_commission_line_items_deal ON commission_line_items(deal_id);

-- Triggers de updated_at.
DROP TRIGGER IF EXISTS update_action_recommendations_updated_at ON action_recommendations;
CREATE TRIGGER update_action_recommendations_updated_at
  BEFORE UPDATE ON action_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pdi_gaps_updated_at ON pdi_gaps;
CREATE TRIGGER update_pdi_gaps_updated_at
  BEFORE UPDATE ON pdi_gaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pdi_plans_updated_at ON pdi_plans;
CREATE TRIGGER update_pdi_plans_updated_at
  BEFORE UPDATE ON pdi_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_modules_updated_at ON training_modules;
CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON training_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pdi_plan_items_updated_at ON pdi_plan_items;
CREATE TRIGGER update_pdi_plan_items_updated_at
  BEFORE UPDATE ON pdi_plan_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pdi_applications_updated_at ON pdi_applications;
CREATE TRIGGER update_pdi_applications_updated_at
  BEFORE UPDATE ON pdi_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_calibrations_updated_at ON health_calibrations;
CREATE TRIGGER update_health_calibrations_updated_at
  BEFORE UPDATE ON health_calibrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deal_payment_receipts_updated_at ON deal_payment_receipts;
CREATE TRIGGER update_deal_payment_receipts_updated_at
  BEFORE UPDATE ON deal_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS.
ALTER TABLE performance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_evolution_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contextual_ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_events_access" ON performance_events;
CREATE POLICY "performance_events_access" ON performance_events
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      actor_user_id = get_user_id()
      OR target_user_id = get_user_id()
      OR get_user_role() IN ('manager', 'admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "performance_events_insert" ON performance_events;
CREATE POLICY "performance_events_insert" ON performance_events
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "event_impacts_access" ON event_impacts;
CREATE POLICY "event_impacts_access" ON event_impacts
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM performance_events e
      WHERE e.id = event_impacts.event_id
        AND (
          e.actor_user_id = get_user_id()
          OR e.target_user_id = get_user_id()
          OR get_user_role() IN ('manager', 'admin', 'consultant')
        )
    )
  );

DROP POLICY IF EXISTS "event_impacts_insert" ON event_impacts;
CREATE POLICY "event_impacts_insert" ON event_impacts
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "action_recommendations_access" ON action_recommendations;
CREATE POLICY "action_recommendations_access" ON action_recommendations
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      target_user_id = get_user_id()
      OR created_by_user_id = get_user_id()
      OR get_user_role() IN ('manager', 'admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "action_recommendations_insert" ON action_recommendations;
CREATE POLICY "action_recommendations_insert" ON action_recommendations
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "action_recommendations_update" ON action_recommendations;
CREATE POLICY "action_recommendations_update" ON action_recommendations
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND (target_user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (target_user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  );

DROP POLICY IF EXISTS "entity_relationships_org_access" ON entity_relationships;
CREATE POLICY "entity_relationships_org_access" ON entity_relationships
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "entity_relationships_insert" ON entity_relationships;
CREATE POLICY "entity_relationships_insert" ON entity_relationships
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "pdi_gaps_access" ON pdi_gaps;
CREATE POLICY "pdi_gaps_access" ON pdi_gaps
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "pdi_gaps_manage" ON pdi_gaps;
CREATE POLICY "pdi_gaps_manage" ON pdi_gaps
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  );

DROP POLICY IF EXISTS "pdi_plans_access" ON pdi_plans;
CREATE POLICY "pdi_plans_access" ON pdi_plans
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR manager_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "pdi_plans_manage" ON pdi_plans;
CREATE POLICY "pdi_plans_manage" ON pdi_plans
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR manager_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR manager_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  );

DROP POLICY IF EXISTS "training_modules_access" ON training_modules;
CREATE POLICY "training_modules_access" ON training_modules
  FOR SELECT USING (organization_id IS NULL OR organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "training_modules_manager_manage" ON training_modules;
CREATE POLICY "training_modules_manager_manage" ON training_modules
  FOR ALL USING (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
  WITH CHECK (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'));

DROP POLICY IF EXISTS "pdi_plan_items_access" ON pdi_plan_items;
CREATE POLICY "pdi_plan_items_access" ON pdi_plan_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pdi_plans p
      WHERE p.id = pdi_plan_items.plan_id
        AND p.organization_id = get_user_org_id()
        AND (p.user_id = get_user_id() OR p.manager_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
    )
  );

DROP POLICY IF EXISTS "pdi_plan_items_manage" ON pdi_plan_items;
CREATE POLICY "pdi_plan_items_manage" ON pdi_plan_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pdi_plans p
      WHERE p.id = pdi_plan_items.plan_id
        AND p.organization_id = get_user_org_id()
        AND (p.user_id = get_user_id() OR p.manager_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pdi_plans p
      WHERE p.id = pdi_plan_items.plan_id
        AND p.organization_id = get_user_org_id()
        AND (p.user_id = get_user_id() OR p.manager_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
    )
  );

DROP POLICY IF EXISTS "pdi_applications_access" ON pdi_applications;
CREATE POLICY "pdi_applications_access" ON pdi_applications
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "pdi_applications_manage" ON pdi_applications;
CREATE POLICY "pdi_applications_manage" ON pdi_applications
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'))
  );

DROP POLICY IF EXISTS "pdi_evidence_access" ON pdi_evolution_evidence;
CREATE POLICY "pdi_evidence_access" ON pdi_evolution_evidence
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "pdi_evidence_insert" ON pdi_evolution_evidence;
CREATE POLICY "pdi_evidence_insert" ON pdi_evolution_evidence
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "health_calibrations_access" ON health_calibrations;
CREATE POLICY "health_calibrations_access" ON health_calibrations
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "health_calibrations_insert" ON health_calibrations;
CREATE POLICY "health_calibrations_insert" ON health_calibrations
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "contextual_ai_outputs_access" ON contextual_ai_outputs;
CREATE POLICY "contextual_ai_outputs_access" ON contextual_ai_outputs
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (user_id = get_user_id() OR user_id IS NULL OR get_user_role() IN ('manager', 'admin', 'consultant'))
  );

DROP POLICY IF EXISTS "contextual_ai_outputs_insert" ON contextual_ai_outputs;
CREATE POLICY "contextual_ai_outputs_insert" ON contextual_ai_outputs
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "deal_payment_receipts_access" ON deal_payment_receipts;
CREATE POLICY "deal_payment_receipts_access" ON deal_payment_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM crm_deals d
      WHERE d.id = deal_payment_receipts.deal_id
        AND d.organization_id = get_user_org_id()
        AND (d.owner_id = get_user_id() OR get_user_role() IN ('manager', 'admin', 'consultant'))
    )
  );

DROP POLICY IF EXISTS "deal_payment_receipts_manager_manage" ON deal_payment_receipts;
CREATE POLICY "deal_payment_receipts_manager_manage" ON deal_payment_receipts
  FOR ALL USING (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
  WITH CHECK (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'));

-- ROI do desenvolvimento com security invoker para respeitar RLS das tabelas base.
CREATE OR REPLACE VIEW pdi_roi_summary
WITH (security_invoker = true) AS
SELECT
  p.organization_id,
  p.user_id,
  COUNT(DISTINCT p.id) AS total_plans,
  COUNT(DISTINCT a.id) AS total_applications,
  COUNT(DISTINCT e.id) AS total_evidences,
  AVG(e.delta_value) AS avg_kpi_delta,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status IN ('approved', 'active')) AS active_plans,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'completed') AS completed_plans
FROM pdi_plans p
LEFT JOIN pdi_applications a ON a.plan_id = p.id
LEFT JOIN pdi_evolution_evidence e ON e.plan_id = p.id
GROUP BY p.organization_id, p.user_id;
