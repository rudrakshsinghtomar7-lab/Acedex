// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Phase 2 — Milestones as team-context containers (migration 020). A milestone
// holds tasks and has NO owner. Status + progress are DERIVED from child tasks
// (never stored) so they recalc live as tasks are added/removed/completed.
//
// Reuses, not reinvents: the same team-context RLS helpers as Phase 1
// (milestones_select / milestones_prof_write mirror tasks_select /
// tasks_prof_write). "Add/remove task" is an UPDATE of tasks.milestone_id,
// already governed by the Phase-1 tasks_prof_write policy. Tasks inside a
// milestone keep the same three-mode assignee system.
//
// NOT here (Phase 3+): assignment→task auto-link, contribution %, due-date logic.

const MILESTONE_SELECT = `
  id, team_id, title, due_at, order_idx, created_by, created_at, updated_at,
  tasks:tasks!tasks_milestone_id_fkey(
    id, team_id, milestone_id, title, status, done, assignee_mode, leader_id, created_at,
    assignees:task_assignees(
      id, student_id,
      student:profiles!task_assignees_student_id_fkey(id, full_name, avatar_url, role)
    )
  )
`;

// Pure rollup from child tasks. all done → done; some done → in_progress;
// none done (incl. empty) → not_started. progress = fraction of tasks done.
export function milestoneRollup(tasks = []) {
  const total = tasks.length;
  const doneCount = tasks.filter(t => (t.status ?? (t.done ? 'done' : 'not_started')) === 'done').length;
  let status = 'not_started';
  if (total > 0 && doneCount === total) status = 'done';
  else if (doneCount > 0) status = 'in_progress';
  return { status, doneCount, total, progress: total ? doneCount / total : 0 };
}

export async function listTeamMilestones(supabase, teamId) {
  const { data, error } = await supabase
    .from('milestones')
    .select(MILESTONE_SELECT)
    .eq('team_id', teamId)
    .order('order_idx', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Professor-only (RLS: milestones_prof_write). `dueAt` is the professor's
// deadline (ISO string) or null — the AI draft never sets it.
export async function createMilestone(supabase, { teamId, createdBy, title, orderIdx = 0, dueAt = null }) {
  const { data, error } = await supabase
    .from('milestones')
    .insert({ team_id: teamId, created_by: createdBy, title: title.trim(), order_idx: orderIdx, due_at: dueAt || null })
    .select(MILESTONE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMilestone(supabase, { milestoneId, title }) {
  const { data, error } = await supabase
    .from('milestones')
    .update({ title: title.trim() })
    .eq('id', milestoneId)
    .select(MILESTONE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// Deleting a milestone returns its tasks to standalone (FK ON DELETE SET NULL)
// — it never deletes the tasks.
export async function deleteMilestone(supabase, milestoneId) {
  const { error } = await supabase.from('milestones').delete().eq('id', milestoneId);
  if (error) throw error;
}

// Add an existing task to a milestone. Prof/admin only (tasks_prof_write).
export async function addTaskToMilestone(supabase, { taskId, milestoneId }) {
  const { error } = await supabase
    .from('tasks')
    .update({ milestone_id: milestoneId })
    .eq('id', taskId);
  if (error) throw error;
}

// Remove a task from its milestone → it becomes a standalone task again. The
// task row is NOT deleted (milestone_id set to NULL). Touches nothing else.
export async function removeTaskFromMilestone(supabase, taskId) {
  const { error } = await supabase
    .from('tasks')
    .update({ milestone_id: null })
    .eq('id', taskId);
  if (error) throw error;
}
