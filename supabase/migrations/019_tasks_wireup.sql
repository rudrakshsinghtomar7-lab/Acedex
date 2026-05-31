-- ============================================================================
-- Acedex — Phase 1 Tasks: wire up the orphaned `tasks` table
-- ============================================================================
-- The tasks table has existed since 001 but was never used by the app. Phase 1
-- turns it into real, team-visible, DB-backed tasks:
--
--   * a 4-state status ladder (not_started → in_progress → submitted → done)
--   * the same three-mode assignee system as assignments' distribution_mode
--     (009): professor / team_leader / self_pick
--   * a task_assignees join table mirroring assignment_assignees (011)
--
-- Privacy model (unchanged): title/assignee/status all live on the task row and
-- are team-visible via the existing tasks_select policy. Grades/feedback are NOT
-- here — they stay in submissions / assignment_assignees under their own RLS, so
-- a team-wide read of tasks leaks nothing private.
--
-- Authority model:
--   * Only the team professor / admin can create, edit, delete tasks, and set
--     status = 'done' (approve). The over-broad tasks_write policy from 001
--     (which let ANY team member write) is dropped.
--   * Students never get a direct UPDATE on tasks. They advance status only
--     through the SECURITY DEFINER RPCs below, neither of which can ever write
--     'done'. That structurally enforces "only the professor approves".
--
-- NOT in this migration (Phase 2/3): milestones, assignment_id auto-linking,
-- contribution %, due-date enforcement. assignment_id / priority / due_date
-- columns are left in place but unused by Phase 1.
-- ============================================================================

-- ── columns ─────────────────────────────────────────────────────────────────

-- 4-state ladder. `done` (the legacy boolean from 001) is kept in sync by a
-- trigger so older readers stay correct; `status` is the source of truth.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','submitted','done'));

-- Same vocabulary as assignments.distribution_mode (009). Reused verbatim.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_mode text NOT NULL DEFAULT 'professor'
    CHECK (assignee_mode IN ('professor','team_leader','self_pick'));

-- Per-task designated leader (mirrors assignment_leaders, 009). Set by the prof
-- at creation when assignee_mode = 'team_leader'; this person may assign.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- keep `done` aligned with `status` automatically (covers RPC updates too).
CREATE OR REPLACE FUNCTION public.tg_tasks_sync_done()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.done := (NEW.status = 'done');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sync_done ON public.tasks;
CREATE TRIGGER tasks_sync_done
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_tasks_sync_done();

-- ── task_assignees (mirrors assignment_assignees, 011) ──────────────────────

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.profiles(id),
  assigned_by uuid REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task    ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_student ON public.task_assignees(student_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- ── tasks RLS: replace the over-broad write, keep team-visible read ──────────

-- tasks_select (001) already grants team members + team professor + admin a
-- read of every task in their team — exactly the team-visible glance view we
-- want. Left untouched.

-- Drop the permissive write from 001 that let any team member create/edit/
-- delete tasks. Phase 1 narrows writes to prof/admin.
DROP POLICY IF EXISTS tasks_write ON public.tasks;

-- create / edit / delete / approve (status='done'): team professor or admin.
CREATE POLICY tasks_prof_write ON public.tasks
  FOR ALL TO authenticated
  USING      (is_team_professor(team_id) OR is_admin())
  WITH CHECK (is_team_professor(team_id) OR is_admin());

-- ── student status-advancement RPCs (the only student write path) ───────────
-- Students have NO direct UPDATE on tasks. They move status forward only via
-- these SECURITY DEFINER functions, which (a) verify team membership in-body
-- and (b) can never write 'done'. The Submit button calls submit_task AFTER
-- the PDF upload (reusing uploadPdfDocument — no new submission path).

CREATE OR REPLACE FUNCTION public.submit_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  SELECT team_id INTO _team FROM public.tasks WHERE id = p_task_id;
  IF _team IS NULL OR NOT public.is_team_member(_team) THEN
    RAISE EXCEPTION 'not allowed: caller is not a member of this task''s team';
  END IF;
  -- only ever reaches 'submitted' — never 'done'.
  UPDATE public.tasks SET status = 'submitted' WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  SELECT team_id INTO _team FROM public.tasks WHERE id = p_task_id;
  IF _team IS NULL OR NOT public.is_team_member(_team) THEN
    RAISE EXCEPTION 'not allowed: caller is not a member of this task''s team';
  END IF;
  -- not_started → in_progress only; cannot reach 'submitted' or 'done'.
  UPDATE public.tasks SET status = 'in_progress'
    WHERE id = p_task_id AND status = 'not_started';
END;
$$;

-- SECURITY DEFINER functions in public are callable by PUBLIC by default. Lock
-- execute to authenticated (the in-body is_team_member check is the real gate).
REVOKE EXECUTE ON FUNCTION public.submit_task(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_task(uuid)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_task(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.start_task(uuid)  TO authenticated;

-- ── task_assignees RLS (mirrors 009 / 011) ──────────────────────────────────

-- read: the student themselves, any team member, the team professor, or admin.
CREATE POLICY task_assignees_select ON public.task_assignees
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND (is_team_member(t.team_id) OR is_team_professor(t.team_id))
    )
  );

-- professor mode: the team professor (or admin) manages assignees.
CREATE POLICY task_assignees_prof_write ON public.task_assignees
  FOR ALL TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id AND is_team_professor(t.team_id)
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id AND is_team_professor(t.team_id)
    )
  );

-- team_leader mode: the task's designated leader may assign.
CREATE POLICY task_assignees_leader_write ON public.task_assignees
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND t.assignee_mode = 'team_leader'
        AND t.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND t.assignee_mode = 'team_leader'
        AND t.leader_id = auth.uid()
    )
  );

-- self_pick mode: a team member can claim themselves (insert their own row
-- only). Mirrors the subtasks_self_claim policy from 009.
CREATE POLICY task_assignees_self_claim ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND t.assignee_mode = 'self_pick'
        AND is_team_member(t.team_id)
    )
  );

-- self_pick un-claim: a team member can remove their own claim.
CREATE POLICY task_assignees_self_unclaim ON public.task_assignees
  FOR DELETE TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND t.assignee_mode = 'self_pick'
        AND is_team_member(t.team_id)
    )
  );
