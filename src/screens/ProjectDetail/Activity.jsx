import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/SessionProvider.jsx';
import Avatar from '../../components/Avatar.jsx';
import { describeEvent, listTeamActivity, relativeTime } from '../../lib/activity.js';

export default function Activity({ project }) {
  const { supabase } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setError(null);
    listTeamActivity(supabase, project.id)
      .then(d => { if (!cancelled) setRows(d); })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [supabase, project?.id]);

  if (error) {
    return (
      <div className="empty">
        <div className="empty-h">Couldn't load activity</div>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{error}</p>
      </div>
    );
  }

  if (rows === null) {
    return <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>;
  }

  if (rows.length === 0) {
    return <div className="empty"><div className="empty-i">◐</div><div className="empty-h">No activity yet</div></div>;
  }

  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Recent activity</div>
      {rows.map(ev => (
        <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          {ev.actor?.full_name
            ? <Avatar name={ev.actor.full_name} size={32}/>
            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--indigo)', marginTop: 10, flexShrink: 0, boxShadow: '0 0 0 3px rgba(124,108,255,.15)' }}/>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{describeEvent(ev)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 3, fontWeight: 500 }}>{relativeTime(ev.occurred_at)}</div>
          </div>
        </div>
      ))}
    </>
  );
}
