-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- ============================================================================
-- 030 — only professors/admins may create courses (security fix A2)
-- ============================================================================
--
-- courses_insert checked `professor_id = auth.uid() AND university_id =
-- current_university_id()` but never that the caller IS a professor. Any
-- student could name itself professor_id and create a course. That makes
-- is_course_professor() true, which cascades into a full impersonation chain,
-- verified end to end by attack:
--
--   POST /courses {professor_id:self, ...}                 -> 201  (student "prof")
--   POST /teams   {course_id:<that>}                       -> 201  (is_team_professor now true)
--   POST /team_members {team_id:<that>, profile_id:<ANY>}  -> 201  (force-enrol any user)
--   POST /assignments {team_id:<that>, title:"..."}        -> 201  (fabricate assignment)
--   POST /assignment_assignees {student_id:victim,points:0} -> 201 (forge an "F")
--
-- The conscripted user really saw the fake team membership and the forged grade
-- in their own session; with assignment_type<>'individual' the notify trigger
-- also fans an attacker-authored notification to them.
--
-- Fix: require is_professor() OR is_admin() at course creation. Everything
-- downstream (is_course_professor -> is_team_professor) already keys off course
-- ownership, so gating creation kills the whole chain at step 1.
--
-- Checked before applying: zero courses are currently owned by a non-professor
-- (no forged data to clean up).
-- ============================================================================

begin;

drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses
  for insert to authenticated
  with check (
    is_admin()
    or (
      is_professor()
      and professor_id = auth.uid()
      and university_id = current_university_id()
    )
  );

commit;
