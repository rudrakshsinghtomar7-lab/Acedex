// © 2026 Rudraksh Singh Tomar. All rights reserved.
export async function inviteToTeam(supabase, { teamId, profileId = null, email = null, message = null }) {
  const { data, error } = await supabase.rpc('invite_to_team', {
    _team_id: teamId,
    _invitee_profile_id: profileId,
    _invitee_email: email,
    _message: message,
  });
  if (error) throw error;
  return data;
}

export async function acceptInvitation(supabase, invitationId) {
  const { data, error } = await supabase.rpc('accept_team_invitation', { _invitation_id: invitationId });
  if (error) throw error;
  return data;
}

export async function declineInvitation(supabase, invitationId) {
  const { error } = await supabase.rpc('decline_team_invitation', { _invitation_id: invitationId });
  if (error) throw error;
}

export async function removeTeamMember(supabase, { teamId, profileId }) {
  const { error } = await supabase.rpc('remove_team_member', { _team_id: teamId, _profile_id: profileId });
  if (error) throw error;
}

export async function findPendingInvitation(supabase, { teamId, recipientId }) {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, team_id, status, invitee_profile_id, invitee_email')
    .eq('team_id', teamId)
    .eq('invitee_profile_id', recipientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchProfiles(supabase, { query, universityId, excludeProfileIds = [], limit = 8 }) {
  const q = query.trim();
  if (!q) return [];
  // ilike on full_name and email; RLS already scopes to same-university for non-admins.
  let req = supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .eq('role', 'student')
    .limit(limit);
  if (universityId) req = req.eq('university_id', universityId);
  const { data, error } = await req;
  if (error) throw error;
  const blocked = new Set(excludeProfileIds);
  return (data ?? []).filter(p => !blocked.has(p.id));
}
