import { uploadPdfDocument } from './pdfs.js';

const ASSIGNMENT_SELECT = `
  id, team_id, title, description, due_at, owner_id, status, order_idx,
  assignment_type, max_points, deadline_type, grace_days,
  ai_plagiarism_check, distribution_mode,
  created_at, updated_at,
  owner:profiles!assignments_owner_id_fkey(id, full_name, avatar_url, role)
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
  submitted_at, reviewed_at, reviewed_by, created_at, updated_at,
  submitter:profiles!submissions_submitter_id_fkey(id, full_name, avatar_url, role),
  reviewer:profiles!submissions_reviewed_by_fkey(id, full_name, avatar_url, role),
  pdf:pdf_documents!submissions_pdf_document_id_fkey(id, title, storage_path, file_size_bytes, page_count)
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

  return assignment;
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
// submits don't collide.
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

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      team_id: teamId,
      submitter_id: submitterId,
      status: 'submitted',
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
export async function reviewSubmission(supabase, { submissionId, reviewerId, status, feedback }) {
  if (!['approved', 'rejected', 'needs_resubmission'].includes(status)) {
    throw new Error(`Invalid review status: ${status}`);
  }
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status,
      feedback: feedback?.trim() || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select(SUBMISSION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

const STATUS_LABEL = {
  draft:              'Draft',
  submitted:          'Submitted',
  reviewed:           'Reviewed',
  returned:           'Returned',
  approved:           'Approved',
  rejected:           'Rejected',
  needs_resubmission: 'Resubmit',
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
