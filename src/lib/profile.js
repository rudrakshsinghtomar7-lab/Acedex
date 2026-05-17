export const STUDENT_FIELDS = 'profile_id, student_id_number, major, minor, year, gpa, graduation_year, skills, interests';
export const PROFESSOR_FIELDS = 'profile_id, employee_id, department, title, office_location, office_hours, research_areas, homepage_url';

export async function loadExtension(supabase, profileId, role) {
  const table = role === 'professor' ? 'professor_profiles' : 'student_profiles';
  const cols = role === 'professor' ? PROFESSOR_FIELDS : STUDENT_FIELDS;
  const { data, error } = await supabase.from(table).select(cols).eq('profile_id', profileId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadProfileById(supabase, id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, university_id, role, email, full_name, avatar_url, bio')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadUniversities(supabase) {
  const { data, error } = await supabase
    .from('universities')
    .select('id, name, slug, domain')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function saveProfile(supabase, { profileId, role, profileUpdate, extUpdate }) {
  const { error: pErr } = await supabase.from('profiles').update(profileUpdate).eq('id', profileId);
  if (pErr) throw pErr;
  const table = role === 'professor' ? 'professor_profiles' : 'student_profiles';
  const { error: eErr } = await supabase.from(table).update(extUpdate).eq('profile_id', profileId);
  if (eErr) throw eErr;
}

function percent(checks) {
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export function studentCompleteness(profile, ext) {
  return percent([
    !!profile?.full_name,
    !!profile?.university_id,
    (ext?.interests?.length ?? 0) > 0,
    !!ext?.major,
  ]);
}

export function professorCompleteness(profile, ext) {
  return percent([
    !!profile?.full_name,
    !!profile?.university_id,
    !!ext?.title,
    !!ext?.department && ext.department !== 'TBD',
    (ext?.research_areas?.length ?? 0) > 0,
  ]);
}

export function completenessFor(profile, ext) {
  if (profile?.role === 'professor') return professorCompleteness(profile, ext);
  return studentCompleteness(profile, ext);
}
