// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import StatusTag from './StatusTag.jsx';
import { spineClass, isDoneState } from '../utils/status.js';
import {
  assignSubtaskTo,
  claimSubtask,
  effectiveAssignmentStatus,
  letterGradeFor,
  listLeadersForAssignment,
  listOwnAssigneesForTeam,
  listSubmissionsForAssignment,
  listSubtasksForAssignment,
  reviewSubmission,
  submissionStatusLabel,
  submitAssignmentPdf,
} from '../lib/assignments.js';
import { formatRelativeTime, validatePdfFile } from '../lib/pdfs.js';
import { useDemoMode, withDemoReviews } from '../hooks/useDemoMode.jsx';

const REVIEW_VERDICTS = [
  { value: 'approved',           label: 'Approve',          tone: 'p' },
  { value: 'resubmit_requested', label: 'Request resubmit', tone: 'g' },
  { value: 'rejected',           label: 'Reject',           tone: 'g' },
];

// Latest submission per submitter — used to gate the prof Review button so
// only the most recent version is gradeable; older versions stay visible
// as history (with their original feedback) but read-only.
function computeLatestIds(submissions) {
  const seen = new Set();
  const ids = new Set();
  // submissions arrive sorted by version desc, so the first row per
  // submitter is their latest.
  for (const s of submissions ?? []) {
    if (!seen.has(s.submitter_id)) {
      seen.add(s.submitter_id);
      ids.add(s.id);
    }
  }
  return ids;
}

function dueLabel(due) {
  if (!due) return 'No due date';
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AssignmentDetailModal({
  project, assignment, role, isDemo, supabase, user, onClose, onSubmissionChanged,
}) {
  const isProfessor = role === 'professor';
  const { demoMode, demoRole, demoReviews, applyDemoReview } = useDemoMode();
  // Demo-prof showcase: prof actions are visual-only and never persist. True
  // only inside demo mode with the professor view selected — a real professor
  // (never in demo mode) always takes the real, persisting path below.
  const demoShowcase = demoMode && demoRole === 'professor';
  const noPersist = isDemo || demoShowcase;
  const isTeam = assignment.assignment_type === 'team';
  const dist = assignment.distribution_mode;
  const [subs, setSubs] = useState(null);
  const [subtasks, setSubtasks] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [myAssignee, setMyAssignee] = useState(null); // individual grade row (RLS-scoped to me)
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewState, setReviewState] = useState({}); // { [submissionId]: { feedback, points, openId } }
  const [assignPicker, setAssignPicker] = useState({}); // { [subtaskId]: assigneeId }
  const fileRef = useRef(null);

  const members = useMemo(
    () => (project.memberRecords ?? [])
      .map(m => m.profile)
      .filter(p => p && p.id && p.full_name),
    [project.memberRecords],
  );
  const userId = user?.id ?? (isDemo ? 'demo-student-1' : null);
  const amILeader = leaders.some(l => (l.leader_id ?? l.leader?.id) === userId);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  useEffect(() => {
    setError(null);
    if (isDemo) {
      setSubs(withDemoReviews(assignment.submissions ?? [], demoReviews));
      setSubtasks(assignment.subtasks ?? []);
      setLeaders(assignment.leaders ?? []);
      const me = (assignment.assignees ?? []).find(x => x.student_id === 'demo-student-1');
      setMyAssignee(me ?? null);
      return;
    }
    let cancelled = false;
    Promise.all([
      listSubmissionsForAssignment(supabase, assignment.id),
      isTeam ? listSubtasksForAssignment(supabase, assignment.id) : Promise.resolve([]),
      isTeam ? listLeadersForAssignment(supabase, assignment.id) : Promise.resolve([]),
      // Per-student grade — RLS ensures we only see our own row.
      !isProfessor && user?.id
        ? listOwnAssigneesForTeam(supabase, assignment.team_id, user.id)
        : Promise.resolve({}),
    ])
      .then(([s, st, le, asgMap]) => {
        if (cancelled) return;
        // In showcase mode, overlay any ephemeral verdicts on the real reads
        // so the prof sees their (non-persisted) review reflected.
        setSubs(demoShowcase ? withDemoReviews(s, demoReviews) : s);
        setSubtasks(st);
        setLeaders(le);
        setMyAssignee(asgMap?.[assignment.id] ?? null);
      })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [supabase, assignment, isDemo, isTeam, isProfessor, user?.id, demoShowcase, demoReviews]);

  // Latest = first row per submitter (subs are sorted version desc).
  const myVersions = useMemo(
    () => (subs ?? []).filter(s => s.submitter_id === userId),
    [subs, userId],
  );
  const mine = myVersions[0] ?? null;
  const needsResubmit = !!mine && ['needs_resubmission','resubmit_requested'].includes(mine.status);
  const latestIds = useMemo(() => computeLatestIds(subs), [subs]);

  function pickFile() { fileRef.current?.click(); }

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const v = validatePdfFile(file);
    if (v) { setError(v); return; }
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        // Mirror submitAssignmentPdf: v1 = 'submitted', v2+ = 'under_review'.
        const nextVersion = ((mine?.version) ?? 0) + 1;
        const row = {
          id: `demo-sub-${Date.now()}`,
          assignment_id: assignment.id,
          team_id: project.id,
          submitter_id: 'demo-student-1',
          submitter: { id: 'demo-student-1', full_name: 'Alex Chen', role: 'student' },
          status: nextVersion === 1 ? 'submitted' : 'under_review',
          version: nextVersion,
          notes: null,
          feedback: null,
          pdf_document_id: null,
          storage_path: null,
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          pdf: { id: `demo-pdf-${Date.now()}`, title: file.name, file_size_bytes: file.size, page_count: 1 },
        };
        assignment.submissions = [row, ...(assignment.submissions ?? [])];
        setSubs(cur => [row, ...(cur ?? [])]);
        onSubmissionChanged?.(row);
        return;
      }
      const row = await submitAssignmentPdf(supabase, {
        teamId: project.id,
        assignmentId: assignment.id,
        submitterId: user.id,
        file,
      });
      setSubs(cur => [row, ...(cur ?? [])]);
      onSubmissionChanged?.(row);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onClaim(subtask) {
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        const me = { id: userId, full_name: 'Alex Chen', role: 'student', avatar_url: null };
        const next = { ...subtask, assigned_to: userId, assignee: me, claimed_at: new Date().toISOString(), status: 'in_progress' };
        setSubtasks(cur => cur.map(s => s.id === subtask.id ? next : s));
        if (Array.isArray(assignment.subtasks)) {
          assignment.subtasks = assignment.subtasks.map(s => s.id === subtask.id ? next : s);
        }
        return;
      }
      const next = await claimSubtask(supabase, { subtaskId: subtask.id, userId });
      setSubtasks(cur => cur.map(s => s.id === subtask.id ? next : s));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(subtask) {
    const assigneeId = assignPicker[subtask.id];
    if (!assigneeId) { setError('Pick a teammate before assigning.'); return; }
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        const assignee = members.find(m => m.id === assigneeId) ?? null;
        const next = { ...subtask, assigned_to: assigneeId, assignee, assigned_by: userId, status: 'in_progress' };
        setSubtasks(cur => cur.map(s => s.id === subtask.id ? next : s));
        if (Array.isArray(assignment.subtasks)) {
          assignment.subtasks = assignment.subtasks.map(s => s.id === subtask.id ? next : s);
        }
        setAssignPicker(prev => ({ ...prev, [subtask.id]: '' }));
        return;
      }
      const next = await assignSubtaskTo(supabase, { subtaskId: subtask.id, assigneeId, leaderId: userId });
      setSubtasks(cur => cur.map(s => s.id === subtask.id ? next : s));
      setAssignPicker(prev => ({ ...prev, [subtask.id]: '' }));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReview(submission, verdict) {
    const rs = reviewState[submission.id] ?? {};
    const fb = rs.feedback?.trim() || null;
    const pts = rs.points;
    setError(null);
    setBusy(true);
    try {
      if (noPersist) {
        // Visual-only showcase: update what the reviewer sees and record an
        // ephemeral override (wiped when demo mode resets). Persists NOTHING —
        // no Supabase write, and the shared demo fixtures stay untouched.
        const ptsNum = pts !== undefined && pts !== '' ? Number(pts) : null;
        const letter = ptsNum != null
          ? letterGradeFor(ptsNum, assignment.max_points)
          : null;
        const patch = {
          status: verdict,
          feedback: fb,
          reviewed_at: new Date().toISOString(),
          reviewer: { id: user?.id, full_name: user?.full_name || 'You', role: 'professor' },
          points_awarded: ptsNum,
          letter_grade: letter,
        };
        const next = { ...submission, ...patch };
        setSubs(cur => cur.map(s => s.id === submission.id ? next : s));
        applyDemoReview(submission.id, patch);
        onSubmissionChanged?.(next);
        setReviewState(prev => ({ ...prev, [submission.id]: { feedback: '', points: '', openId: null } }));
        return;
      }
      const next = await reviewSubmission(supabase, {
        submissionId: submission.id, reviewerId: user.id, status: verdict, feedback: fb,
        pointsAwarded: pts,
      });
      setSubs(cur => cur.map(s => s.id === submission.id ? next : s));
      onSubmissionChanged?.(next);
      setReviewState(prev => ({ ...prev, [submission.id]: { feedback: '', points: '', openId: null } }));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const eff = effectiveAssignmentStatus(assignment);

  return (
    <div className="ovl pdf-full-ovl" onClick={() => !busy && onClose()}>
      <div className="pdf-fullviewer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="pdf-fullviewer-head">
          <div className="pdf-fullviewer-titleblock">
            <div className="pdf-kicker">Assignment</div>
            <div className="pdf-title">{assignment.title}</div>
          </div>
          <span className={`asgn-badge asgn-badge-${eff}`} style={{ marginRight: 6 }}>{eff === 'late' ? 'Late' : eff === 'done' ? 'Done' : 'Open'}</span>
          <button type="button" className="btn-icon-x" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </header>

        <div className="asgn-detail-body">
          <div className="asgn-detail-meta">
            <div><strong>Due:</strong> {dueLabel(assignment.due_at)}</div>
            {assignment.owner?.full_name && <div><strong>Posted by:</strong> {assignment.owner.full_name}</div>}
          </div>
          {assignment.description && (
            <div className="asgn-detail-desc">{assignment.description}</div>
          )}

          {amILeader && !isProfessor && (
            <div className="asgn-leader-pill">
              <span aria-hidden>👑</span> You're the team leader for this assignment
            </div>
          )}

          {/* Dual-grade panel (student view). Team grade is the shared mark
              every member sees; individual grade comes from the assignee
              row, RLS-scoped to the caller's own row. Teammates' individual
              grades are never rendered here. */}
          {!isProfessor && (assignment.team_letter_grade || myAssignee?.letter_grade) && (
            <div className="asgn-dual-grade">
              {assignment.team_letter_grade && (
                <div className="asgn-grade-card">
                  <div className="asgn-grade-card-lbl">Team</div>
                  <div className="asgn-grade-card-val">
                    {assignment.team_points_awarded != null && assignment.max_points
                      ? `${Number(assignment.team_points_awarded)}/${assignment.max_points}`
                      : '—'}
                  </div>
                  <span className={`grade-badge grade-${assignment.team_letter_grade.toLowerCase()}`}>
                    {assignment.team_letter_grade}
                  </span>
                </div>
              )}
              {myAssignee?.letter_grade && (
                <div className="asgn-grade-card">
                  <div className="asgn-grade-card-lbl">You</div>
                  <div className="asgn-grade-card-val">
                    {myAssignee.points_awarded != null && assignment.max_points
                      ? `${Number(myAssignee.points_awarded)}/${assignment.max_points}`
                      : '—'}
                  </div>
                  <span className={`grade-badge grade-${myAssignee.letter_grade.toLowerCase()}`}>
                    {myAssignee.letter_grade}
                  </span>
                </div>
              )}
            </div>
          )}
          {!isProfessor && myAssignee?.feedback && (
            <div className="asgn-mine-feedback" style={{ marginTop: 10 }}>
              <div className="asgn-mine-feedback-h">Personal feedback</div>
              {myAssignee.feedback}
            </div>
          )}
          {!isProfessor && assignment.team_feedback && (
            <div className="asgn-mine-feedback" style={{ marginTop: 10 }}>
              <div className="asgn-mine-feedback-h">Team feedback</div>
              {assignment.team_feedback}
            </div>
          )}

          {error && (
            <div className="alert" style={{ margin: '12px 0' }}>
              <span>◇</span><div>{error}</div>
            </div>
          )}

          {isTeam && (
            <div className="asgn-subtasks-section">
              <div className="asgn-subs-head">
                <h3>Subtasks</h3>
                <span className="pdf-muted">
                  {dist === 'professor' && 'Assigned by professor'}
                  {dist === 'team_leader' && 'Assigned by team leader'}
                  {dist === 'self_pick' && 'Open pool · self-pick'}
                </span>
              </div>

              {subtasks === null ? (
                <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
              ) : subtasks.length === 0 ? (
                <div className="pdf-muted" style={{ padding: '10px 0' }}>No subtasks on this assignment.</div>
              ) : (
                <div className="asgn-subtask-list">
                  {/* Open / claimable rows first, then assigned. */}
                  {[...subtasks].sort((a, b) => Number(!!a.assigned_to) - Number(!!b.assigned_to)).map(st => {
                    const open = !st.assigned_to;
                    const mineSubtask = st.assigned_to === userId;
                    const canClaim = open && dist === 'self_pick' && !isProfessor;
                    const canAssign = open && dist === 'team_leader' && amILeader;
                    return (
                      <div key={st.id} className={`asgn-subtask-item ${open ? 'open' : ''} ${mineSubtask ? 'mine' : ''}`}>
                        <div className="asgn-subtask-main">
                          <div className="asgn-subtask-title">{st.title}</div>
                          {st.description && <div className="asgn-subtask-desc">{st.description}</div>}
                          <div className="asgn-subtask-foot">
                            {st.assignee
                              ? <><Avatar name={st.assignee.full_name} size={18}/><span>{st.assignee.full_name}{mineSubtask ? ' · you' : ''}</span></>
                              : <span className="pdf-muted">Unassigned</span>}
                            <span className={`asgn-sub-status asgn-sub-status-${st.status}`} style={{ marginLeft: 'auto', marginTop: 0 }}>{st.status.replace('_',' ')}</span>
                          </div>
                          {canAssign && (
                            <div className="asgn-subtask-assign">
                              <select
                                className="input"
                                value={assignPicker[st.id] ?? ''}
                                onChange={e => setAssignPicker(prev => ({ ...prev, [st.id]: e.target.value }))}
                              >
                                <option value="">Pick teammate…</option>
                                {members.map(m => (
                                  <option key={m.id} value={m.id}>{m.full_name}</option>
                                ))}
                              </select>
                              <button className="btn btn-p btn-sm" disabled={busy || !assignPicker[st.id]} onClick={() => onAssign(st)}>Assign</button>
                            </div>
                          )}
                        </div>
                        {canClaim && (
                          <button className="btn btn-p btn-sm asgn-claim-btn" disabled={busy} onClick={() => onClaim(st)}>
                            Claim
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!isProfessor && (
            <div className="asgn-mine-box">
              <div className="asgn-mine-head">Your submission</div>
              {mine ? (
                <>
                  <div className="asgn-mine-status">
                    <strong>{submissionStatusLabel(mine.status)}</strong>
                    {mine.submitted_at && <span> · {formatRelativeTime(mine.submitted_at)}</span>}
                    {mine.version && <span> · v{mine.version}</span>}
                  </div>
                  {mine.pdf?.title && <div className="asgn-mine-file">📄 {mine.pdf.title}</div>}
                  {/* Resubmit callout: surface the LATEST version's feedback
                      prominently so the student sees exactly what the prof
                      asked for on this specific assignment. Scoping is
                      per-assignment — no global student state involved. */}
                  {needsResubmit && mine.feedback && (
                    <div className="asgn-resubmit-callout">
                      <div className="asgn-resubmit-callout-h">Prof asked for a resubmission · v{mine.version}</div>
                      {mine.feedback}
                    </div>
                  )}
                  {!needsResubmit && mine.feedback && (
                    <div className="asgn-mine-feedback">
                      <div className="asgn-mine-feedback-h">Feedback</div>
                      {mine.feedback}
                    </div>
                  )}
                  {(needsResubmit || mine.status === 'rejected') && (
                    <button className="btn btn-p btn-sm" disabled={busy} onClick={pickFile}>
                      {busy ? 'Uploading…' : 'Resubmit Work'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="pdf-muted">Nothing submitted yet.</div>
                  <button className="btn btn-p btn-sm" disabled={busy} onClick={pickFile}>
                    {busy ? 'Uploading…' : 'Submit PDF'}
                  </button>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={onFileChange}
              />
              {/* Version history — shows v1, v2, … with their dates +
                  per-version status. Each row is its own DB row (no
                  update-in-place), so feedback stays paired with the
                  version it was given on. */}
              {myVersions.length > 1 && (
                <div className="asgn-version-history">
                  <div className="asgn-version-history-h">Version history</div>
                  {[...myVersions].reverse().map(v => (
                    <div key={v.id} className="asgn-version-row">
                      <span className="asgn-version-tag">v{v.version}</span>
                      <span className={`asgn-sub-status asgn-sub-status-${v.status}`} style={{ marginTop: 0 }}>
                        {submissionStatusLabel(v.status)}
                      </span>
                      <span className="asgn-version-when">
                        {v.submitted_at ? formatRelativeTime(v.submitted_at) : 'pending'}
                      </span>
                      {v.letter_grade && (
                        <span className={`grade-badge grade-${v.letter_grade.toLowerCase()}`}>
                          {v.letter_grade}
                          {v.points_awarded != null && assignment.max_points
                            ? <span className="grade-pts">{Number(v.points_awarded)}/{assignment.max_points}</span>
                            : null}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="asgn-subs-head">
            <h3>{isProfessor ? 'Submissions' : 'All submissions'}</h3>
            <span className="pdf-muted">{subs?.length ?? 0}</span>
          </div>

          {subs === null ? (
            <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
          ) : subs.length === 0 ? (
            <div className="pdf-muted" style={{ padding: '10px 0' }}>No submissions yet.</div>
          ) : subs.map(s => {
            const isMine = s.submitter_id === user?.id;
            const isLatest = latestIds.has(s.id);
            const open = reviewState[s.id]?.openId === s.id;
            return (
              <div key={s.id} className={`asgn-sub-row has-spine${isLatest ? '' : ' asgn-sub-history'}${isDoneState(s.status) ? ' is-done' : ''}`}>
                <span className={spineClass(s.status)}/>
                <Avatar name={s.submitter?.full_name || 'Student'} size={28}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="asgn-sub-meta">
                    <strong>{s.submitter?.full_name || 'Student'}</strong>
                    {isMine && <span className="pdf-prof-badge" style={{ color: 'var(--indigo-bright)', background: 'rgba(var(--accent-rgb),.14)', borderColor: 'rgba(var(--accent-rgb),.32)' }}>You</span>}
                    {isLatest
                      ? <span className="asgn-version-tag asgn-version-tag-latest">v{s.version} · latest</span>
                      : <span className="asgn-version-tag">v{s.version} · history</span>}
                    <span className="asgn-sub-when">{formatRelativeTime(s.submitted_at ?? s.created_at)}</span>
                  </div>
                  {s.pdf?.title && <div className="asgn-sub-file">📄 {s.pdf.title}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <StatusTag status={s.status}/>
                    {/* Grade badge — hidden from students looking at a
                        teammate's row. Privacy: dual-grade model keeps
                        individual marks per-student; surfacing the legacy
                        submissions.letter_grade here would re-leak it. */}
                    {s.letter_grade && (isProfessor || isMine) && (
                      <span className={`grade-badge grade-${s.letter_grade.toLowerCase()}`} title={s.points_awarded != null ? `${s.points_awarded} / ${assignment.max_points ?? '—'}` : undefined}>
                        {s.letter_grade}
                        {s.points_awarded != null && assignment.max_points
                          ? <span className="grade-pts">{Number(s.points_awarded)}/{assignment.max_points}</span>
                          : null}
                      </span>
                    )}
                  </div>
                  {/* Same privacy rule for written feedback. */}
                  {s.feedback && (isProfessor || isMine) && (
                    <div className="asgn-sub-feedback">{s.feedback}</div>
                  )}

                  {/* Only the latest version of each submitter is gradeable.
                      Older versions stay visible as history with their own
                      feedback but no Review button. */}
                  {isProfessor && isLatest && ['submitted','under_review','needs_resubmission','resubmit_requested','rejected'].includes(s.status) && (
                    <div className="asgn-sub-review">
                      {!open ? (
                        <button
                          type="button"
                          className="btn btn-g btn-sm"
                          onClick={() => setReviewState(prev => ({ ...prev, [s.id]: { feedback: prev[s.id]?.feedback ?? '', openId: s.id } }))}
                        >Review</button>
                      ) : (
                        <>
                          <textarea
                            className="textarea"
                            placeholder="Feedback for the student (optional)"
                            value={reviewState[s.id]?.feedback ?? ''}
                            onChange={e => setReviewState(prev => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value } }))}
                          />
                          {assignment.max_points ? (
                            <div className="asgn-grade-row">
                              <label>Points</label>
                              <input
                                type="number"
                                min="0"
                                max={assignment.max_points}
                                step="0.5"
                                className="input"
                                placeholder={`0 – ${assignment.max_points}`}
                                value={reviewState[s.id]?.points ?? ''}
                                onChange={e => setReviewState(prev => ({ ...prev, [s.id]: { ...prev[s.id], points: e.target.value } }))}
                              />
                              <span className="asgn-grade-out-of">/ {assignment.max_points}</span>
                              {(() => {
                                const pts = reviewState[s.id]?.points;
                                if (pts === '' || pts === undefined) return null;
                                const lg = letterGradeFor(pts, assignment.max_points);
                                if (!lg) return null;
                                return <span className={`grade-badge grade-${lg.toLowerCase()}`}>{lg}</span>;
                              })()}
                            </div>
                          ) : null}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {REVIEW_VERDICTS.map(v => (
                              <button
                                key={v.value}
                                type="button"
                                className={`btn btn-${v.tone} btn-sm`}
                                disabled={busy}
                                onClick={() => onReview(s, v.value)}
                              >{v.label}</button>
                            ))}
                            <button
                              type="button"
                              className="btn btn-g btn-sm"
                              disabled={busy}
                              onClick={() => setReviewState(prev => ({ ...prev, [s.id]: { ...prev[s.id], openId: null } }))}
                            >Cancel</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
