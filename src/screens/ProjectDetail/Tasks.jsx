// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import TaskCreateModal from '../../components/TaskCreateModal.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { validatePdfFile } from '../../lib/pdfs.js';
import {
  claimTask,
  listTeamTasks,
  setTaskAssignees,
  setTaskStatus,
  startTask,
  submitTask,
  TASK_STATUS_LADDER,
  taskStatusLabel,
} from '../../lib/tasks.js';

// Normalize a task row (real or demo/legacy) into a single render shape with a
// status and a flat _assignees array of profile-ish objects.
function normalize(t) {
  const status = t.status ?? (t.done ? 'done' : 'not_started');
  let assignees = [];
  if (Array.isArray(t.assignees)) {
    assignees = t.assignees.map(a => a.student).filter(Boolean);
  } else if (t.assignee) {
    // legacy demo tasks carried only an assignee name string
    assignees = [{ id: t.assignee, full_name: t.assignee, avatar_url: null }];
  }
  return { ...t, status, assignee_mode: t.assignee_mode ?? 'professor', _assignees: assignees };
}

function StatusBadge({ status }) {
  return <span className={`task-badge task-badge-${status}`}>{taskStatusLabel(status)}</span>;
}

export default function Tasks({ project, role }) {
  const { supabase, user } = useAuth();
  const isDemo = typeof project?.id === 'string' && project.id.startsWith('demo-');
  const isProfessor = role === 'professor';
  // In demo mode there's no auth user — impersonate the demo prof/student so
  // the role-dependent actions (claim/submit/assign) light up.
  const myId = isDemo ? (isProfessor ? 'demo-prof-1' : 'demo-student-1') : user?.id;

  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [creating, setCreating] = useState(false);
  const fileInputs = useRef({});

  async function load() {
    setError(null);
    if (isDemo) {
      setRows((project.tasks ?? []).map(normalize));
      return;
    }
    const list = await listTeamTasks(supabase, project.id);
    setRows(list.map(normalize));
  }

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setRows(null);
    load().catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project?.id, isDemo, project?.tasks]);

  function replaceRow(updated) {
    const n = normalize(updated);
    setRows(prev => (prev ?? []).map(r => (r.id === n.id ? n : r)));
  }

  function flashMsg(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(f => (f === msg ? null : f)), 3000);
  }

  // ── actions ────────────────────────────────────────────────────────────
  const amAssignee = (t) => t._assignees.some(a => a.id === myId);

  async function doClaim(t) {
    setBusyId(t.id); setError(null);
    try {
      if (isDemo) {
        const me = { id: myId, full_name: 'Alex Chen', avatar_url: null, role: 'student' };
        const updated = { ...t, assignees: [...t._assignees.map(s => ({ student: s })), { student: me }] };
        applyDemo(t.id, { assignees: updated.assignees });
        replaceRow(updated);
      } else {
        replaceRow(await claimTask(supabase, { taskId: t.id, studentId: myId }));
      }
      flashMsg('Claimed task');
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusyId(null); }
  }

  async function doStart(t) {
    setBusyId(t.id); setError(null);
    try {
      if (isDemo) { applyDemo(t.id, { status: 'in_progress' }); replaceRow({ ...t, status: 'in_progress' }); }
      else replaceRow(await startTask(supabase, t.id));
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusyId(null); }
  }

  async function doProfStatus(t, status) {
    setBusyId(t.id); setError(null);
    try {
      if (isDemo) { applyDemo(t.id, { status }); replaceRow({ ...t, status }); }
      else replaceRow(await setTaskStatus(supabase, { taskId: t.id, status }));
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusyId(null); }
  }

  async function doLeaderAssign(t, studentId) {
    if (!studentId) return;
    setBusyId(t.id); setError(null);
    try {
      if (isDemo) {
        const m = (project.memberRecords ?? []).map(x => x.profile).find(p => p.id === studentId);
        const assignees = [{ student: { id: m.id, full_name: m.full_name, avatar_url: null, role: 'student' } }];
        applyDemo(t.id, { assignees });
        replaceRow({ ...t, assignees });
      } else {
        replaceRow(await setTaskAssignees(supabase, { taskId: t.id, studentIds: [studentId], assignedBy: myId }));
      }
      flashMsg('Assigned');
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusyId(null); }
  }

  async function onFileChange(t, event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const v = validatePdfFile(file);
    if (v) { setError(v); return; }
    setError(null); setBusyId(t.id);
    try {
      if (isDemo) {
        const newPdf = {
          id: `demo-pdf-new-${t.id}-${Date.now()}`,
          title: file.name, uploaded_by: 'Alex Chen',
          uploaded_at: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          pages: 1, annotations: 0, status: 'pending', file_size_bytes: file.size,
        };
        project.pdfs = [...(project.pdfs || []), newPdf];
        applyDemo(t.id, { status: 'submitted' });
        replaceRow({ ...t, status: 'submitted' });
        await new Promise(r => setTimeout(r, 300));
      } else {
        replaceRow(await submitTask(supabase, {
          teamId: project.id, taskId: t.id, userId: myId, file,
          assignmentId: t.assignment_id ?? null,
        }));
      }
      flashMsg(`Submitted ${file.name}`);
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusyId(null); }
  }

  // Demo persistence: mutate the in-memory project.tasks so other tabs + a
  // remount stay consistent (same pattern the other demo tabs use).
  function applyDemo(taskId, patch) {
    project.tasks = (project.tasks || []).map(t => t.id === taskId ? { ...t, ...patch } : t);
  }

  function onCreated() { setCreating(false); load().catch(e => setError(e.message || String(e))); }

  const members = useMemo(
    () => (project.memberRecords ?? []).map(m => m.profile).filter(p => p && p.id && p.full_name),
    [project.memberRecords],
  );

  // Resolve a task's milestone label. Real rows carry an embedded
  // milestone:{title}; demo rows only have milestone_id, so map it via the
  // project's milestones. Standalone tasks (no milestone) get no chip.
  const msTitleById = useMemo(() => {
    const map = {};
    if (isDemo) for (const ms of (project.milestones ?? [])) map[ms.id] = ms.title;
    for (const r of (rows ?? [])) if (r.milestone?.title) map[r.milestone_id] = r.milestone.title;
    return map;
  }, [isDemo, project?.milestones, rows]);

  const openCount = (rows ?? []).filter(t => t.status !== 'done').length;
  const doneCount = (rows ?? []).filter(t => t.status === 'done').length;

  return (
    <>
      <div className="pdf-toolbar">
        <div>
          <div className="pdf-kicker">Tasks</div>
          <div className="pdf-title">
            {rows?.length ? `${rows.length} task${rows.length === 1 ? '' : 's'}` : 'Nothing yet'}
          </div>
        </div>
        {isProfessor && (
          <button className="btn btn-p btn-sm" onClick={() => setCreating(true)}>+ New</button>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, textAlign: 'center' }}>
            <div className="tv a">{openCount}</div><div className="tl">Open</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, textAlign: 'center' }}>
            <div className="tv s">{doneCount}</div><div className="tl">Done</div>
          </div>
        </div>
      )}

      {flash && <div className="task-flash" role="status">{flash}</div>}
      {error && <div className="alert" style={{ marginBottom: 14 }}><span>◇</span><div>{error}</div></div>}

      {rows === null ? (
        <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-i">☑</div>
          <div className="empty-h">{isProfessor ? 'Create your first task' : 'No tasks yet'}</div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isProfessor ? 'Add a task and assign it to the team.' : 'Your professor hasn\'t added any tasks here yet.'}
          </p>
        </div>
      ) : (
        rows.map(t => {
          const busy = busyId === t.id;
          const mine = amAssignee(t);
          // Auto-task (Phase 3): mirrors an assignment. Status is assignment-
          // driven — no manual start/claim/status here. Submit (for the
          // assignee) routes into the assignment submission flow.
          const isAuto = !!t.assignment_id;
          const isLeader = t.assignee_mode === 'team_leader' && t.leader_id === myId;
          const canSubmit = !isProfessor && mine && (t.status === 'not_started' || t.status === 'in_progress');
          const canStart = !isProfessor && mine && t.status === 'not_started' && !isAuto;
          const canClaim = !isProfessor && t.assignee_mode === 'self_pick' && !mine && t.status !== 'done' && !isAuto;
          const showLeaderAssign = !isAuto && (isLeader || isProfessor) && t.assignee_mode === 'team_leader' && t._assignees.length === 0;
          const msLabel = t.milestone?.title ?? (t.milestone_id ? msTitleById[t.milestone_id] : null) ?? null;

          return (
            <div key={t.id} className="task-row">
              <div className="task-row-top">
                <div className="task-row-titlewrap">
                  <div className="task-row-title">{t.title}</div>
                  {msLabel && <span className="task-milestone-label" title="Part of milestone">◇ {msLabel}</span>}
                  {isAuto && <span className="task-assignment-label" title="Mirrors an assignment — status flows from it">↪ Assignment</span>}
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div className="task-row-foot">
                <div className="task-assignees">
                  {t._assignees.length === 0 ? (
                    <span className="task-unassigned">
                      {t.assignee_mode === 'self_pick' ? 'Open · unclaimed' : 'Unassigned'}
                    </span>
                  ) : (
                    t._assignees.slice(0, 3).map(a => (
                      <span key={a.id} className="task-assignee">
                        <Avatar name={a.full_name} size={18} />
                        <span>{a.full_name.split(' ')[0]}</span>
                      </span>
                    ))
                  )}
                  {t._assignees.length > 3 && <span className="task-unassigned">+{t._assignees.length - 3}</span>}
                </div>

                <div className="task-actions">
                  {canStart && (
                    <button type="button" className="btn btn-g btn-sm" disabled={busy} onClick={() => doStart(t)}>Start</button>
                  )}
                  {canClaim && (
                    <button type="button" className="btn btn-g btn-sm" disabled={busy} onClick={() => doClaim(t)}>{busy ? '…' : 'Claim'}</button>
                  )}
                  {canSubmit && (
                    <>
                      <button type="button" className="btn btn-p btn-sm" disabled={busy} onClick={() => fileInputs.current[t.id]?.click()}>
                        {busy ? 'Uploading…' : 'Submit Work'}
                      </button>
                      <input
                        ref={el => { fileInputs.current[t.id] = el; }}
                        type="file" accept="application/pdf,.pdf" hidden
                        onChange={e => onFileChange(t, e)}
                      />
                    </>
                  )}
                  {showLeaderAssign && (
                    <select className="task-mini-select" disabled={busy} defaultValue="" onChange={e => doLeaderAssign(t, e.target.value)}>
                      <option value="">Assign to…</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  )}
                  {isProfessor && !isAuto && (
                    <select
                      className="task-mini-select"
                      value={t.status}
                      disabled={busy}
                      onChange={e => doProfStatus(t, e.target.value)}
                      title="Set status (Done = approve)"
                    >
                      {TASK_STATUS_LADDER.map(s => <option key={s} value={s}>{taskStatusLabel(s)}</option>)}
                    </select>
                  )}
                  {isProfessor && isAuto && (
                    <span className="task-auto-note" title="Status flows from the assignment">assignment-driven</span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {creating && (
        <TaskCreateModal
          project={project}
          ownerId={myId}
          supabase={supabase}
          isDemo={isDemo}
          onClose={() => setCreating(false)}
          onCreated={onCreated}
        />
      )}
    </>
  );
}
