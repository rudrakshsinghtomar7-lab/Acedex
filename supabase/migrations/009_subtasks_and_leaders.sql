-- ============================================================================
-- Acedex — Feature 7 PR B: role-based subtask distribution
-- ============================================================================
-- Three distribution modes for team assignments:
--   professor   → professor assigns each subtask to a specific student
--   team_leader → designated team leader assigns subtasks
--   self_pick   → students claim open subtasks themselves
--
-- distribution_mode is nullable so the existing Feature-7 assignments (no
-- subtask distribution layer) keep working unchanged. New tables get RLS
-- enabled with the same is_team_member / is_team_professor / is_admin
-- helpers used by assignments + submissions.
-- ============================================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS distribution_mode text
    CHECK (distribution_mode IS NULL OR distribution_mode IN ('professor', 'team_leader', 'self_pick'));

-- --- assignment_subtasks ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignment_subtasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  assigned_to     uuid REFERENCES public.profiles(id),
  assigned_by     uuid REFERENCES public.profiles(id),
  claimed_at      timestamptz,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'submitted', 'approved')),
  pdf_document_id uuid REFERENCES public.pdf_documents(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_assignment
  ON public.assignment_subtasks(assignment_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_assignee
  ON public.assignment_subtasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_subtasks_unclaimed
  ON public.assignment_subtasks(assignment_id)
  WHERE assigned_to IS NULL;

ALTER TABLE public.assignment_subtasks ENABLE ROW LEVEL SECURITY;

-- SELECT: any team member of the parent assignment's team can see all
-- subtasks; the professor and admins can too.
CREATE POLICY "subtasks_select" ON public.assignment_subtasks
  FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_subtasks.assignment_id
        AND (is_team_member(a.team_id) OR is_team_professor(a.team_id))
    )
  );

-- Professor (or admin) can do anything on subtasks of their team's assignments.
CREATE POLICY "subtasks_prof_write" ON public.assignment_subtasks
  FOR ALL TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_subtasks.assignment_id
        AND is_team_professor(a.team_id)
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_subtasks.assignment_id
        AND is_team_professor(a.team_id)
    )
  );

-- Assignee can update their own subtask (status changes, PDF link). Cannot
-- reassign to someone else — the WITH CHECK keeps assigned_to pinned.
CREATE POLICY "subtasks_assignee_update" ON public.assignment_subtasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- self_pick claim: a team member can UPDATE an unclaimed row to assign it
-- to themselves. The USING clause requires the row currently be unclaimed
-- AND the user be on the team; WITH CHECK requires the new assigned_to be
-- the same user, with status either staying 'open' or moving to 'in_progress'.
CREATE POLICY "subtasks_self_claim" ON public.assignment_subtasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_subtasks.assignment_id
        AND a.distribution_mode = 'self_pick'
        AND is_team_member(a.team_id)
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND status IN ('open', 'in_progress')
  );

-- --- assignment_leaders -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignment_leaders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  leader_id       uuid NOT NULL REFERENCES public.profiles(id),
  designated_by   uuid REFERENCES public.profiles(id),
  designated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, leader_id)
);

CREATE INDEX IF NOT EXISTS idx_leaders_assignment
  ON public.assignment_leaders(assignment_id);

ALTER TABLE public.assignment_leaders ENABLE ROW LEVEL SECURITY;

-- SELECT: every team member of the parent assignment's team.
CREATE POLICY "leaders_select" ON public.assignment_leaders
  FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_leaders.assignment_id
        AND (is_team_member(a.team_id) OR is_team_professor(a.team_id))
    )
  );

-- Only the professor of the course (or admin) can designate / revoke a leader.
CREATE POLICY "leaders_prof_write" ON public.assignment_leaders
  FOR ALL TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_leaders.assignment_id
        AND is_team_professor(a.team_id)
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_leaders.assignment_id
        AND is_team_professor(a.team_id)
    )
  );
