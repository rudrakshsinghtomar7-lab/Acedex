// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/SessionProvider.jsx';
import Avatar from '../../components/Avatar.jsx';
import {
  describeEvent,
  listTeamActivity,
  listTeamPdfUploads,
  relativeTime,
} from '../../lib/activity.js';

// Demo projects don't talk to the DB, so synthesize pdf_upload rows directly
// from project.pdfs. Each demo PDF's "uploaded_at" is a short string like
// "Apr 1" — we parse it as 2026 and stamp a deterministic time-of-day so the
// clock-time format in describeEvent has something realistic to render.
function buildDemoActivity(project) {
  if (!project?.pdfs?.length) return [];
  return project.pdfs.map((pdf, i) => {
    const d = new Date(`${pdf.uploaded_at}, 2026`);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(9 + (i * 5) % 9, (i * 23) % 60, 0, 0);
    }
    return {
      id: `demo-pdf-upload-${pdf.id}`,
      event_type: 'pdf_upload',
      target_type: 'pdf_document',
      target_id: pdf.id,
      metadata: { title: pdf.title, assignment_title: null },
      occurred_at: Number.isNaN(d.getTime()) ? null : d.toISOString(),
      actor: { id: null, full_name: pdf.uploaded_by, avatar_url: null },
    };
  });
}

function byOccurredDesc(a, b) {
  return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
}

export default function Activity({ project }) {
  const { supabase } = useAuth();
  const isDemo = typeof project?.id === 'string' && project.id.startsWith('demo-');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setError(null);
    setRows(null);
    if (isDemo) {
      setRows(buildDemoActivity(project).sort(byOccurredDesc));
      return;
    }
    Promise.all([
      listTeamActivity(supabase, project.id),
      listTeamPdfUploads(supabase, project.id),
    ])
      .then(([events, pdfs]) => {
        if (cancelled) return;
        setRows([...events, ...pdfs].sort(byOccurredDesc));
      })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [supabase, project?.id, isDemo, project?.pdfs]);

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
      {rows.map(ev => {
        const isPdfUpload = ev.event_type === 'pdf_upload';
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            {ev.actor?.full_name
              ? <Avatar name={ev.actor.full_name} size={32}/>
              : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--indigo)', marginTop: 10, flexShrink: 0, boxShadow: '0 0 0 3px rgba(124,108,255,.15)' }}/>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {isPdfUpload && <span style={{ marginRight: 6 }} aria-hidden>📄</span>}
                {describeEvent(ev)}
              </div>
              {!isPdfUpload && (
                <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 3, fontWeight: 500 }}>
                  {relativeTime(ev.occurred_at)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
