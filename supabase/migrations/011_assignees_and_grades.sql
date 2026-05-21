-- ============================================================================
-- Acedex — Feature 7 PR D: per-student assignment targeting + grades
-- ============================================================================
-- 1. assignment_assignees (join table) — lets a professor pick which subset
--    of team members are responsible for an individual-mode assignment.
--    Empty rowset for an assignment = every team member (back-compat).
-- 2. submissions.points_awarded + letter_grade — Australian grading
--    (HD/D/C/P/F). reviewed_at / reviewed_by already exist on submissions
--    from migration 001; no change there.
-- 3. calculate_aussie_grade(points, max_points) — pure function for the
--    bucket lookup. A BEFORE-UPDATE trigger on submissions auto-fills
--    letter_grade whenever points_awarded changes, so callers only have to
--    set the numeric score.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignment_assignees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id),
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignees_assignment ON public.assignment_assignees(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignees_student    ON public.assignment_assignees(student_id);

ALTER TABLE public.assignment_assignees ENABLE ROW LEVEL SECURITY;

-- SELECT: the student themselves, any team member of the parent assignment's
-- team, the professor of the course, or admin.
CREATE POLICY "assignees_select" ON public.assignment_assignees
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_assignees.assignment_id
        AND (is_team_member(a.team_id) OR is_team_professor(a.team_id))
    )
  );

-- Only the professor of the course (or admin) can write the join rows.
CREATE POLICY "assignees_prof_write" ON public.assignment_assignees
  FOR ALL TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_assignees.assignment_id
        AND is_team_professor(a.team_id)
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_assignees.assignment_id
        AND is_team_professor(a.team_id)
    )
  );

-- --- Grades -----------------------------------------------------------------

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS points_awarded numeric(5,2)
    CHECK (points_awarded IS NULL OR (points_awarded >= 0 AND points_awarded <= 10000));

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS letter_grade text
    CHECK (letter_grade IS NULL OR letter_grade IN ('HD','D','C','P','F'));

-- Pure bucket function. Australian grading:
--   HD ≥ 85 / D ≥ 75 / C ≥ 65 / P ≥ 50 / F < 50
CREATE OR REPLACE FUNCTION public.calculate_aussie_grade(points numeric, max_points numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE AS $$
DECLARE
  pct numeric;
BEGIN
  IF max_points IS NULL OR max_points <= 0 OR points IS NULL THEN
    RETURN NULL;
  END IF;
  pct := (points / max_points) * 100;
  IF pct >= 85 THEN RETURN 'HD';
  ELSIF pct >= 75 THEN RETURN 'D';
  ELSIF pct >= 65 THEN RETURN 'C';
  ELSIF pct >= 50 THEN RETURN 'P';
  ELSE                   RETURN 'F';
  END IF;
END;
$$;

-- Auto-fill letter_grade whenever points_awarded is set / cleared. Reads
-- max_points off the parent assignment. SECURITY DEFINER so the trigger can
-- read assignments regardless of the caller's RLS — read-only, no writes.
CREATE OR REPLACE FUNCTION public.set_letter_grade_from_points()
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

DROP TRIGGER IF EXISTS on_submission_points_change ON public.submissions;
CREATE TRIGGER on_submission_points_change
  BEFORE INSERT OR UPDATE OF points_awarded ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_letter_grade_from_points();
