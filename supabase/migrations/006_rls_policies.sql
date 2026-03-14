-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;

-- ============ ORGANIZATIONS ============
-- Admin can see all orgs, others see their own
CREATE POLICY "admin_all_orgs" ON organizations
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "users_view_own_org" ON organizations
  FOR SELECT USING (id = get_user_org_id());

-- ============ USERS ============
-- Admin sees all users
CREATE POLICY "admin_all_users" ON users
  FOR ALL USING (get_user_role() = 'admin');

-- Users in same org can view each other
CREATE POLICY "org_users_select" ON users
  FOR SELECT USING (organization_id = get_user_org_id());

-- Users can update their own record
CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth_id = auth.uid());

-- Manager can update users in their org
CREATE POLICY "manager_update_org_users" ON users
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND get_user_role() = 'manager'
  );

-- ============ DIAGNOSTIC TEMPLATES & QUESTIONS (public read) ============
CREATE POLICY "templates_public_read" ON diagnostic_templates
  FOR SELECT USING (true);

CREATE POLICY "templates_admin_manage" ON diagnostic_templates
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "questions_public_read" ON diagnostic_questions
  FOR SELECT USING (true);

CREATE POLICY "questions_admin_manage" ON diagnostic_questions
  FOR ALL USING (get_user_role() = 'admin');

-- ============ DIAGNOSTIC SESSIONS & ANSWERS ============
CREATE POLICY "sessions_org_access" ON diagnostic_sessions
  FOR ALL USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "answers_via_session" ON diagnostic_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM diagnostic_sessions s
      WHERE s.id = diagnostic_answers.session_id
      AND (s.organization_id = get_user_org_id() OR get_user_role() = 'admin')
    )
  );

-- ============ KPI DEFINITIONS ============
CREATE POLICY "kpi_defs_org_read" ON kpi_definitions
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "kpi_defs_manager_manage" ON kpi_definitions
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ KPI ENTRIES ============
CREATE POLICY "kpi_entries_org_read" ON kpi_entries
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "kpi_entries_user_insert" ON kpi_entries
  FOR INSERT WITH CHECK (
    user_id = get_user_id()
    AND organization_id = get_user_org_id()
  );

CREATE POLICY "kpi_entries_manager_insert" ON kpi_entries
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  );

-- ============ XP LEVELS ============
CREATE POLICY "xp_levels_org_read" ON xp_levels
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "xp_levels_admin_manage" ON xp_levels
  FOR ALL USING (get_user_role() = 'admin' OR (organization_id = get_user_org_id() AND get_user_role() = 'manager'));

-- ============ USER XP ============
CREATE POLICY "user_xp_org_read" ON user_xp
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "user_xp_system_manage" ON user_xp
  FOR ALL USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

-- ============ XP TRANSACTIONS ============
CREATE POLICY "xp_transactions_org_read" ON xp_transactions
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "xp_transactions_system_insert" ON xp_transactions
  FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR get_user_role() = 'admin');

-- ============ BADGES ============
CREATE POLICY "badges_org_read" ON badges
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "badges_manager_manage" ON badges
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ USER BADGES ============
CREATE POLICY "user_badges_org_read" ON user_badges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = user_badges.user_id
      AND (u.organization_id = get_user_org_id() OR get_user_role() = 'admin')
    )
  );

CREATE POLICY "user_badges_system_insert" ON user_badges
  FOR INSERT WITH CHECK (true);

-- ============ CHALLENGES ============
CREATE POLICY "challenges_org_read" ON challenges
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "challenges_manager_manage" ON challenges
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ CHALLENGE PARTICIPANTS ============
CREATE POLICY "challenge_parts_org_read" ON challenge_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenges c WHERE c.id = challenge_participants.challenge_id
      AND (c.organization_id = get_user_org_id() OR get_user_role() = 'admin')
    )
  );

CREATE POLICY "challenge_parts_user_join" ON challenge_participants
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "challenge_parts_update" ON challenge_participants
  FOR UPDATE USING (user_id = get_user_id() OR get_user_role() IN ('manager', 'admin'));

-- ============ REWARDS CATALOG ============
CREATE POLICY "rewards_org_read" ON rewards_catalog
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "rewards_manager_manage" ON rewards_catalog
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ REWARD REDEMPTIONS ============
CREATE POLICY "redemptions_org_read" ON reward_redemptions
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "redemptions_user_insert" ON reward_redemptions
  FOR INSERT WITH CHECK (user_id = get_user_id() AND organization_id = get_user_org_id());

CREATE POLICY "redemptions_manager_update" ON reward_redemptions
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('manager', 'admin')
  );

-- ============ LEADERBOARD SNAPSHOTS ============
CREATE POLICY "leaderboard_org_read" ON leaderboard_snapshots
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "leaderboard_system_manage" ON leaderboard_snapshots
  FOR ALL USING (get_user_role() IN ('manager', 'admin'));

-- ============ PLAYBOOKS ============
CREATE POLICY "playbooks_org_read" ON playbooks
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "playbooks_manager_manage" ON playbooks
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ CHECKLIST TEMPLATES ============
CREATE POLICY "checklist_templates_org_read" ON checklist_templates
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "checklist_templates_manager_manage" ON checklist_templates
  FOR ALL USING (
    (organization_id = get_user_org_id() AND get_user_role() IN ('manager', 'admin'))
    OR get_user_role() = 'admin'
  );

-- ============ CHECKLIST COMPLETIONS ============
CREATE POLICY "checklist_completions_org_read" ON checklist_completions
  FOR SELECT USING (organization_id = get_user_org_id() OR get_user_role() = 'admin');

CREATE POLICY "checklist_completions_user_insert" ON checklist_completions
  FOR INSERT WITH CHECK (user_id = get_user_id() AND organization_id = get_user_org_id());
