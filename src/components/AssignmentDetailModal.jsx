import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import {
  assignSubtaskTo,
  claimSubtask,
  effectiveAssignmentStatus,
  listLeadersForAssignment,
  listSubmissionsForAssignment,
  listSubtasksForAssignment,
  reviewSubmission,
  submissionStatusLabel,
  submitAssignmentPdf,
} from '../lib/assignments.js';
import { formatRelativeTime, validatePdfFile } from '../lib/pdfs.js';

const REVIEW_VERDICTS = [
  { value: 'approved',           label: 'Approve',         tone: 'p' },
  { value: 'needs_resubmission', label: 'Request changes', tone: 'g' },
  { value: 'rejected',           label: 'Reject',          tone: 'g' },
];

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
  const isTeam = assignment.assignment_type === 'team';
  const dist = assignment.distribution_mode;
  const [subs, setSubs] = useState(null);
  const [subtasks, setSubtasks] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewState, setReviewState] = useState({}); // { [submissionId]: { feedback, openId } }
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
      setSubs(assignment.submissions ?? []);
      setSubtasks(assignment.subtasks ?? []);
      setLeaders(assignment.leaders ?? []);
      return;
    }
    let cancelled = false;
    Promise.all([
      listSubmissionsForAssignment(supabase, assignment.id),
      isTeam ? listSubtasksForAssignment(supabase, assignment.id) : Promise.resolve([]),
      isTeam ? listLeadersForAssignment(supabase, assignment.id) : Promise.resolve([]),
    ])
      .then(([s, st, le]) => {
        if (cancelled) return;
        setSubs(s);
        setSubtasks(st);
        setLeaders(le);
      })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [supabase, assignment, isDemo, isTeam]);

  const mine = (subs ?? []).find(s => s.submitter_id === user?.id || s.submitter_id === 'demo-student-1');

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
        const row = {
          id: `demo-sub-${Date.now()}`,
          assignment_id: assignment.id,
          team_id: project.id,
          submitter_id: 'demo-student-1',
          submitter: { id: 'demo-student-1', full_name: 'Alex Chen', role: 'student' },
          status: 'submitted',
          version: ((mine?.version) ?? 0) + 1,
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
    const fb = reviewState[submission.id]?.feedback?.trim() || null;
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        const next = { ...submission, status: verdict, feedback: fb, reviewed_at: new Date().toISOString(),
          reviewer: { id: user?.id, full_name: user?.full_name || 'You', role: 'professor' } };
        setSubs(cur => cur.map(s => s.id === submission.id ? next : s));
        // mutate the demo backing array too so list refresh sees it
        if (Array.isArray(assignment.submissions)) {
          assignment.submissions = assignment.submissions.map(s => s.id === submission.id ? next : s);
        }
        onSubmissionChanged?.(next);
        setReviewState(prev => ({ ...prev, [submission.id]: { feedback: '', openId: null } }));
        return;
      }
      const next = await reviewSubmission(supabase, {
        submissionId: submission.id, reviewerId: user.id, status: verdict, feedback: fb,
      });
      setSubs(cur => cur.map(s => s.id === submission.id ? next : s));
      onSubmissionChanged?.(next);
      setReviewState(prev => ({ ...prev, [submission.id]: { feedback: '', openId: null } }));
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
                  {mine.feedback && (
                    <div className="asgn-mine-feedback">
                      <div className="asgn-mine-feedback-h">Feedback</div>
                      {mine.feedback}
                    </div>
                  )}
                  {(mine.status === 'needs_resubmission' || mine.status === 'rejected') && (
                    <button className="btn btn-p btn-sm" disabled={busy} onClick={pickFile}>
                      {busy ? 'Uploading…' : 'Resubmit PDF'}
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
            const open = reviewState[s.id]?.openId === s.id;
            return (
              <div key={s.id} className="asgn-sub-row">
                <Avatar name={s.submitter?.full_name || 'Student'} size={28}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="asgn-sub-meta">
                    <strong>{s.submitter?.full_name || 'Student'}</strong>
                    {isMine && <span className="pdf-prof-badge" style={{ color: 'var(--indigo-bright)', background: 'rgba(124,108,255,.14)', borderColor: 'rgba(124,108,255,.32)' }}>You</span>}
                    <span className="asgn-sub-when">{formatRelativeTime(s.submitted_at ?? s.created_at)} · v{s.version}</span>
                  </div>
                  {s.pdf?.title && <div className="asgn-sub-file">📄 {s.pdf.title}</div>}
                  <div className={`asgn-sub-status asgn-sub-status-${s.status}`}>{submissionStatusLabel(s.status)}</div>
                  {s.feedback && (
                    <div className="asgn-sub-feedback">{s.feedback}</div>
                  )}

                  {isProfessor && (s.status === 'submitted' || s.status === 'needs_resubmission' || s.status === 'rejected') && (
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
