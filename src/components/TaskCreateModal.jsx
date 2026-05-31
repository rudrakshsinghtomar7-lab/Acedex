// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createTask, TASK_ASSIGNEE_MODES } from '../lib/tasks.js';

// Professor-only. Phase 1 fields: title + the three-mode assignee picker
// (same vocabulary as assignments' distribution_mode). Status always starts at
// 'not_started'. Reuses the assignment-create modal's classes so it matches the
// rest of the project workspace in both themes.
export default function TaskCreateModal({ project, ownerId, supabase, isDemo, onClose, onCreated }) {
  const members = useMemo(
    () => (project.memberRecords ?? [])
      .map(m => m.profile)
      .filter(p => p && p.id && p.full_name),
    [project.memberRecords],
  );

  const [title, setTitle] = useState('');
  const [assigneeMode, setAssigneeMode] = useState('professor');
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const titleRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  function toggleAssignee(id) {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function validate() {
    if (!title.trim()) return 'Title is required.';
    if (assigneeMode === 'team_leader' && !leaderId) return 'Pick a team leader.';
    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        const chosen = assigneeMode === 'professor'
          ? members.filter(m => assigneeIds.includes(m.id))
          : [];
        const row = {
          id: `demo-task-${Date.now()}`,
          team_id: project.id,
          title: title.trim(),
          status: 'not_started',
          done: false,
          assignee_mode: assigneeMode,
          leader_id: assigneeMode === 'team_leader' ? (leaderId || null) : null,
          created_by: 'demo-prof-1',
          assignees: chosen.map(m => ({
            id: `demo-ta-${m.id}-${Date.now()}`,
            student_id: m.id,
            student: { id: m.id, full_name: m.full_name, avatar_url: null, role: 'student' },
          })),
        };
        project.tasks = [...(project.tasks || []), row];
        onCreated(row);
        return;
      }
      const row = await createTask(supabase, {
        teamId: project.id,
        createdBy: ownerId,
        title: title.trim(),
        assigneeMode,
        assigneeIds: assigneeMode === 'professor' ? assigneeIds : [],
        leaderId: assigneeMode === 'team_leader' ? leaderId : null,
      });
      onCreated(row);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ovl pdf-full-ovl" onClick={() => !busy && onClose()}>
      <div className="pdf-fullviewer asgn-create-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="pdf-fullviewer-head">
          <div className="pdf-fullviewer-titleblock">
            <div className="pdf-kicker">New Task</div>
            <div className="pdf-title">{project.title}</div>
          </div>
          <button type="button" className="btn-icon-x" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </header>

        <div className="asgn-detail-body asgn-create-body">
          <div className="field">
            <label>Title</label>
            <input
              ref={titleRef}
              className="input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Annotate dataset"
              maxLength={120}
            />
          </div>

          <div className="asgn-section-h">Who picks the assignee?</div>
          <div className="asgn-dist-modes">
            {TASK_ASSIGNEE_MODES.map(opt => (
              <label
                key={opt.value}
                className={`asgn-dist-mode ${assigneeMode === opt.value ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="task-mode"
                  value={opt.value}
                  checked={assigneeMode === opt.value}
                  onChange={() => setAssigneeMode(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {assigneeMode === 'professor' && (
            <>
              <div className="asgn-section-h">
                Assignees
                <span style={{ color: 'var(--muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                  {assigneeIds.length === 0 ? 'None yet' : `${assigneeIds.length} selected`}
                </span>
              </div>
              <div className="asgn-assignee-grid">
                {members.length === 0 && (
                  <div className="pdf-muted" style={{ padding: '4px 0 8px' }}>No team members yet.</div>
                )}
                {members.map(m => {
                  const on = assigneeIds.includes(m.id);
                  return (
                    <label key={m.id} className={`asgn-assignee-chip ${on ? 'active' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleAssignee(m.id)} />
                      <span>{m.full_name}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {assigneeMode === 'team_leader' && (
            <div className="field" style={{ marginTop: 10 }}>
              <label>Team leader</label>
              <select className="input" value={leaderId} onChange={e => setLeaderId(e.target.value)}>
                <option value="">Pick a leader…</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
              <div className="pdf-muted" style={{ padding: '6px 0 0' }}>
                This person assigns the task to a teammate from the Tasks list.
              </div>
            </div>
          )}

          {assigneeMode === 'self_pick' && (
            <div className="pdf-muted" style={{ padding: '4px 0 8px' }}>
              The task lands in an open pool — any team member can claim it from the Tasks list.
            </div>
          )}

          {error && (
            <div className="alert" style={{ marginTop: 12 }}>
              <span>◇</span><div>{error}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button type="button" className="btn btn-g" style={{ flex: 1 }} disabled={busy} onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-p"
              style={{ flex: 2 }}
              disabled={busy || !title.trim()}
              onClick={onSubmit}
            >{busy ? 'Creating…' : 'Create Task'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
