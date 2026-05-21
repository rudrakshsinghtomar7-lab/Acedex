import { useEffect, useState } from 'react';
import AssignmentCreateModal from '../../components/AssignmentCreateModal.jsx';
import AssignmentDetailModal from '../../components/AssignmentDetailModal.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import {
  effectiveAssignmentStatus,
  listOwnSubmissionsForTeam,
  listTeamAssignments,
  submissionStatusLabel,
} from '../../lib/assignments.js';
import { formatRelativeTime } from '../../lib/pdfs.js';

function adaptDemoAssignment(a) {
  // Demo rows already match the canonical shape (see DEMO_ASSIGNMENTS in
  // demo.js); this adapter is the seam in case the demo schema drifts.
  return a;
}

function dueLabel(due) {
  if (!due) return 'No due date';
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return 'No due date';
  const now = Date.now();
  const diff = d.getTime() - now;
  const abs = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0) return `Due ${abs} · past due`;
  const days = Math.round(diff / 86400000);
  if (days === 0) return `Due today · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days}d`;
  return `Due ${abs}`;
}

export default function Assignments({ project, role }) {
  const { supabase, user } = useAuth();
  const isDemo = typeof project?.id === 'string' && project.id.startsWith('demo-');
  const isProfessor = role === 'professor';

  const [rows, setRows] = useState(null);
  const [mySubmissions, setMySubmissions] = useState({});
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  async function load() {
    setError(null);
    if (isDemo) {
      const list = (project.assignments ?? []).map(adaptDemoAssignment);
      setRows(list);
      // Demo own-submissions live alongside each assignment row.
      const map = {};
      for (const a of list) {
        const own = (a.submissions ?? []).filter(s => s.submitter_id === 'demo-student-1');
        if (own.length) map[a.id] = own[0];
      }
      setMySubmissions(map);
      return;
    }
    try {
      const [list, mine] = await Promise.all([
        listTeamAssignments(supabase, project.id),
        user?.id ? listOwnSubmissionsForTeam(supabase, project.id, user.id) : Promise.resolve([]),
      ]);
      setRows(list);
      // Latest version per assignment (already sorted desc).
      const map = {};
      for (const s of mine) if (!map[s.assignment_id]) map[s.assignment_id] = s;
      setMySubmissions(map);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setRows(null);
    load().catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project?.id, isDemo, project?.assignments]);

  function onCreated(row) {
    setRows(prev => [...(prev ?? []), row]);
    setCreating(false);
  }

  function onSubmissionChanged(row) {
    // Refresh just the affected row; cheap re-pull keeps mySubmissions correct.
    load();
    setDetailRow(prev => (prev?.id === row?.id ? row : prev));
  }

  return (
    <div className="asgn-workspace">
      <div className="pdf-toolbar">
        <div>
          <div className="pdf-kicker">Assignments</div>
          <div className="pdf-title">
            {rows?.length
              ? `${rows.length} assignment${rows.length === 1 ? '' : 's'}`
              : 'Nothing posted yet'}
          </div>
        </div>
        {isProfessor && (
          <button className="btn btn-p btn-sm" onClick={() => setCreating(true)}>+ New</button>
        )}
      </div>

      {error && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <span>◇</span><div>{error}</div>
        </div>
      )}

      {rows === null ? (
        <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-i">▤</div>
          <div className="empty-h">{isProfessor ? 'Create your first assignment' : 'No assignments yet'}</div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isProfessor
              ? 'Post an assignment so students can submit their work.'
              : 'Your professor hasn\'t posted anything here yet.'}
          </p>
        </div>
      ) : (
        <div className="asgn-grid">
          {rows.map(a => {
            const eff = effectiveAssignmentStatus(a);
            const mine = mySubmissions[a.id];
            return (
              <button
                key={a.id}
                type="button"
                className={`asgn-row asgn-status-${eff}`}
                onClick={() => setDetailRow(a)}
              >
                <div className="asgn-row-top">
                  <div className="asgn-row-main">
                    <div className="asgn-row-title">{a.title}</div>
                    <div className="asgn-row-meta">
                      {a.owner?.full_name ? `${a.owner.full_name} · ` : ''}{dueLabel(a.due_at)}
                    </div>
                  </div>
                  <span className={`asgn-badge asgn-badge-${eff}`}>{eff === 'late' ? 'Late' : eff === 'done' ? 'Done' : 'Open'}</span>
                </div>
                {a.description && (
                  <div className="asgn-row-desc">{a.description}</div>
                )}
                {!isProfessor && (
                  <div className="asgn-mine">
                    {mine
                      ? <>Your submission · <strong>{submissionStatusLabel(mine.status)}</strong>{mine.submitted_at ? ` · ${formatRelativeTime(mine.submitted_at)}` : ''}</>
                      : <span style={{ color: 'var(--muted)' }}>Not submitted yet</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <AssignmentCreateModal
          project={project}
          ownerId={user?.id}
          supabase={supabase}
          isDemo={isDemo}
          onClose={() => setCreating(false)}
          onCreated={onCreated}
        />
      )}

      {detailRow && (
        <AssignmentDetailModal
          project={project}
          assignment={detailRow}
          role={role}
          isDemo={isDemo}
          supabase={supabase}
          user={user}
          onClose={() => setDetailRow(null)}
          onSubmissionChanged={onSubmissionChanged}
        />
      )}
    </div>
  );
}
