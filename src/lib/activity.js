const ACTIVITY_SELECT = `
  id, event_type, target_type, target_id, metadata, occurred_at,
  actor:profiles!activity_events_profile_id_fkey(id, full_name, avatar_url)
`;

export async function listTeamActivity(supabase, teamId, limit = 50) {
  const { data, error } = await supabase
    .from('activity_events')
    .select(ACTIVITY_SELECT)
    .eq('team_id', teamId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// PDF uploads aren't mirrored into activity_events, so we read pdf_documents
// directly and shape each row to look like a synthetic 'pdf_upload' event.
// metadata.assignment_title is null when the upload isn't linked to a task,
// which describeEvent uses to fall back to "this project".
export async function listTeamPdfUploads(supabase, teamId, limit = 50) {
  const { data, error } = await supabase
    .from('pdf_documents')
    .select(`
      id, title, created_at, assignment_id,
      uploader:profiles!pdf_documents_uploaded_by_fkey(id, full_name, avatar_url),
      assignment:assignments!pdf_documents_assignment_id_fkey(id, title)
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(pdf => ({
    id: `pdf-${pdf.id}`,
    event_type: 'pdf_upload',
    target_type: 'pdf_document',
    target_id: pdf.id,
    metadata: {
      title: pdf.title,
      assignment_title: pdf.assignment?.title ?? null,
    },
    occurred_at: pdf.created_at,
    actor: pdf.uploader,
  }));
}

const RELATIVE_THRESHOLDS = [
  [60, 'Just now'],
  [3600, 'm'],
  [86400, 'h'],
];

export function relativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  for (const [threshold, unit] of RELATIVE_THRESHOLDS) {
    if (sec < threshold) {
      if (unit === 'Just now') return unit;
      const val = unit === 'm' ? Math.floor(sec / 60) : Math.floor(sec / 3600);
      return `${val}${unit} ago`;
    }
  }
  const days = Math.floor(sec / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "2:34 PM" — used in pdf_upload rows where the spec calls for actual clock
// time inline instead of a relative timestamp.
export function formatClockTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function describeEvent(ev) {
  const actor = ev.actor?.full_name ?? 'Someone';
  switch (ev.event_type) {
    case 'team_join':         return `${actor} joined the team`;
    case 'team_leave':        return `${actor} left the team`;
    case 'team_invite_sent':  {
      const target = ev.metadata?.invitee_email || ev.metadata?.invitee_profile_id;
      return target ? `${actor} sent an invitation` : `${actor} sent an invitation`;
    }
    case 'upload':            return `${actor} uploaded a document`;
    case 'pdf_upload': {
      const target = ev.metadata?.assignment_title;
      const time = formatClockTime(ev.occurred_at);
      const where = target ? `"${target}"` : 'this project';
      return `${actor} uploaded PDF file to ${where} at ${time}`;
    }
    case 'submission':        return `${actor} submitted work`;
    case 'task_create':       return `${actor} created a task`;
    case 'task_done':         return `${actor} completed a task`;
    case 'comment':           return `${actor} commented`;
    case 'annotation':        return `${actor} added an annotation`;
    case 'viewed_pdf':        return `${actor} viewed a document`;
    case 'login':             return `${actor} signed in`;
    default:                  return `${actor} — ${ev.event_type}`;
  }
}
