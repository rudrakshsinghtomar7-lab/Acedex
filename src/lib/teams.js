// © 2026 Rudraksh Singh Tomar. All rights reserved.
const TEAM_LIST_SELECT = `
  id, name, description, status, progress, due_date, created_at, course_id,
  course:courses(id, code, name, term, year, professor_id),
  members:team_members(profile_id, role_in_team, profile:profiles(id, full_name, avatar_url))
`;

const TEAM_DETAIL_SELECT = `
  id, name, description, status, progress, due_date, created_at,
  course:courses(id, code, name, term, year, professor_id,
    professor:profiles(id, full_name, avatar_url, role))
`;

export async function listTeamsForUser(supabase, { role, userId }) {
  if (role === 'professor') {
    const { data: courses, error } = await supabase
      .from('courses').select('id').eq('professor_id', userId);
    if (error) throw error;
    const ids = (courses ?? []).map(c => c.id);
    if (ids.length === 0) return [];
    const { data, error: tErr } = await supabase
      .from('teams').select(TEAM_LIST_SELECT).in('course_id', ids)
      .order('created_at', { ascending: false });
    if (tErr) throw tErr;
    return data ?? [];
  }
  const { data: rows, error } = await supabase
    .from('team_members').select('team_id').eq('profile_id', userId);
  if (error) throw error;
  const ids = (rows ?? []).map(r => r.team_id);
  if (ids.length === 0) return [];
  const { data, error: tErr } = await supabase
    .from('teams').select(TEAM_LIST_SELECT).in('id', ids)
    .order('created_at', { ascending: false });
  if (tErr) throw tErr;
  return data ?? [];
}

export async function getTeamDetail(supabase, teamId) {
  const { data: team, error } = await supabase
    .from('teams').select(TEAM_DETAIL_SELECT).eq('id', teamId).maybeSingle();
  if (error) throw error;
  if (!team) return null;
  const { data: members, error: mErr } = await supabase
    .from('team_members')
    .select('role_in_team, joined_at, profile:profiles(id, full_name, avatar_url, role)')
    .eq('team_id', teamId)
    .order('joined_at');
  if (mErr) throw mErr;
  return { team, members: members ?? [] };
}

export async function listProfessorCourses(supabase, professorId) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, code, name, term, year')
    .eq('professor_id', professorId)
    .order('year', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCourse(supabase, fields) {
  const { data, error } = await supabase
    .from('courses').insert(fields)
    .select('id, code, name, term, year').single();
  if (error) throw error;
  return data;
}

export async function createTeam(supabase, fields) {
  const { data, error } = await supabase
    .from('teams').insert(fields).select('id').single();
  if (error) throw error;
  return data;
}

function fmtDate(iso) {
  if (!iso) return null;
  // Plain YYYY-MM-DD parses as UTC midnight, which can shift to the previous day
  // in negative-UTC zones when rendered via toLocaleDateString. Force local midnight.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(isDateOnly ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function loadHomeStatsForProfessor(supabase, professorId) {
  const { data: courses, error: cErr } = await supabase
    .from('courses').select('id').eq('professor_id', professorId);
  if (cErr) throw cErr;
  const courseIds = (courses ?? []).map(c => c.id);
  if (courseIds.length === 0) return { projects: 0, students: 0, atRisk: 0 };

  const { data: teams, error: tErr } = await supabase
    .from('teams').select('id, status').in('course_id', courseIds);
  if (tErr) throw tErr;
  const teamRows = teams ?? [];
  const atRisk = teamRows.filter(t => t.status === 'at_risk').length;
  if (teamRows.length === 0) return { projects: 0, students: 0, atRisk: 0 };

  const teamIds = teamRows.map(t => t.id);
  const { data: members, error: mErr } = await supabase
    .from('team_members').select('profile_id').in('team_id', teamIds);
  if (mErr) throw mErr;
  const distinct = new Set((members ?? []).map(m => m.profile_id));

  return { projects: teamRows.length, students: distinct.size, atRisk };
}

export async function loadHomeStatsForStudent(supabase, studentId) {
  const { count, error } = await supabase
    .from('team_members')
    .select('team_id, teams!inner(status)', { count: 'exact', head: true })
    .eq('profile_id', studentId)
    .eq('teams.status', 'active');
  if (error) throw error;
  return { projects: count ?? 0 };
}

// Delete every listed object from one bucket, failing loudly if any survives.
//
// storage.remove() does NOT report a path it could not delete: RLS-denied and
// already-absent paths are both just omitted from the returned list, with no
// error. That silence is the dangerous case for retention — a denied delete
// looked like a clean one. So we re-check anything unremoved and only tolerate
// it if it is genuinely gone. Throwing here (before the team delete) is
// deliberate: it keeps the metadata rows that authorize these deletes alive,
// so a retry can still reach the files.
async function removeAllOrThrow(supabase, bucket, paths) {
  if (!paths.length) return;

  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;

  const removed = new Set((data ?? []).map(o => o.name));
  const unremoved = paths.filter(p => !removed.has(p));
  if (!unremoved.length) return;

  const survivors = [];
  for (const path of unremoved) {
    const cut = path.lastIndexOf('/');
    const { data: listed } = await supabase.storage.from(bucket)
      .list(path.slice(0, cut), { search: path.slice(cut + 1) });
    if ((listed ?? []).some(o => o.name === path.slice(cut + 1))) survivors.push(path);
  }
  if (survivors.length) {
    throw new Error(
      `Storage cleanup incomplete: ${survivors.length} object(s) could not be removed ` +
      `from '${bucket}' (${survivors.join(', ')}). Project not deleted, so the rows ` +
      `authorizing their removal still exist — retry or clear them first.`
    );
  }
}

// Permanent, full delete of a project (team) and everything under it.
// Permissions are enforced at the DB: teams_delete allows only the course
// professor or an admin; FK ON DELETE CASCADE removes every descendant
// (team_members, assignments + subtasks/assignees/leaders, submissions,
// tasks + task_assignees, milestones, pdf_documents + annotations/access_log,
// ai_analyses/findings, resources, contributions, activity_events, invitations).
//
// FK cascade can't reach the binaries in storage, so we clean those up
// app-side before the row delete.
//
// Three tables under a team hold storage paths, and all three CASCADE on team
// delete, so all three sets of objects must be swept or they leak:
//   pdf_documents.storage_path  → 'pdfs' bucket
//   submissions.storage_path    → 'pdfs' bucket (see below)
//   resources.storage_path      → 'resources' bucket
//
// Submissions live in the 'pdfs' bucket, not 'submissions': submitAssignment
// uploads through uploadPdfDocument, so a submission's storage_path is the
// path of its pdf_documents row. The 'submissions' bucket exists but nothing
// writes to it. Usually that means the pdf sweep already covers a submission —
// but not always: submissions.pdf_document_id is ON DELETE SET NULL, so
// deleting a PDF on its own leaves the submission row holding the only
// reference to that path. Sweeping submissions explicitly (and de-duping
// against the PDF paths) is what makes retention actually hold: a deleted
// student submission must leave the bucket.
export async function deleteProject(supabase, teamId) {
  const [pdfRes, subRes, resRes] = await Promise.all([
    supabase.from('pdf_documents').select('storage_path').eq('team_id', teamId),
    supabase.from('submissions').select('storage_path').eq('team_id', teamId),
    supabase.from('resources').select('storage_path').eq('team_id', teamId),
  ]);
  // A failed lookup would silently under-collect and leak binaries, so treat
  // it as fatal rather than deleting the rows we can no longer trace.
  for (const { error: readErr } of [pdfRes, subRes, resRes]) {
    if (readErr) throw readErr;
  }

  const pathsOf = (rows) => (rows ?? []).map(r => r.storage_path).filter(Boolean);
  // Same bucket, so union + de-dupe: remove() on a path twice is wasteful and
  // makes the second call look like a missing object.
  const pdfBucketPaths = [...new Set([...pathsOf(pdfRes.data), ...pathsOf(subRes.data)])];
  const resourcePaths = [...new Set(pathsOf(resRes.data))];

  // Remove the binaries FIRST — while the metadata rows still exist. Every
  // storage delete policy authorizes via its metadata row (storage_owns_pdf,
  // storage_owns_submission, storage_owns_resource), so removing AFTER the
  // team-delete cascade would be denied and orphan the files. Surface a
  // storage error rather than silently leaking binaries.
  //
  // Caveat on resources: storage_owns_resource only passes for the resource's
  // creator or an admin — unlike pdfs/submissions it has no team-professor
  // clause. Nothing writes resources today, so this cannot bite yet; if the
  // feature is built out, that policy needs a professor clause or a professor
  // deleting a project holding a student's resource will fail here.
  await removeAllOrThrow(supabase, 'pdfs', pdfBucketPaths);
  await removeAllOrThrow(supabase, 'resources', resourcePaths);

  // Now delete the project. RLS gates this to prof/admin; FK cascade removes
  // every descendant row.
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

export function adaptTeam(team, members) {
  const course = team.course;
  const memberList = members ?? team.members ?? [];
  return {
    id: team.id,
    title: team.name,
    description: team.description,
    course: course ? `${course.code} · ${course.name}` : '—',
    courseCode: course?.code,
    courseName: course?.name,
    status: team.status,
    progress: team.progress ?? 0,
    dueDate: fmtDate(team.due_date),
    members: memberList.map(m => m.profile?.full_name).filter(Boolean),
    memberRecords: memberList,
    professor: course?.professor,
    milestones: [],
    tasks: [],
    contributions: [],
    activity: [],
    insights: [],
  };
}
