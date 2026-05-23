-- ============================================================================
-- Acedex — Feature 7 Phase 2: dual-grade model + privacy
-- ============================================================================
-- TEAM grade   → assignments.team_points_awarded / team_letter_grade
--                Shared mark, visible to every team member via the existing
--                assignments_select policy.
-- INDIV grade  → assignment_assignees.points_awarded / letter_grade
--                Per-student. Visibility tightened so a student can SELECT
--                only THEIR OWN row — never a teammate's. Professor/admin
--                still see/update everything.
--
-- The submissions table retains its existing points_awarded column (from
-- migration 011) but app code now writes grades to assignments /
-- assignment_assignees instead. Submissions stay as the per-file artifact.
-- ============================================================================

-- --- TEAM grade columns on assignments -------------------------------------
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS team_points_awarded numeric(5,2)
    CHECK (team_points_awarded IS NULL OR (team_points_awarded >= 0 AND team_points_awarded <= 10000));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS team_letter_grade text
    CHECK (team_letter_grade IS NULL OR team_letter_grade IN ('HD','D','C','P','F'));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS team_feedback   text;
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS team_graded_at  timestamptz;
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS team_graded_by  uuid REFERENCES public.profiles(id);

-- --- INDIVIDUAL grade columns on assignment_assignees ----------------------
ALTER TABLE public.assignment_assignees
  ADD COLUMN IF NOT EXISTS points_awarded numeric(5,2)
    CHECK (points_awarded IS NULL OR (points_awarded >= 0 AND points_awarded <= 10000));

ALTER TABLE public.assignment_assignees
  ADD COLUMN IF NOT EXISTS letter_grade text
    CHECK (letter_grade IS NULL OR letter_grade IN ('HD','D','C','P','F'));

ALTER TABLE public.assignment_assignees
  ADD COLUMN IF NOT EXISTS feedback    text;
ALTER TABLE public.assignment_assignees
  ADD COLUMN IF NOT EXISTS graded_at   timestamptz;
ALTER TABLE public.assignment_assignees
  ADD COLUMN IF NOT EXISTS graded_by   uuid REFERENCES public.profiles(id);

-- --- Trigger: auto letter from points (team grade on assignments) ----------
CREATE OR REPLACE FUNCTION public.set_team_letter_grade_from_points()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.team_points_awarded IS NULL THEN
    NEW.team_letter_grade := NULL;
  ELSE
    NEW.team_letter_grade := public.calculate_aussie_grade(NEW.team_points_awarded, NEW.max_points);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_team_points_change ON public.assignments;
CREATE TRIGGER on_assignment_team_points_change
  BEFORE INSERT OR UPDATE OF team_points_awarded ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_team_letter_grade_from_points();

-- --- Trigger: auto letter from points (individual grade on assignees) ------
-- SECURITY DEFINER so the trigger can read assignments.max_points regardless
-- of the caller's RLS (read-only lookup, no writes).
CREATE OR REPLACE FUNCTION public.set_assignee_letter_grade_from_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _max numeric;
BEGIN
  IF NEW.points_awarded IS NULL THEN
    NEW.letter_grade := NULL;
    RETURN NEW;
  END IF;
  SELECT max_points INTO _max FROM public.assignments WHERE id = NEW.assignment_id;
  NEW.letter_grade := public.calculate_aussie_grade(NEW.points_awarded, _max);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignee_points_change ON public.assignment_assignees;
CREATE TRIGGER on_assignee_points_change
  BEFORE INSERT OR UPDATE OF points_awarded ON public.assignment_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_assignee_letter_grade_from_points();

-- --- RLS: PRIVACY on individual grades -------------------------------------
-- Replaces the migration-011 assignees_select. Previous body was:
--   USING (
--     student_id = auth.uid()
--     OR is_admin()
--     OR EXISTS (
--       SELECT 1 FROM public.assignments a
--       WHERE a.id = assignment_assignees.assignment_id
--         AND (is_team_member(a.team_id) OR is_team_professor(a.team_id))
--     )
--   )
-- The is_team_member(a.team_id) disjunct lets any teammate read any
-- assignee row in the same team — now that grade columns live here, that
-- leaks individual grades. Drop that disjunct.
DROP POLICY IF EXISTS "assignees_select" ON public.assignment_assignees;
CREATE POLICY "assignees_select" ON public.assignment_assignees
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_assignees.assignment_id
        AND is_team_professor(a.team_id)
    )
  );
