-- ============================================================
-- 017: Fix RLS policies for Consultant role
--
-- CRITICAL FIX: All policies use get_user_id() (SECURITY DEFINER)
-- instead of JOIN/subquery on the `users` table. This avoids
-- "infinite recursion detected in policy" errors caused by:
--   users policy → consultant_portfolio → consultant_portfolio policy → users → LOOP
-- ============================================================

-- ── Step 1: Drop broken policies if they exist ──────────────────────────

-- Drop the recursive policy on users (from a previous run of this migration)
DROP POLICY IF EXISTS "consultants_view_portfolio_users" ON users;

-- Drop the recursive policy on consultant_portfolio (from migration 014)
DROP POLICY IF EXISTS "Consultants can view own portfolio" ON consultant_portfolio;

-- Drop all consultant policies from a previous run of this migration
DROP POLICY IF EXISTS "consultants_view_portfolio_orgs" ON organizations;
DROP POLICY IF EXISTS "consultants_view_portfolio_diagnostics" ON diagnostic_sessions;
DROP POLICY IF EXISTS "consultants_view_portfolio_kpis" ON kpi_entries;
DROP POLICY IF EXISTS "consultants_view_portfolio_kpi_defs" ON kpi_definitions;
DROP POLICY IF EXISTS "consultants_view_portfolio_user_xp" ON user_xp;
DROP POLICY IF EXISTS "consultants_view_portfolio_xp_transactions" ON xp_transactions;
DROP POLICY IF EXISTS "consultants_view_portfolio_xp_levels" ON xp_levels;
DROP POLICY IF EXISTS "consultants_view_portfolio_badges" ON badges;
DROP POLICY IF EXISTS "consultants_view_portfolio_missions" ON ai_missions;
DROP POLICY IF EXISTS "consultants_view_portfolio_challenges" ON challenges;

-- Drop recursive policies from migration 014 (they JOIN users too)
DROP POLICY IF EXISTS "Consultants can view portfolio checkins" ON daily_checkins;
DROP POLICY IF EXISTS "Consultants can view portfolio briefings" ON weekly_briefings;
DROP POLICY IF EXISTS "Consultants can view portfolio retrospectives" ON monthly_retrospectives;

-- ── Step 2: Recreate consultant_portfolio policy WITHOUT referencing users ──

CREATE POLICY "Consultants can view own portfolio"
  ON consultant_portfolio FOR SELECT
  USING (consultant_user_id = get_user_id());

-- ── Step 3: Recreate all consultant policies using get_user_id() ────────

CREATE POLICY "consultants_view_portfolio_orgs" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_users" ON users
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_diagnostics" ON diagnostic_sessions
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_kpis" ON kpi_entries
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_kpi_defs" ON kpi_definitions
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_user_xp" ON user_xp
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_xp_transactions" ON xp_transactions
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_xp_levels" ON xp_levels
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_badges" ON badges
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_missions" ON ai_missions
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "consultants_view_portfolio_challenges" ON challenges
  FOR SELECT USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

-- Recreate migration 014 policies without JOIN users
CREATE POLICY "Consultants can view portfolio checkins"
  ON daily_checkins FOR SELECT
  USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "Consultants can view portfolio briefings"
  ON weekly_briefings FOR SELECT
  USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );

CREATE POLICY "Consultants can view portfolio retrospectives"
  ON monthly_retrospectives FOR SELECT
  USING (
    organization_id IN (
      SELECT cp.organization_id FROM consultant_portfolio cp
      WHERE cp.consultant_user_id = get_user_id()
    )
  );
