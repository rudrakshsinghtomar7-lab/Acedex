import { useEffect, useMemo, useState } from 'react';
import AssignmentCreateModal from '../../components/AssignmentCreateModal.jsx';
import AssignmentDetailModal from '../../components/AssignmentDetailModal.jsx';
import FilterChips from '../../components/FilterChips.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import {
  effectiveAssignmentStatus,
  listOwnSubmissionsForTeam,
  listTeamAssignments,
  submissionStatusLabel,
} from '../../lib/assignments.js';
import { formatRelativeTime } from '../../lib/pdfs.js';

const FILTERS = [
  ['all',       'All'],
  ['open',      'Open'],
  ['submitted', 'Submitted'],
  ['reviewed',  'Reviewed'],
  ['late',      'Late'],
];

const DIST_LABEL = {
  professor:   'Prof assigns',
  team_leader: 'Leader assigns',
  self_pick:   'Self-pick',
};

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
  const [submissionCounts, setSubmissionCounts] = useState({}); // { [assignmentId]: { submitted, total } }
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  async function load() {
    setError(null);
    if (isDemo) {
      const list = (project.assignments ?? []).map(adaptDemoAssignment);
      setRows(list);
      const map = {};
      const counts = {};
      const totalMembers = (project.memberRecords ?? []).length || (project.members?.length ?? 0);
      for (const a of list) {
        const subs = a.submissions ?? [];
        const own = subs.filter(s => s.submitter_id === 'demo-student-1');
        if (own.length) map[a.id] = own[0];
        // For prof counts: unique submitters with status != draft.
        const distinct = new Set(subs.filter(s => s.status !== 'draft').map(s => s.submitter_id));
        counts[a.id] = { submitted: distinct.size, total: totalMembers };
      }
      setMySubmissions(map);
      setSubmissionCounts(counts);
      return;
    }
    try {
      const [list, mine] = await Promise.all([
        listTeamAssignments(supabase, project.id),
        user?.id ? listOwnSubmissionsForTeam(supabase, project.id, user.id) : Promise.resolve([]),
      ]);
      setRows(list);
      const map = {};
      for (const s of mine) if (!map[s.assignment_id]) map[s.assignment_id] = s;
      setMySubmissions(map);
      // Submission counts are lazy — we fetch a head-count per assignment in
      // parallel. Skipped if there are no assignments to avoid noise.
      if (list.length > 0 && isProfessor) {
        const totalMembers = (project.memberRecords ?? []).length || 1;
        const counts = {};
        await Promise.all(list.map(async (a) => {
          const { count } = await supabase
            .from('submissions')
            .select('submitter_id', { count: 'exact', head: true })
            .eq('assignment_id', a.id)
            .neq('status', 'draft');
          counts[a.id] = { submitted: count ?? 0, total: totalMembers };
        }));
        setSubmissionCounts(counts);
      }
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

  // Filter pipeline. 'open' = not yet submitted by me (student) or assignment
  // accepting submissions (prof). 'submitted' / 'reviewed' look at my latest
  // submission (student) or any submission state (prof). 'late' uses the
  // computed effectiveAssignmentStatus.
  const filtered = useMemo(() => {
    if (!rows) return null;
    if (filter === 'all') return rows;
    return rows.filter(a => {
      const eff = effectiveAssignmentStatus(a);
      const mine = mySubmissions[a.id];
      switch (filter) {
        case 'late':      return eff === 'late';
        case 'open':      return isProfessor ? eff !== 'done' : !mine;
        case 'submitted': return mine ? mine.status === 'submitted' : false;
        case 'reviewed':  return mine ? ['approved','rejected','needs_resubmission','reviewed'].includes(mine.status) : false;
        default:          return true;
      }
    });
  }, [rows, filter, mySubmissions, isProfessor]);

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

      {rows && rows.length > 0 && (
        <FilterChips items={FILTERS} active={filter} onChange={setFilter} className="asgn-filter-chips"/>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-i">⌕</div>
          <div className="empty-h">No matches</div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing in the "{FILTERS.find(([k]) => k === filter)?.[1] ?? filter}" bucket.</p>
        </div>
      ) : (
        <div className="asgn-grid">
          {filtered.map(a => {
            const eff = effectiveAssignmentStatus(a);
            const mine = mySubmissions[a.id];
            const counts = submissionCounts[a.id];
            const isTeam = a.assignment_type === 'team';
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

                <div className="asgn-row-pills">
                  {a.assignment_type && (
                    <span className={`asgn-type-chip asgn-type-${a.assignment_type}`}>
                      {a.assignment_type === 'team' ? 'Team' : 'Individual'}
                    </span>
                  )}
                  {isTeam && a.distribution_mode && (
                    <span className="asgn-dist-chip">{DIST_LABEL[a.distribution_mode] ?? a.distribution_mode}</span>
                  )}
                  {isProfessor && counts && (
                    <span className="asgn-count-chip" title={`${counts.submitted} of ${counts.total} team members submitted`}>
                      {counts.submitted}/{counts.total} submitted
                    </span>
                  )}
                </div>

                {a.description && (
                  <div className="asgn-row-desc">{a.description}</div>
                )}

                {!isProfessor && (
                  <div className="asgn-mine">
                    {mine ? (
                      <>
                        Your submission · <strong>{submissionStatusLabel(mine.status)}</strong>
                        {mine.submitted_at ? ` · ${formatRelativeTime(mine.submitted_at)}` : ''}
                        {mine.letter_grade && (
                          <span className={`grade-badge grade-${mine.letter_grade.toLowerCase()}`} style={{ marginLeft: 8 }}>
                            {mine.letter_grade}
                            {mine.points_awarded != null && a.max_points
                              ? <span className="grade-pts">{Number(mine.points_awarded)}/{a.max_points}</span>
                              : null}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>Not submitted yet</span>
                    )}
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
