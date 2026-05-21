-- ============================================================================
-- Acedex — fix: teams_select breaks INSERT … RETURNING for new teams
-- ============================================================================
-- Root cause: supabase-js always sends INSERT … RETURNING *. With RETURNING,
-- Postgres also applies the table's SELECT USING policy to the new row. Our
-- prior teams_select was
--   (is_team_member(id) OR is_team_professor(id) OR is_admin())
-- For a brand-new team:
--   - is_team_member: false (no team_members row yet)
--   - is_team_professor: relies on a SELECT-into-teams inside a SECURITY
--     DEFINER STABLE function that, in practice, doesn't observe the
--     in-flight INSERTed row during the same statement's RETURNING phase.
--   - is_admin: false for a regular professor
-- So even though the prof OWNS the underlying course, the SELECT visibility
-- check fails on the brand-new row and PG aborts with the misleading
-- "new row violates row-level security policy for table teams".
--
-- Fix: add a direct created_by = auth.uid() disjunct to teams_select. It's
-- a row-local column compare with no joins / function calls / snapshot
-- subtlety, so it always evaluates correctly even during RETURNING.
--
-- While we're here, restore teams_insert to the form from migration 013 —
-- the maximally-permissive policy from migration 014 was a debug step and
-- shouldn't ship.
-- ============================================================================

DROP POLICY IF EXISTS "teams_select" ON public.teams;
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR is_team_member(id)
    OR is_team_professor(id)
    OR is_admin()
  );

DROP POLICY IF EXISTS "teams_insert" ON public.teams;
CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by = auth.uid())
    OR is_course_professor(course_id)
    OR is_admin()
  );
