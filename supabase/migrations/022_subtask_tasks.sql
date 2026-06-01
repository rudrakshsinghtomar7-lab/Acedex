-- ============================================================================
-- Acedex — Phase 3.1: team-assignment SUBTASKS become tasks
-- ============================================================================
-- Phase 3 mirrored one task per assignment, inheriting assignment_assignees.
-- That's right for INDIVIDUAL assignments, but TEAM assignments split work into
-- assignment_subtasks (each assigned to one student, with its own status + PDF)
-- and don't populate assignment_assignees — so their mirror task had no
-- assignee and a student never saw their subtask.
--
-- New model:
--   * INDIVIDUAL assignment → one mirror task (Phase 3, unchanged).
--   * TEAM assignment       → NO parent task; instead one task per SUBTASK,
--     assignee = subtask.assigned_to, status from subtask.status, labelled with
--     the parent assignment title (resolved in the app via subtask_id).
--
-- Subtask-tasks are assignment-driven like Phase-3 auto-tasks: status flows from
-- the subtask; the standalone submit_task/start_task RPCs refuse them.
--
-- Status map: open→not_started, in_progress→in_progress, submitted→submitted,
-- approved→done. "done" is prof-only: the subtasks_assignee_update policy is
-- tightened below so an assignee can no longer set their own subtask to
-- 'approved' (only subtasks_prof_write can).
--
-- Delete: tasks.subtask_id FK is ON DELETE CASCADE, so deleting a subtask (or
-- its assignment, which cascades to its subtasks) removes the mirror task only —
-- never the subtask's PDF (pdf_documents) or any grade row.
-- ============================================================================

-- ── 1. link: one task per subtask ───────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS subtask_id uuid
    REFERENCES public.assignment_subtasks(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_subtask_id
  ON public.tasks(subtask_id) WHERE subtask_id IS NOT NULL;

-- ── 2. parent-task create becomes type-aware (skip TEAM assignments) ─────────
CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Team assignments are mirrored per-subtask (see sync_task_for_subtask),
  -- so they get NO parent task. Individual / untyped assignments get one.
  IF NEW.assignment_type IS DISTINCT FROM 'team' THEN
    INSERT INTO public.tasks (assignment_id, team_id, title, created_by, assignee_mode, status)
    VALUES (NEW.id, NEW.team_id, NEW.title, NEW.owner_id, 'professor',
            public.compute_assignment_task_status(NEW.id))
    ON CONFLICT (assignment_id) WHERE assignment_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. subtask → task: create + keep title/status/assignee in sync ──────────
CREATE OR REPLACE FUNCTION public.sync_task_for_subtask()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _team   uuid;
  _owner  uuid;
  _status text;
  _task   uuid;
BEGIN
  SELECT a.team_id, a.owner_id INTO _team, _owner
    FROM public.assignments a WHERE a.id = NEW.assignment_id;

  _status := CASE NEW.status
               WHEN 'approved'    THEN 'done'
               WHEN 'submitted'   THEN 'submitted'
               WHEN 'in_progress' THEN 'in_progress'
               ELSE 'not_started'
             END;

  INSERT INTO public.tasks (subtask_id, team_id, title, created_by, assignee_mode, status)
  VALUES (NEW.id, _team, NEW.title, _owner, 'professor', _status)
  ON CONFLICT (subtask_id) WHERE subtask_id IS NOT NULL
  DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status;

  SELECT id INTO _task FROM public.tasks WHERE subtask_id = NEW.id;

  -- assignee mirrors subtask.assigned_to (single). Drop a stale assignee,
  -- add the current one.
  DELETE FROM public.task_assignees
    WHERE task_id = _task
      AND (NEW.assigned_to IS NULL OR student_id <> NEW.assigned_to);
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.task_assignees (task_id, student_id, assigned_by)
    VALUES (_task, NEW.assigned_to, NEW.assigned_by)
    ON CONFLICT (task_id, student_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subtask_sync_task ON public.assignment_subtasks;
CREATE TRIGGER on_subtask_sync_task
  AFTER INSERT OR UPDATE OF title, status, assigned_to, assigned_by ON public.assignment_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_for_subtask();

-- ── 4. guard the standalone RPCs against auto-tasks AND subtask-tasks ────────
CREATE OR REPLACE FUNCTION public.submit_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _aid uuid; _sid uuid;
BEGIN
  SELECT team_id, assignment_id, subtask_id INTO _team, _aid, _sid
    FROM public.tasks WHERE id = p_task_id;
  IF _team IS NULL OR NOT public.is_team_member(_team) THEN
    RAISE EXCEPTION 'not allowed: caller is not a member of this task''s team';
  END IF;
  IF _aid IS NOT NULL OR _sid IS NOT NULL THEN
    RAISE EXCEPTION 'this task mirrors an assignment/subtask — submit through it, not submit_task';
  END IF;
  UPDATE public.tasks SET status = 'submitted' WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _aid uuid; _sid uuid;
BEGIN
  SELECT team_id, assignment_id, subtask_id INTO _team, _aid, _sid
    FROM public.tasks WHERE id = p_task_id;
  IF _team IS NULL OR NOT public.is_team_member(_team) THEN
    RAISE EXCEPTION 'not allowed: caller is not a member of this task''s team';
  END IF;
  IF _aid IS NOT NULL OR _sid IS NOT NULL THEN
    RAISE EXCEPTION 'this task mirrors an assignment/subtask — status is assignment-driven';
  END IF;
  UPDATE public.tasks SET status = 'in_progress'
    WHERE id = p_task_id AND status = 'not_started';
END;
$$;

-- ── 5. close the subtask "forge approved" hole (mirrors the 021 submissions fix)
-- An assignee may move their own subtask through student-side states only;
-- 'approved' is prof/admin-only (subtasks_prof_write), so subtask-task Done
-- stays prof-only.
DROP POLICY IF EXISTS "subtasks_assignee_update" ON public.assignment_subtasks;
CREATE POLICY "subtasks_assignee_update" ON public.assignment_subtasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid()
              AND status IN ('open','in_progress','submitted'));

-- ── 6. BACKFILL (idempotent) ────────────────────────────────────────────────
-- a) remove the empty parent tasks Phase 3 created for TEAM assignments
DELETE FROM public.tasks t
  USING public.assignments a
 WHERE t.assignment_id = a.id
   AND a.assignment_type = 'team';

-- b) create one task per existing subtask
INSERT INTO public.tasks (subtask_id, team_id, title, created_by, assignee_mode, status)
SELECT s.id, a.team_id, s.title, a.owner_id, 'professor',
       CASE s.status
         WHEN 'approved'    THEN 'done'
         WHEN 'submitted'   THEN 'submitted'
         WHEN 'in_progress' THEN 'in_progress'
         ELSE 'not_started'
       END
  FROM public.assignment_subtasks s
  JOIN public.assignments a ON a.id = s.assignment_id
 WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.subtask_id = s.id)
ON CONFLICT (subtask_id) WHERE subtask_id IS NOT NULL DO NOTHING;

-- c) sync assignees from subtask.assigned_to
INSERT INTO public.task_assignees (task_id, student_id, assigned_by)
SELECT t.id, s.assigned_to, s.assigned_by
  FROM public.tasks t
  JOIN public.assignment_subtasks s ON s.id = t.subtask_id
 WHERE t.subtask_id IS NOT NULL AND s.assigned_to IS NOT NULL
ON CONFLICT (task_id, student_id) DO NOTHING;
