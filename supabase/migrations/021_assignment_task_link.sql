-- ============================================================================
-- Acedex — Phase 3 Tasks: assignment → task auto-link
-- ============================================================================
-- One assignment ↔ one task. When a professor creates an assignment, a mirror
-- task auto-appears (title from the assignment, assignees inherited from
-- assignment_assignees). The task's status FLOWS FROM the assignment — the
-- assignment is the source of truth — via SECURITY DEFINER triggers, so it
-- stays in sync no matter which path changes the assignment/submission.
--
-- Status mapping (compute_assignment_task_status):
--   done        ← assignments.status='done' OR an 'approved' submission exists
--   submitted   ← else, any submission in a submitted/under-review/verdict state
--   in_progress ← else, a 'draft' submission exists
--   not_started ← else (no submissions)
--
-- "done" is provably prof-only: assignments writes are prof/admin-only, and the
-- submissions UPDATE policy is tightened below so a student can never set their
-- own submission to a review verdict (only a prof can produce 'approved').
--
-- Privacy unchanged: the task row carries only title/assignee/status. Grades/
-- feedback stay in assignments / assignment_assignees / submissions under their
-- existing RLS — none of it lives on tasks.
--
-- Delete: tasks.assignment_id FK becomes ON DELETE CASCADE, so deleting an
-- assignment removes ONLY its mirror task (+ that task's task_assignees). It
-- never touches submissions/grades through the task. (The assignment→submissions
-- cascade is pre-existing from 001 and untouched here.)
--
-- NOT in this migration (out of Phase 3): contribution %, due-date logic.
-- ============================================================================

-- ── 1. idempotent link — one task per assignment ───────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_assignment_id
  ON public.tasks(assignment_id) WHERE assignment_id IS NOT NULL;

-- ── 2. assignment delete removes the mirror task only ───────────────────────
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assignment_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assignment_id_fkey
  FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;

-- ── 3. status mapping (assignment is the source of truth) ───────────────────
CREATE OR REPLACE FUNCTION public.compute_assignment_task_status(_assignment_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN (SELECT a.status::text FROM public.assignments a WHERE a.id = _assignment_id) = 'done'
      OR EXISTS (SELECT 1 FROM public.submissions s
                   WHERE s.assignment_id = _assignment_id AND s.status::text = 'approved')
      THEN 'done'
    WHEN EXISTS (SELECT 1 FROM public.submissions s
                   WHERE s.assignment_id = _assignment_id
                     AND s.status::text IN ('submitted','under_review','reviewed','returned',
                                            'rejected','resubmit_requested','needs_resubmission'))
      THEN 'submitted'
    WHEN EXISTS (SELECT 1 FROM public.submissions s
                   WHERE s.assignment_id = _assignment_id AND s.status::text = 'draft')
      THEN 'in_progress'
    ELSE 'not_started'
  END;
$$;

-- ── 4. auto-create the mirror task on assignment INSERT ─────────────────────
-- assignee_mode='professor': the task is assignment-driven; students don't
-- self-pick/reassign it. Assignees are synced from assignment_assignees (#6),
-- which createAssignment inserts in a following statement.
CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tasks (assignment_id, team_id, title, created_by, assignee_mode, status)
  VALUES (NEW.id, NEW.team_id, NEW.title, NEW.owner_id, 'professor',
          public.compute_assignment_task_status(NEW.id))
  ON CONFLICT (assignment_id) WHERE assignment_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_create_task ON public.assignments;
CREATE TRIGGER on_assignment_create_task
  AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.create_task_for_assignment();

-- ── 5. keep title + status in sync ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_task_from_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tasks
     SET title = NEW.title,
         status = public.compute_assignment_task_status(NEW.id)
   WHERE assignment_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_sync_task ON public.assignments;
CREATE TRIGGER on_assignment_sync_task
  AFTER UPDATE OF title, status ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_from_assignment();

-- recompute task status whenever the assignment's submissions change (insert,
-- status change, or delete of the last one).
CREATE OR REPLACE FUNCTION public.sync_task_from_submission()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _aid uuid := COALESCE(NEW.assignment_id, OLD.assignment_id);
BEGIN
  UPDATE public.tasks
     SET status = public.compute_assignment_task_status(_aid)
   WHERE assignment_id = _aid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_submission_sync_task ON public.submissions;
CREATE TRIGGER on_submission_sync_task
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_from_submission();

-- ── 6. inherit / keep assignees from assignment_assignees → task_assignees ──
CREATE OR REPLACE FUNCTION public.sync_assignment_task_assignees(_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _task_id uuid;
BEGIN
  SELECT id INTO _task_id FROM public.tasks WHERE assignment_id = _assignment_id;
  IF _task_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.task_assignees ta
    WHERE ta.task_id = _task_id
      AND ta.student_id NOT IN (
        SELECT aa.student_id FROM public.assignment_assignees aa WHERE aa.assignment_id = _assignment_id);
  INSERT INTO public.task_assignees (task_id, student_id, assigned_by)
    SELECT _task_id, aa.student_id, NULL
      FROM public.assignment_assignees aa WHERE aa.assignment_id = _assignment_id
    ON CONFLICT (task_id, student_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_assignment_task_assignees()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_assignment_task_assignees(COALESCE(NEW.assignment_id, OLD.assignment_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_assignee_sync_task ON public.assignment_assignees;
CREATE TRIGGER on_assignment_assignee_sync_task
  AFTER INSERT OR DELETE ON public.assignment_assignees
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_assignment_task_assignees();

-- ── 7. guard the Phase-1 RPCs so they never touch an auto-task ──────────────
-- Auto-task status is assignment-driven; let students submit through the
-- assignment flow, not the standalone RPCs (prevents desync / forging).
CREATE OR REPLACE FUNCTION public.submit_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _aid uuid;
BEGIN
  SELECT team_id, assignment_id INTO _team, _aid FROM public.tasks WHERE id = p_task_id;
  IF _team IS NULL OR NOT public.is_team_member(_team) THEN
    RAISE EXCEPTION 'not allowed: caller is not a member of this task''s team';
  END IF;
  IF _aid IS NOT NULL THEN
    RAISE EXCEPTION 'this task mirrors an assignment — submit through the assignment, not submit_task';
  END IF;
  UPDATE public.tasks SET status = 'submitted' WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _aid uuid;
BEGIN
  SELECT team_id, assignment_id INTO _team, _aid FROM public.tasks WHERE id = p_task_id;
  IF _team IS NULL OR NOT public.is_team_member(_team) THEN
    RAISE EXCEPTION 'not allowed: caller is not a member of this task''s team';
  END IF;
  IF _aid IS NOT NULL THEN
    RAISE EXCEPTION 'this task mirrors an assignment — status is assignment-driven';
  END IF;
  UPDATE public.tasks SET status = 'in_progress'
    WHERE id = p_task_id AND status = 'not_started';
END;
$$;

-- ── 8. close the loose submissions UPDATE policy ────────────────────────────
-- Before: WITH CHECK let a student set their own submission to ANY status,
-- including 'approved' — which would let them forge the task's Done. Now a
-- student updating their own row can only land it in a student-side state;
-- review verdicts (approved/rejected/reviewed/resubmit_requested/...) are
-- prof/admin-only. Students still INSERT submissions + resubmissions freely.
DROP POLICY IF EXISTS submissions_update ON public.submissions;
CREATE POLICY submissions_update ON public.submissions
  FOR UPDATE TO authenticated
  USING (submitter_id = auth.uid() OR is_team_professor(team_id) OR is_admin())
  WITH CHECK (
    is_team_professor(team_id) OR is_admin()
    OR (submitter_id = auth.uid()
        AND status::text IN ('draft','submitted','under_review'))
  );

-- ── 9. BACKFILL existing assignments (idempotent) ───────────────────────────
INSERT INTO public.tasks (assignment_id, team_id, title, created_by, assignee_mode, status)
SELECT a.id, a.team_id, a.title, a.owner_id, 'professor', 'not_started'
  FROM public.assignments a
 WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.assignment_id = a.id)
ON CONFLICT (assignment_id) WHERE assignment_id IS NOT NULL DO NOTHING;

INSERT INTO public.task_assignees (task_id, student_id)
SELECT t.id, aa.student_id
  FROM public.tasks t
  JOIN public.assignment_assignees aa ON aa.assignment_id = t.assignment_id
 WHERE t.assignment_id IS NOT NULL
ON CONFLICT (task_id, student_id) DO NOTHING;

UPDATE public.tasks t
   SET status = public.compute_assignment_task_status(t.assignment_id)
 WHERE t.assignment_id IS NOT NULL;
