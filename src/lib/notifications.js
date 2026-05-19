const NOTIFICATION_SELECT = `
  id, type, title, body, link, read, read_at, created_at,
  related_team_id, related_assignment_id, related_finding_id,
  team:teams!notifications_related_team_id_fkey(id, name)
`;

export async function listNotifications(supabase, userId, limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadCount(supabase, userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(supabase, id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllAsRead(supabase, userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export async function dismissNotification(supabase, id) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

export function relativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const TYPE_GLYPH = {
  team_invite: '◐',
  mention: '@',
  assignment_due: '◷',
  submission_received: '⊕',
  ai_insight: '✦',
  decision_required: '◇',
  system: '◉',
  pdf_uploaded: '▦',
  pdf_comment: '◗',
};
