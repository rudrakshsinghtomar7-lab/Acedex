import { uploadPdfDocument } from './pdfs.js';

const ASSIGNMENT_SELECT = `
  id, team_id, title, description, due_at, owner_id, status, order_idx,
  assignment_type, max_points, deadline_type, grace_days,
  ai_plagiarism_check, distribution_mode,
  team_points_awarded, team_letter_grade, team_feedback, team_graded_at,
  created_at, updated_at,
  owner:profiles!assignments_owner_id_fkey(id, full_name, avatar_url, role)
`;

// Dual-grade model (migration 016): per-student grade lives on assignees.
// RLS on assignment_assignees only lets a student SELECT their own row.
const OWN_ASSIGNEE_SELECT = `
  id, assignment_id, student_id, points_awarded, letter_grade, feedback,
  graded_at
`;

const SUBTASK_SELECT = `
  id, assignment_id, title, description,
  assigned_to, assigned_by, claimed_at, status, pdf_document_id, created_at,
  assignee:profiles!assignment_subtasks_assigned_to_fkey(id, full_name, avatar_url, role)
`;

const LEADER_SELECT = `
  id, assignment_id, leader_id, designated_by, designated_at,
  leader:profiles!assignment_leaders_leader_id_fkey(id, full_name, avatar_url, role)
`;

const SUBMISSION_SELECT = `
  id, assignment_id, team_id, submitter_id, status, version,
  notes, feedback, pdf_document_id, storage_path,
  points_awarded, letter_grade,
  submitted_at, reviewed_at, reviewed_by, created_at, updated_at,
  submitter:profiles!submissions_submitter_id_fkey(id, full_name, avatar_url, role),
  reviewer:profiles!submissions_reviewed_by_fkey(id, full_name, avatar_url, role),
  pdf:pdf_documents!submissions_pdf_document_id_fkey(id, title, storage_path, file_size_bytes, page_count)
`;

const ASSIGNEE_SELECT = `
  id, assignment_id, student_id, assigned_at,
  student:profiles!assignment_assignees_student_id_fkey(id, full_name, avatar_url, role)
`;

export async function listTeamAssignments(supabase, teamId) {
  const { data, error } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('team_id', teamId)
    .order('order_idx', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

// Creates the assignment row + (when team mode) its subtasks + (when
// team_leader mode) the assignment_leaders row. We do this sequentially
// rather than in a single RPC because Supabase doesn't expose a transactional
// multi-table insert here — best-effort; partial failure is surfaced to the
// caller and the orphan row can be re-cleaned manually.
export async function createAssignment(supabase, opts) {
  const {
    teamId, ownerId, title,
    description = null, dueAt = null, orderIdx = 0,
    assignmentType = 'individual',
    maxPoints = null,
    deadlineType = null,
    graceDays = null,
    aiPlagiarismCheck = false,
    distributionMode = null,
    subtasks = [],
    leaderId = null,
    assigneeIds = [],
  } = opts;

  const payload = {
    team_id: teamId,
    owner_id: ownerId,
    title: title.trim(),
    description: description?.trim() || null,
    due_at: dueAt || null,
    order_idx: orderIdx,
    status: 'active',
    assignment_type: assignmentType,
    max_points: maxPoints,
    deadline_type: deadlineType,
    grace_days: deadlineType === 'grace' ? graceDays : null,
    ai_plagiarism_check: !!aiPlagiarismCheck,
    distribution_mode: assignmentType === 'team' ? distributionMode : null,
  };

  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert(payload)
    .select(ASSIGNMENT_SELECT)
    .single();
  if (error) throw error;

  if (assignmentType === 'team' && subtasks.length > 0) {
    const rows = subtasks.map(s => ({
      assignment_id: assignment.id,
      title: s.title.trim(),
      description: s.description?.trim() || null,
      assigned_to: distributionMode === 'professor' ? (s.assignedTo || null) : null,
      assigned_by: distributionMode === 'professor' ? ownerId : null,
      status: 'open',
    }));
    const { error: subErr } = await supabase.from('assignment_subtasks').insert(rows);
    if (subErr) throw subErr;
  }

  if (assignmentType === 'team' && distributionMode === 'team_leader' && leaderId) {
    const { error: leadErr } = await supabase
      .from('assignment_leaders')
      .insert({ assignment_id: assignment.id, leader_id: leaderId, designated_by: ownerId });
    if (leadErr) throw leadErr;
  }

  // Individual mode: insert the subset of team members the prof selected as
  // assignees. Empty array = leave the join table empty, which the read side
  // interprets as "every team member" (back-compat with PR-A assignments).
  if (assignmentType === 'individual' && assigneeIds.length > 0) {
    const rows = assigneeIds.map(sid => ({
      assignment_id: assignment.id,
      student_id: sid,
    }));
    const { error: asgErr } = await supabase.from('assignment_assignees').insert(rows);
    if (asgErr) throw asgErr;
  }

  return assignment;
}

// Fetch the caller's own assignee rows for a whole team in one query. RLS
// will already filter to their own rows, but we still pass student_id to keep
// it cheap. Returns a map keyed by assignment_id.
export async function listOwnAssigneesForTeam(supabase, teamId, studentId) {
  if (!studentId) return {};
  const { data, error } = await supabase
    .from('assignment_assignees')
    .select(`${OWN_ASSIGNEE_SELECT}, assignment:assignments!inner(team_id)`)
    .eq('assignment.team_id', teamId)
    .eq('student_id', studentId);
  if (error) throw error;
  const map = {};
  for (const row of data ?? []) map[row.assignment_id] = row;
  return map;
}

export async function listAssigneesForAssignment(supabase, assignmentId) {
  const { data, error } = await supabase
    .from('assignment_assignees')
    .select(ASSIGNEE_SELECT)
    .eq('assignment_id', assignmentId);
  if (error) throw error;
  return data ?? [];
}

export async function listSubtasksForAssignment(supabase, assignmentId) {
  const { data, error } = await supabase
    .from('assignment_subtasks')
    .select(SUBTASK_SELECT)
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listLeadersForAssignment(supabase, assignmentId) {
  const { data, error } = await supabase
    .from('assignment_leaders')
    .select(LEADER_SELECT)
    .eq('assignment_id', assignmentId);
  if (error) throw error;
  return data ?? [];
}

export async function claimSubtask(supabase, { subtaskId, userId }) {
  const { data, error } = await supabase
    .from('assignment_subtasks')
    .update({
      assigned_to: userId,
      claimed_at: new Date().toISOString(),
      status: 'in_progress',
    })
    .eq('id', subtaskId)
    .is('assigned_to', null)
    .select(SUBTASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// Leader assigns one open subtask to a specific student. Updates assigned_to
// + assigned_by and bumps status to 'in_progress'.
export async function assignSubtaskTo(supabase, { subtaskId, assigneeId, leaderId }) {
  const { data, error } = await supabase
    .from('assignment_subtasks')
    .update({
      assigned_to: assigneeId,
      assigned_by: leaderId,
      status: 'in_progress',
    })
    .eq('id', subtaskId)
    .select(SUBTASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubtaskStatus(supabase, { subtaskId, status, pdfDocumentId }) {
  const patch = { status };
  if (pdfDocumentId !== undefined) patch.pdf_document_id = pdfDocumentId;
  const { data, error } = await supabase
    .from('assignment_subtasks')
    .update(patch)
    .eq('id', subtaskId)
    .select(SUBTASK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function designateLeader(supabase, { assignmentId, leaderId, designatedBy }) {
  const { data, error } = await supabase
    .from('assignment_leaders')
    .insert({ assignment_id: assignmentId, leader_id: leaderId, designated_by: designatedBy })
    .select(LEADER_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function listSubmissionsForAssignment(supabase, assignmentId) {
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_SELECT)
    .eq('assignment_id', assignmentId)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Submitter's own submissions across a team — used to render "your submission"
// state on the assignment list without paginating through every assignment.
export async function listOwnSubmissionsForTeam(supabase, teamId, submitterId) {
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_SELECT)
    .eq('team_id', teamId)
    .eq('submitter_id', submitterId)
    .order('version', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Upload a PDF + insert the submission row that references it. version is
// computed server-side via SELECT coalesce(max(version), 0) + 1 so concurrent
// submits don't collide. Initial submission (v1) lands as 'submitted';
// resubmissions (v2+) land as 'under_review' to signal the prof needs to
// re-grade. Old rows are never overwritten — each version is its own row.
export async function submitAssignmentPdf(supabase, { teamId, assignmentId, submitterId, file, notes = null }) {
  const pdf = await uploadPdfDocument(supabase, {
    teamId,
    userId: submitterId,
    assignmentId,
    file,
  });

  const { data: existing, error: versionErr } = await supabase
    .from('submissions')
    .select('version')
    .eq('assignment_id', assignmentId)
    .eq('submitter_id', submitterId)
    .order('version', { ascending: false })
    .limit(1);
  if (versionErr) throw versionErr;
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  const status = nextVersion === 1 ? 'submitted' : 'under_review';

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      team_id: teamId,
      submitter_id: submitterId,
      status,
      version: nextVersion,
      notes,
      pdf_document_id: pdf.id,
      storage_path: pdf.storage_path,
      submitted_at: new Date().toISOString(),
    })
    .select(SUBMISSION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// Professor reviews a submission — flips status and writes feedback. The
// migration-008 trigger fans out a 'submission_reviewed' notification to
// the submitter.
export async function reviewSubmission(supabase, { submissionId, reviewerId, status, feedback, pointsAwarded = null }) {
  // resubmit_requested is the new canonical name (migration 017); the
  // legacy needs_resubmission alias is still accepted for back-compat.
  if (!['approved', 'rejected', 'needs_resubmission', 'resubmit_requested'].includes(status)) {
    throw new Error(`Invalid review status: ${status}`);
  }
  const patch = {
    status,
    feedback: feedback?.trim() || null,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  };
  // points_awarded is only sent when the prof actually scored the submission.
  // The set_letter_grade_from_points BEFORE-UPDATE trigger fills letter_grade
  // automatically, so we don't include it in the client payload.
  if (pointsAwarded !== null && pointsAwarded !== '' && pointsAwarded !== undefined) {
    patch.points_awarded = Number(pointsAwarded);
  }
  const { data, error } = await supabase
    .from('submissions')
    .update(patch)
    .eq('id', submissionId)
    .select(SUBMISSION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// Pure-frontend mirror of the DB function for demo mode (no DB round-trip).
export function letterGradeFor(points, maxPoints) {
  if (maxPoints == null || maxPoints <= 0 || points == null) return null;
  const pct = (Number(points) / Number(maxPoints)) * 100;
  if (pct >= 85) return 'HD';
  if (pct >= 75) return 'D';
  if (pct >= 65) return 'C';
  if (pct >= 50) return 'P';
  return 'F';
}

const STATUS_LABEL = {
  draft:              'Draft',
  submitted:          'Submitted',
  under_review:       'Under review',
  reviewed:           'Reviewed',
  returned:           'Returned',
  approved:           'Approved',
  rejected:           'Rejected',
  needs_resubmission: 'Resubmit',
  resubmit_requested: 'Resubmit',
};

export function submissionStatusLabel(status) {
  return STATUS_LABEL[status] ?? status;
}

// Active by default; flips to 'late' when due_at is in the past and no
// terminal status has been recorded. Used to badge the row without a
// background job.
export function effectiveAssignmentStatus(a) {
  if (a.status === 'done' || a.status === 'archived') return a.status;
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return 'late';
  return a.status || 'active';
}
