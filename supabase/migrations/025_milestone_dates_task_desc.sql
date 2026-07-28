-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- 025_milestone_dates_task_desc.sql — give milestones a professor-set due date
-- and tasks an optional one-line description.
--
-- Why now: the AI brief-to-draft flow (Step 1) lets a professor review a drafted
-- plan and set milestone due dates + edit task descriptions before confirming.
-- The existing createMilestone/createTask paths write these columns; both are
-- nullable so every current caller (which passes neither) keeps working and no
-- backfill is needed.
--
-- Additive + idempotent. No RLS changes: writes are still governed by the
-- existing milestones_prof_write / tasks_prof_write policies (professor/admin
-- only). Safe to run in the Supabase SQL editor.

-- milestones.due_at — the ONLY date on the plan. Nullable: a milestone may have
-- no deadline, and the AI never sets it (dates are the professor's alone).
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

-- tasks.description — short, one-line context. Nullable; standalone Phase-1
-- tasks and auto/subtask-mirror tasks continue to pass no description.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text;
