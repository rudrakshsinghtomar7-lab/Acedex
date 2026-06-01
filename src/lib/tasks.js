// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Phase 1 Tasks — real, DB-backed, team-visible. Wires up the `tasks` table
// (migration 019). Reuses, not reinvents:
//   * the three assignee modes are the same vocabulary as assignments'
//     distribution_mode (migration 009): professor / team_leader / self_pick
//   * Submit routes through the existing PDF flow (uploadPdfDocument) — no new
//     submission path — then flips status via the submit_task RPC
//   * privacy is the existing model: title/assignee/status live on the task row
//     (team-visible via tasks_select); grades/feedback stay in the submission
//     layer under their own RLS and never touch this table.
//
// NOT here (Phase 2/3): milestones, assignment_id auto-linking, contribution %,
// due-date logic.
import { uploadPdfDocument } from './pdfs.js';
import { submitAssignmentPdf } from './assignments.js';

// Same three modes as assignments' distribution_mode (009).
export const TASK_ASSIGNEE_MODES = [
  { value: 'professor',   label: 'Professor assigns' },
  { value: 'team_leader', label: 'Team leader assigns' },
  { value: 'self_pick',   label: 'Students self-pick' },
];

// not_started → in_progress → submitted → done. 'submitted' = student handed
// work in; 'done' = professor approved (only prof/admin can set it, per RLS).
export const TASK_STATUS_LADDER = ['not_started', 'in_progress', 'submitted', 'done'];

const TASK_STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted:   'Submitted',
  done:        'Done',
};
export function taskStatusLabel(status) {
  return TASK_STATUS_LABEL[status] ?? status;
}

const TASK_SELECT = `
  id, team_id, assignment_id, milestone_id, title, status, done, assignee_mode, leader_id,
  created_by, created_at, updated_at,
  assignees:task_assignees(
    id, student_id, assigned_at,
    student:profiles!task_assignees_student_id_fkey(id, full_name, avatar_url, role)
  ),
  milestone:milestones!tasks_milestone_id_fkey(id, title)
`;

// Team-wide list — every task in the team (not just the caller's). RLS
// (tasks_select) already restricts the rowset to team members + the team
// professor + admin, so this is the "glance and see who's doing what" view.
export async function listTeamTasks(supabase, teamId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTask(supabase, taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return data;
}

// Professor-only (RLS: tasks_prof_write). Creates the task, then — in
// professor mode — writes the chosen assignees. team_leader mode stores the
// leader so that person can assign later; self_pick leaves the pool open.
export async function createTask(supabase, {
  teamId, createdBy, title,
  assigneeMode = 'professor', assigneeIds = [], leaderId = null,
  milestoneId = null,
}) {
  const payload = {
    team_id: teamId,
    created_by: createdBy,
    title: title.trim(),
    assignee_mode: assigneeMode,
    leader_id: assigneeMode === 'team_leader' ? (leaderId || null) : null,
    milestone_id: milestoneId || null,
    status: 'not_started',
  };
  const { data: task, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select(TASK_SELECT)
    .single();
  if (error) throw error;

  if (assigneeMode === 'professor' && assigneeIds.length > 0) {
    return setTaskAssignees(supabase, { taskId: task.id, studentIds: assigneeIds, assignedBy: createdBy });
  }
  return task;
}

// Replace the assignee set for a task. Who may call this is enforced by RLS:
// the team professor (task_assignees_prof_write) or, in team_leader mode, the
// task's designated leader (task_assignees_leader_write).
export async function setTaskAssignees(supabase, { taskId, studentIds, assignedBy }) {
  const { error: delErr } = await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (delErr) throw delErr;
  if (studentIds.length > 0) {
    const rows = studentIds.map(sid => ({ task_id: taskId, student_id: sid, assigned_by: assignedBy }));
    const { error } = await supabase.from('task_assignees').insert(rows);
    if (error) throw error;
  }
  return getTask(supabase, taskId);
}

// self_pick: a team member claims the task for themselves
// (task_assignees_self_claim). Inserting any other student_id is rejected.
export async function claimTask(supabase, { taskId, studentId }) {
  const { error } = await supabase
    .from('task_assignees')
    .insert({ task_id: taskId, student_id: studentId });
  if (error) throw error;
  return getTask(supabase, taskId);
}

export async function unclaimTask(supabase, { taskId, studentId }) {
  const { error } = await supabase
    .from('task_assignees')
    .delete()
    .eq('task_id', taskId)
    .eq('student_id', studentId);
  if (error) throw error;
  return getTask(supabase, taskId);
}

// Professor/admin path (RLS: tasks_prof_write). The only way to reach 'done'
// (approve). Students cannot call this — they have no direct UPDATE on tasks.
export async function setTaskStatus(supabase, { taskId, status }) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select(TASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// Student self-advance not_started → in_progress (security-definer RPC; can
// never reach submitted/done).
export async function startTask(supabase, taskId) {
  const { error } = await supabase.rpc('start_task', { p_task_id: taskId });
  if (error) throw error;
  return getTask(supabase, taskId);
}

// Submit work on a task: reuse the existing PDF upload flow, then flip the
// task to 'submitted' via the security-definer RPC (which can never set
// 'done'). assignmentId is passed through for when a task is later linked to a
// milestone/assignment (Phase 3); null for standalone Phase 1 tasks.
export async function submitTask(supabase, { teamId, taskId, userId, file, assignmentId = null }) {
  // Auto-task (Phase 3): mirrors an assignment. Submit through the EXISTING
  // assignment flow — the DB trigger then flips the mirror task to 'submitted'.
  // (submit_task RPC refuses auto-tasks, so this is the only correct path.)
  if (assignmentId) {
    await submitAssignmentPdf(supabase, { teamId, assignmentId, submitterId: userId, file });
    return getTask(supabase, taskId);
  }
  // Standalone Phase-1 task: upload the PDF, then flip status via the RPC.
  await uploadPdfDocument(supabase, { teamId, userId, assignmentId, file });
  const { error } = await supabase.rpc('submit_task', { p_task_id: taskId });
  if (error) throw error;
  return getTask(supabase, taskId);
}
