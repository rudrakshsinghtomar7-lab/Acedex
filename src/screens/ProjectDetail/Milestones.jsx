// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import TaskCreateModal from '../../components/TaskCreateModal.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { useDemoMode } from '../../hooks/useDemoMode.jsx';
import {
  addTaskToMilestone,
  createMilestone,
  deleteMilestone,
  listTeamMilestones,
  milestoneRollup,
  removeTaskFromMilestone,
  updateMilestone,
} from '../../lib/milestones.js';
import { listTeamTasks, taskStatusLabel } from '../../lib/tasks.js';
import StatusTag from '../../components/StatusTag.jsx';
import { spineClass, isDoneState } from '../../utils/status.js';

function assigneesOf(t) {
  if (Array.isArray(t.assignees)) return t.assignees.map(a => a.student).filter(Boolean);
  if (t.assignee) return [{ id: t.assignee, full_name: t.assignee }];
  return [];
}
function taskStatus(t) { return t.status ?? (t.done ? 'done' : 'not_started'); }

function StatusBadge({ status }) {
  return <span className={`task-badge task-badge-${status}`}>{taskStatusLabel(status)}</span>;
}

export default function Milestones({ project, role }) {
  const { supabase, user } = useAuth();
  const { demoMode, demoRole } = useDemoMode();
  const isDemo = typeof project?.id === 'string' && project.id.startsWith('demo-');
  const isProfessor = role === 'professor';
  // Demo-prof showcase: creating a milestone persists nothing (visual-only),
  // even on a real project. Real professors are never in demo mode, so their
  // createMilestone path is unchanged.
  const noPersist = isDemo || (demoMode && demoRole === 'professor');
  const myId = isDemo ? (isProfessor ? 'demo-prof-1' : 'demo-student-1') : user?.id;

  const [milestones, setMilestones] = useState(null);
  const [standalone, setStandalone] = useState([]); // tasks with no milestone
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);          // show new-milestone input
  const [renaming, setRenaming] = useState(null);       // milestone id being renamed
  const [renameText, setRenameText] = useState('');
  const [createTaskFor, setCreateTaskFor] = useState(null); // milestone id for TaskCreateModal

  async function load() {
    setError(null);
    if (isDemo) {
      const tasks = project.tasks ?? [];
      const ms = (project.milestones ?? []).map(m => ({ ...m, tasks: tasks.filter(t => t.milestone_id === m.id) }));
      setMilestones(ms);
      setStandalone(tasks.filter(t => !t.milestone_id));
      return;
    }
    const [ms, allTasks] = await Promise.all([
      listTeamMilestones(supabase, project.id),
      listTeamTasks(supabase, project.id),
    ]);
    setMilestones(ms);
    setStandalone(allTasks.filter(t => !t.milestone_id));
  }

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setMilestones(null);
    load().catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project?.id, isDemo, project?.milestones, project?.tasks]);

  // ── demo mutation helpers ────────────────────────────────────────────────
  function demoSetTaskMilestone(taskId, milestoneId) {
    project.tasks = (project.tasks || []).map(t => t.id === taskId ? { ...t, milestone_id: milestoneId } : t);
  }

  async function run(fn) {
    setBusy(true); setError(null);
    try { await fn(); await load(); }
    catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function onCreateMilestone() {
    const title = newTitle.trim();
    if (!title) return;
    await run(async () => {
      if (noPersist) {
        const row = { id: `demo-ms-${Date.now()}`, team_id: project.id, title, order_idx: (project.milestones?.length ?? 0) + 1 };
        project.milestones = [...(project.milestones || []), row];
      } else {
        await createMilestone(supabase, { teamId: project.id, createdBy: myId, title, orderIdx: (milestones?.length ?? 0) + 1 });
      }
    });
    setNewTitle(''); setAdding(false);
  }

  async function onRename(m) {
    const title = renameText.trim();
    if (!title) { setRenaming(null); return; }
    await run(async () => {
      if (isDemo) project.milestones = (project.milestones || []).map(x => x.id === m.id ? { ...x, title } : x);
      else await updateMilestone(supabase, { milestoneId: m.id, title });
    });
    setRenaming(null);
  }

  async function onDelete(m) {
    await run(async () => {
      if (isDemo) {
        // FK ON DELETE SET NULL — tasks become standalone, not deleted.
        project.tasks = (project.tasks || []).map(t => t.milestone_id === m.id ? { ...t, milestone_id: null } : t);
        project.milestones = (project.milestones || []).filter(x => x.id !== m.id);
      } else {
        await deleteMilestone(supabase, m.id);
      }
    });
  }

  async function onAddTask(milestoneId, taskId) {
    if (!taskId) return;
    await run(async () => {
      if (isDemo) demoSetTaskMilestone(taskId, milestoneId);
      else await addTaskToMilestone(supabase, { taskId, milestoneId });
    });
  }

  async function onRemoveTask(taskId) {
    await run(async () => {
      if (isDemo) demoSetTaskMilestone(taskId, null);
      else await removeTaskFromMilestone(supabase, taskId);
    });
  }

  return (
    <>
      <div className="pdf-toolbar">
        <div>
          <div className="pdf-kicker">Milestones</div>
          <div className="pdf-title">
            {milestones?.length ? `${milestones.length} milestone${milestones.length === 1 ? '' : 's'}` : 'Nothing yet'}
          </div>
        </div>
        {isProfessor && !adding && (
          <button className="btn btn-p btn-sm" onClick={() => setAdding(true)}>+ New</button>
        )}
      </div>

      {isProfessor && adding && (
        <div className="ms-new-row">
          <input
            className="input" type="text" autoFocus value={newTitle} maxLength={120}
            placeholder="Milestone title (e.g. Phase 1 — Research)"
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onCreateMilestone(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
          />
          <button className="btn btn-p btn-sm" disabled={busy || !newTitle.trim()} onClick={onCreateMilestone}>Create</button>
          <button className="btn btn-g btn-sm" disabled={busy} onClick={() => { setAdding(false); setNewTitle(''); }}>Cancel</button>
        </div>
      )}

      {error && <div className="alert" style={{ marginBottom: 14 }}><span>◇</span><div>{error}</div></div>}

      {milestones === null ? (
        <div className="empty"><div className="spin" style={{ margin: '0 auto' }}/></div>
      ) : milestones.length === 0 ? (
        <div className="empty">
          <div className="empty-i">◇</div>
          <div className="empty-h">{isProfessor ? 'Create your first milestone' : 'No milestones yet'}</div>
          <p className="empty-quote">{isProfessor ? 'Chapters give a long project its shape.' : 'No chapters have been drawn here yet.'}</p>
        </div>
      ) : (
        milestones.map((m) => {
          const tasks = (m.tasks ?? []).slice().sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
          const roll = milestoneRollup(tasks);
          const addable = standalone; // tasks not in any milestone
          return (
            <div key={m.id} className={`ms-card has-spine${isDoneState(roll.status)?' is-done':''}`}>
              <span className={spineClass(roll.status)}/>
              <div className="ms-card-head">
                {renaming === m.id ? (
                  <input
                    className="input" autoFocus value={renameText} maxLength={120}
                    onChange={e => setRenameText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onRename(m); if (e.key === 'Escape') setRenaming(null); }}
                    onBlur={() => onRename(m)}
                  />
                ) : (
                  <div className="ms-card-title">{m.title}</div>
                )}
                <StatusTag status={roll.status} />
              </div>

              <div className="ms-prog-line">
                <div className="ms-prog"><div className="ms-prog-fill" style={{ width: `${Math.round(roll.progress * 100)}%` }} /></div>
                <span className="ms-prog-label">{roll.doneCount}/{roll.total} done</span>
              </div>

              <div className="ms-tasks">
                {tasks.length === 0 ? (
                  <div className="task-unassigned" style={{ padding: '4px 0' }}>No tasks yet.</div>
                ) : (
                  tasks.map(t => {
                    const who = assigneesOf(t);
                    return (
                      <div key={t.id} className="ms-task">
                        <div className="ms-task-main">
                          <div className="ms-task-title">{t.title}</div>
                          <div className="ms-task-meta">
                            {who.length === 0
                              ? <span className="task-unassigned">{t.assignee_mode === 'self_pick' ? 'Open · unclaimed' : 'Unassigned'}</span>
                              : who.slice(0, 3).map(a => (
                                  <span key={a.id} className="task-assignee"><Avatar name={a.full_name} size={16} /><span>{a.full_name.split(' ')[0]}</span></span>
                                ))}
                          </div>
                        </div>
                        <StatusBadge status={taskStatus(t)} />
                        {isProfessor && (
                          <button type="button" className="ms-task-remove" title="Remove from milestone (keeps the task)" disabled={busy} onClick={() => onRemoveTask(t.id)}>×</button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {isProfessor && (
                <div className="ms-card-actions">
                  <button type="button" className="btn btn-g btn-sm" disabled={busy} onClick={() => setCreateTaskFor(m.id)}>+ New task</button>
                  {addable.length > 0 && (
                    <select className="task-mini-select" disabled={busy} defaultValue="" onChange={e => { onAddTask(m.id, e.target.value); e.target.value = ''; }}>
                      <option value="">Add existing task…</option>
                      {addable.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  )}
                  <button type="button" className="btn btn-g btn-sm" disabled={busy} onClick={() => { setRenaming(m.id); setRenameText(m.title); }}>Rename</button>
                  <button type="button" className="ms-del-btn" disabled={busy} onClick={() => onDelete(m)}>Delete</button>
                </div>
              )}
            </div>
          );
        })
      )}

      {createTaskFor && (
        <TaskCreateModal
          project={project}
          ownerId={myId}
          supabase={supabase}
          isDemo={isDemo}
          milestoneId={createTaskFor}
          onClose={() => setCreateTaskFor(null)}
          onCreated={() => { setCreateTaskFor(null); load().catch(e => setError(e.message || String(e))); }}
        />
      )}
    </>
  );
}
