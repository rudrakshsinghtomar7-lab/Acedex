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

// Permanent, full delete of a project (team) and everything under it.
// Permissions are enforced at the DB: teams_delete allows only the course
// professor or an admin; FK ON DELETE CASCADE removes every descendant
// (team_members, assignments + subtasks/assignees/leaders, submissions,
// tasks + task_assignees, milestones, pdf_documents + annotations/access_log,
// ai_analyses/findings, resources, contributions, activity_events, invitations).
// FK cascade can't reach the PDF binaries in storage, so we clean those up
// app-side (best-effort) after the row delete.
export async function deleteProject(supabase, teamId) {
  // Read the PDF storage paths BEFORE the cascade removes pdf_documents rows.
  const { data: pdfs } = await supabase
    .from('pdf_documents').select('storage_path').eq('team_id', teamId);
  const paths = (pdfs ?? []).map(p => p.storage_path).filter(Boolean);

  // Delete the project. RLS gates this to prof/admin; the cascade does the rest.
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;

  // Best-effort: remove the now-orphaned PDF binaries from the bucket. A storage
  // hiccup must not resurrect the (already deleted) project, so we swallow it.
  if (paths.length) {
    try { await supabase.storage.from('pdfs').remove(paths); }
    catch { /* non-critical — rows are already gone */ }
  }
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
