import { useEffect, useMemo, useState } from 'react';
import AssignmentCreateModal from '../../components/AssignmentCreateModal.jsx';
import AssignmentDetailModal from '../../components/AssignmentDetailModal.jsx';
import FilterChips from '../../components/FilterChips.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import {
  effectiveAssignmentStatus,
  listOwnAssigneesForTeam,
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

// Student-side filters — by assignment_type. Matches the Phase 1 chip-pill
// style (FilterChips renders the sliding background).
const STUDENT_FILTERS = [
  ['mine', 'My Assignments'],
  ['team', 'Team Assignments'],
];

// Tone bucket for the deadline countdown on student cards.
//   urgent  → <24h until due
//   soon    → <3 days until due
//   muted   → further out, no due date, or already past
function deadlineTone(due) {
  if (!due) return 'muted';
  const ms = new Date(due).getTime() - Date.now();
  if (Number.isNaN(ms) || ms < 0) return 'muted';
  if (ms < 24 * 3600_000) return 'urgent';
  if (ms < 3 * 24 * 3600_000) return 'soon';
  return 'muted';
}

// Six-state derivation for a student's perspective on one assignment.
//   resubmit_needed → prof asked for a new version (per-assignment scope;
//                     never a global student flag — only this row's latest
//                     submission triggers it)
//   late       → due passed and we have no reviewed terminal state
//   reviewed   → latest submission is in a reviewed terminal bucket OR
//                prof has written an individual grade. Team assignments
//                where the student themselves didn't submit still land
//                here via the assignee grade row.
//   submitted  → latest submission is awaiting review (incl. under_review
//                for resubmissions before the prof re-grades)
//   in_progress → latest submission is still a draft
//   not_started → no submission at all
function studentAssignmentState(assignment, mySubmission, myAssignee) {
  const eff = effectiveAssignmentStatus(assignment);
  const status = mySubmission?.status;
  // resubmit_requested (canonical Phase 3) and needs_resubmission (legacy)
  // take precedence over the grade — if prof rolled the verdict back, the
  // student needs to act.
  if (status && ['needs_resubmission','resubmit_requested'].includes(status)) {
    return 'resubmit_needed';
  }
  if (myAssignee?.letter_grade) return 'reviewed';
  if (status && ['approved','rejected','reviewed'].includes(status)) return 'reviewed';
  if (status === 'submitted' || status === 'under_review') return 'submitted';
  if (eff === 'late' && !mySubmission) return 'late';
  if (status === 'draft') return 'in_progress';
  return 'not_started';
}

const STUDENT_STATE_LABEL = {
  not_started:     'Not Started',
  in_progress:     'In Progress',
  submitted:       'Submitted',
  reviewed:        'Reviewed',
  late:            'Late',
  resubmit_needed: 'Resubmit',
};

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
  const [myAssignees, setMyAssignees] = useState({}); // { [assignmentId]: assigneeRow with individual grade }
  const [submissionCounts, setSubmissionCounts] = useState({}); // { [assignmentId]: { submitted, total } }
  const [filter, setFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('mine');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  async function load() {
    setError(null);
    if (isDemo) {
      const list = (project.assignments ?? []).map(adaptDemoAssignment);
      setRows(list);
      const map = {};
      const assigneeMap = {};
      const counts = {};
      const totalMembers = (project.memberRecords ?? []).length || (project.members?.length ?? 0);
      for (const a of list) {
        const subs = a.submissions ?? [];
        const own = subs.filter(s => s.submitter_id === 'demo-student-1');
        if (own.length) map[a.id] = own[0];
        // Demo individual grade row, mirrors the assignment_assignees shape.
        const myAsg = (a.assignees ?? []).find(x => x.student_id === 'demo-student-1');
        if (myAsg) assigneeMap[a.id] = myAsg;
        // For prof counts: unique submitters with status != draft.
        const distinct = new Set(subs.filter(s => s.status !== 'draft').map(s => s.submitter_id));
        counts[a.id] = { submitted: distinct.size, total: totalMembers };
      }
      setMySubmissions(map);
      setMyAssignees(assigneeMap);
      setSubmissionCounts(counts);
      return;
    }
    try {
      const [list, mine, myAsg] = await Promise.all([
        listTeamAssignments(supabase, project.id),
        user?.id ? listOwnSubmissionsForTeam(supabase, project.id, user.id) : Promise.resolve([]),
        user?.id && !isProfessor
          ? listOwnAssigneesForTeam(supabase, project.id, user.id)
          : Promise.resolve({}),
      ]);
      setRows(list);
      const map = {};
      for (const s of mine) if (!map[s.assignment_id]) map[s.assignment_id] = s;
      setMySubmissions(map);
      setMyAssignees(myAsg);
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

  // Filter pipeline. For professors: 'open' = accepting submissions,
  // 'submitted'/'reviewed' look at any submission state, 'late' uses
  // effectiveAssignmentStatus. For students: the two pills are
  // 'mine' (individual-mode) and 'team' (team-mode), filtering by
  // assignment_type.
  const filtered = useMemo(() => {
    if (!rows) return null;
    if (!isProfessor) {
      return rows.filter(a =>
        studentFilter === 'team'
          ? a.assignment_type === 'team'
          : a.assignment_type !== 'team',
      );
    }
    if (filter === 'all') return rows;
    return rows.filter(a => {
      const eff = effectiveAssignmentStatus(a);
      const mine = mySubmissions[a.id];
      switch (filter) {
        case 'late':      return eff === 'late';
        case 'open':      return eff !== 'done';
        case 'submitted': return mine ? mine.status === 'submitted' : false;
        case 'reviewed':  return mine ? ['approved','rejected','needs_resubmission','reviewed'].includes(mine.status) : false;
        default:          return true;
      }
    });
  }, [rows, filter, studentFilter, mySubmissions, isProfessor]);

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
        isProfessor
          ? <FilterChips items={FILTERS} active={filter} onChange={setFilter} className="asgn-filter-chips"/>
          : <FilterChips items={STUDENT_FILTERS} active={studentFilter} onChange={setStudentFilter} className="asgn-filter-chips"/>
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
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Nothing in the "{(isProfessor ? FILTERS : STUDENT_FILTERS).find(([k]) => k === (isProfessor ? filter : studentFilter))?.[1] ?? '—'}" bucket.
          </p>
        </div>
      ) : (
        <div className="asgn-grid">
          {filtered.map(a => {
            const eff = effectiveAssignmentStatus(a);
            const mine = mySubmissions[a.id];
            const counts = submissionCounts[a.id];
            const isTeam = a.assignment_type === 'team';
            // Student-only derivations. Individual grade lives on the
            // assignee row (RLS already restricts to own row).
            const myAsg = myAssignees[a.id];
            const myIndivGrade = myAsg?.letter_grade
              ? { letter: myAsg.letter_grade, points: myAsg.points_awarded }
              : (mine?.letter_grade
                  ? { letter: mine.letter_grade, points: mine.points_awarded }
                  : null);
            const sState = !isProfessor ? studentAssignmentState(a, mine, myAsg) : null;
            const dlTone = !isProfessor ? deadlineTone(a.due_at) : null;
            const ctaLabel = sState === 'resubmit_needed'
              ? 'Resubmit Work'
              : sState === 'reviewed'
                ? 'View Feedback'
                : sState === 'submitted'
                  ? 'View Submission'
                  : 'Submit Work';
            return (
              <button
                key={a.id}
                type="button"
                className={`asgn-row asgn-status-${eff}${!isProfessor ? ` asgn-sstate-${sState}` : ''}`}
                onClick={() => setDetailRow(a)}
              >
                <div className="asgn-row-top">
                  <div className="asgn-row-main">
                    <div className="asgn-row-title">{a.title}</div>
                    <div className="asgn-row-meta">
                      {a.owner?.full_name ? `${a.owner.full_name} · ` : ''}
                      {isProfessor
                        ? dueLabel(a.due_at)
                        : <span className={`asgn-due asgn-due-${dlTone}`}>{dueLabel(a.due_at)}</span>}
                    </div>
                  </div>
                  {isProfessor ? (
                    <span className={`asgn-badge asgn-badge-${eff}`}>{eff === 'late' ? 'Late' : eff === 'done' ? 'Done' : 'Open'}</span>
                  ) : (
                    <span className={`asgn-badge asgn-sbadge-${sState}`}>{STUDENT_STATE_LABEL[sState]}</span>
                  )}
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
                  <div className="asgn-mine asgn-student-foot">
                    <div className="asgn-mine-line">
                      {mine
                        ? <><strong>{submissionStatusLabel(mine.status)}</strong>{mine.submitted_at ? ` · ${formatRelativeTime(mine.submitted_at)}` : ''}</>
                        : <span style={{ color: 'var(--muted)' }}>No submission yet</span>}
                      {myIndivGrade?.letter && (
                        <span className={`grade-badge grade-${myIndivGrade.letter.toLowerCase()}`} style={{ marginLeft: 8 }}>
                          {myIndivGrade.letter}
                          {myIndivGrade.points != null && a.max_points
                            ? <span className="grade-pts">{Number(myIndivGrade.points)}/{a.max_points}</span>
                            : null}
                        </span>
                      )}
                    </div>
                    <span className={`asgn-cta asgn-cta-${sState}`}>{ctaLabel} →</span>
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
