-- ============================================================================
-- Acedex — DEBUG: maximally permissive teams_insert
-- ============================================================================
-- Temporary. Replaces teams_insert with the loosest possible check
-- (auth.uid() IS NOT NULL) to bisect the bug behind the persistent
-- "new row violates row-level security policy for table teams" error.
--
--   If an authenticated insert SUCCEEDS under this → migration 013's
--   expression has a subtle bug; restore + tighten.
--   If it still FAILS → the auth context (Authorization header / JWT)
--   isn't reaching Postgres as expected; investigate client side.
--
-- LOCK DOWN BEFORE MERGING TO PROD. The follow-up migration should
-- restore (created_by = auth.uid()) OR is_course_professor(course_id)
-- OR is_admin() once the root cause is identified.
-- ============================================================================

DROP POLICY IF EXISTS "teams_insert" ON public.teams;
CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
