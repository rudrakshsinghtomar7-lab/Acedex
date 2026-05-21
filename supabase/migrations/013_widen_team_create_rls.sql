-- ============================================================================
-- Acedex — fix: widen INSERT RLS on teams + courses
-- ============================================================================
-- Before this migration, only the course's professor (or an admin) could
-- create a team, and only an existing 'professor' role could create a
-- course. That blocked the core "create project" flow for any user who
-- wasn't already provisioned as a professor on a course they owned.
--
-- New rules:
--   teams_insert   — allow creator self-insert (created_by = auth.uid()),
--                    OR the course's professor, OR admin.
--   courses_insert — drop the is_professor() role check; require only that
--                    the row's professor_id matches the inserter AND that
--                    university_id matches the inserter's. This lets a
--                    student create a course they own; admin escape hatch
--                    kept.
--
-- SELECT / UPDATE / DELETE policies on both tables are unchanged.
-- ============================================================================

DROP POLICY IF EXISTS "teams_insert" ON public.teams;
CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by = auth.uid())
    OR is_course_professor(course_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS "courses_insert" ON public.courses;
CREATE POLICY "courses_insert" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    (professor_id = auth.uid() AND university_id = current_university_id())
    OR is_admin()
  );
