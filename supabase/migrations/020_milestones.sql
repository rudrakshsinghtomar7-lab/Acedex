-- ============================================================================
-- Acedex — Phase 2 Tasks/Milestones: milestones as team-context containers
-- ============================================================================
-- A milestone is a titled container that holds tasks. It is TEAM-CONTEXT only
-- (not individual work) and has NO owner. Its status and progress are DERIVED
-- live from its child tasks (all done → done, some done → in_progress, none →
-- not_started); nothing is stored, so the rollup is always fresh.
--
-- Linking: tasks gain milestone_id. "Remove from milestone" = set it NULL — the
-- task survives as a standalone task (loses its label), it is never deleted.
-- Deleting a milestone (ON DELETE SET NULL) likewise orphans its tasks back to
-- standalone rather than destroying them.
--
-- Authority: only the team professor / admin create, edit, delete milestones.
-- "Add/remove tasks" is an UPDATE of tasks.milestone_id, already governed by the
-- Phase-1 tasks_prof_write policy (prof/admin-only writes; students have no
-- direct UPDATE/INSERT on tasks) — so no extra task policy is needed here.
--
-- NOT in this migration (Phase 3+): assignment→task auto-link, contribution %,
-- due-date logic, individual-context milestones.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.milestones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title      text NOT NULL,
  order_idx  smallint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_team ON public.milestones(team_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.milestones;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- task → milestone link. NULL = standalone task (Phase 1 behaviour, unchanged).
-- ON DELETE SET NULL: deleting a milestone returns its tasks to standalone.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON public.tasks(milestone_id);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- read: team-context — team members + the team professor + admin (mirrors
-- tasks_select). Non-team-members cannot see a team's milestones.
CREATE POLICY milestones_select ON public.milestones
  FOR SELECT TO authenticated
  USING (is_team_member(team_id) OR is_team_professor(team_id) OR is_admin());

-- create / edit / delete: team professor or admin only (mirrors tasks_prof_write).
CREATE POLICY milestones_prof_write ON public.milestones
  FOR ALL TO authenticated
  USING      (is_team_professor(team_id) OR is_admin())
  WITH CHECK (is_team_professor(team_id) OR is_admin());
