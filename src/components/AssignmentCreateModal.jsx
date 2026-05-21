import { useEffect, useMemo, useRef, useState } from 'react';
import { createAssignment } from '../lib/assignments.js';

function uid() { return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function Segmented({ value, onChange, options }) {
  return (
    <div className="role-switch" style={{ margin: 0 }}>
      {options.map(o => (
        <div
          key={o.value}
          className={`role-opt ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(o.value); } }}
        >{o.label}</div>
      ))}
    </div>
  );
}

export default function AssignmentCreateModal({ project, ownerId, supabase, isDemo, onClose, onCreated }) {
  const members = useMemo(
    () => (project.memberRecords ?? [])
      .map(m => m.profile)
      .filter(p => p && p.id && p.full_name),
    [project.memberRecords],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignmentType, setAssignmentType] = useState('individual');
  const [assigneeIds, setAssigneeIds] = useState([]); // for individual mode
  const [subtasks, setSubtasks] = useState([]);
  const [distributionMode, setDistributionMode] = useState('professor');
  const [leaderId, setLeaderId] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [dueAt, setDueAt] = useState('');
  const [deadlineType, setDeadlineType] = useState('hard');
  const [graceDays, setGraceDays] = useState('3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const aiCheck = false; // AI plagiarism check ships in Phase 8; toggle is disabled with a "Coming soon" label.

  function toggleAssignee(id) {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // Modal-open behavior: pin scroll to the top so the Title field is the
  // first thing the user sees, then focus it after a tiny delay so iOS
  // brings up the keyboard cleanly. The delay also lets the slide-in
  // animation finish before the focus ring shows up.
  const bodyRef = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // iOS resizes the viewport when the keyboard slides up; on long forms a
  // focused field below the fold can end up hidden under the keyboard. Pull
  // the focused field into the center of the modal body after the
  // keyboard-animation settles.
  function onFieldFocus(e) {
    const el = e.target;
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      catch { /* older Safari versions */ }
    }, 280);
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const addSubtask = () => setSubtasks(prev => [...prev, { tempId: uid(), title: '', description: '', assignedTo: '' }]);
  const updateSubtask = (id, patch) => setSubtasks(prev => prev.map(s => s.tempId === id ? { ...s, ...patch } : s));
  const removeSubtask = (id) => setSubtasks(prev => prev.filter(s => s.tempId !== id));

  const isTeam = assignmentType === 'team';
  const cleanSubtasks = subtasks.map(s => ({ ...s, title: s.title.trim() })).filter(s => s.title);

  function validate() {
    if (!title.trim()) return 'Title is required.';
    if (isTeam) {
      if (cleanSubtasks.length === 0) return 'Team assignments need at least one subtask.';
      if (distributionMode === 'professor') {
        const missing = cleanSubtasks.some(s => !s.assignedTo);
        if (missing) return 'Assign every subtask to a student.';
      }
      if (distributionMode === 'team_leader' && !leaderId) {
        return 'Pick a team leader.';
      }
    }
    if (deadlineType === 'grace' && (!graceDays || Number(graceDays) < 0)) {
      return 'Grace period must be a non-negative number of days.';
    }
    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        const row = {
          id: `demo-asgn-${Date.now()}`,
          team_id: project.id,
          title: title.trim(),
          description: description.trim() || null,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          owner_id: 'demo-prof-1',
          owner: { id: 'demo-prof-1', full_name: 'Dr. Sarah Rivera', role: 'professor' },
          status: 'active',
          order_idx: (project.assignments?.length ?? 0) + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignment_type: assignmentType,
          max_points: maxPoints ? Number(maxPoints) : null,
          deadline_type: deadlineType,
          grace_days: deadlineType === 'grace' ? Number(graceDays) : null,
          ai_plagiarism_check: aiCheck,
          distribution_mode: isTeam ? distributionMode : null,
          subtasks: isTeam ? cleanSubtasks.map(s => ({
            id: `demo-sub-${uid()}`,
            title: s.title,
            description: s.description || null,
            assigned_to: distributionMode === 'professor' ? (s.assignedTo || null) : null,
            assignee: distributionMode === 'professor' && s.assignedTo
              ? members.find(m => m.id === s.assignedTo)
              : null,
            status: 'open',
            claimed_at: null,
            created_at: new Date().toISOString(),
          })) : [],
          leaders: isTeam && distributionMode === 'team_leader' && leaderId
            ? [{ leader_id: leaderId, leader: members.find(m => m.id === leaderId) }]
            : [],
          submissions: [],
        };
        project.assignments = [...(project.assignments || []), row];
        onCreated(row);
        return;
      }
      const isoDue = dueAt ? new Date(dueAt).toISOString() : null;
      const row = await createAssignment(supabase, {
        teamId: project.id,
        ownerId,
        title: title.trim(),
        description: description.trim(),
        dueAt: isoDue,
        assignmentType,
        maxPoints: maxPoints ? Number(maxPoints) : null,
        deadlineType,
        graceDays: deadlineType === 'grace' ? Number(graceDays) : null,
        aiPlagiarismCheck: aiCheck,
        distributionMode: isTeam ? distributionMode : null,
        subtasks: isTeam ? cleanSubtasks : [],
        leaderId: isTeam && distributionMode === 'team_leader' ? leaderId : null,
        assigneeIds: !isTeam ? assigneeIds : [],
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
            <div className="pdf-kicker">New Assignment</div>
            <div className="pdf-title">{project.title}</div>
          </div>
          <button type="button" className="btn-icon-x" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </header>

        <div className="asgn-detail-body asgn-create-body" ref={bodyRef}>
          <div className="field">
            <label>Title</label>
            <input
              ref={titleRef}
              className="input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onFocus={onFieldFocus}
              placeholder="Research paper"
              maxLength={120}
            />
          </div>
          <div className="field">
            <label>Description <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· optional</span></label>
            <textarea
              className="textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onFocus={onFieldFocus}
              placeholder="What should students hand in?"
            />
          </div>

          <div className="asgn-section-h">Type</div>
          <Segmented
            value={assignmentType}
            onChange={setAssignmentType}
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'team',       label: 'Team' },
            ]}
          />

          {!isTeam && (
            <>
              <div className="asgn-section-h">
                Assignees
                <span style={{ color: 'var(--muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                  {assigneeIds.length === 0 ? 'All team members' : `${assigneeIds.length} selected`}
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
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleAssignee(m.id)}
                      />
                      <span>{m.full_name}</span>
                    </label>
                  );
                })}
              </div>
              {assigneeIds.length > 0 && (
                <button type="button" className="pdf-link-btn" onClick={() => setAssigneeIds([])} style={{ marginTop: 4 }}>
                  Clear → assign to everyone
                </button>
              )}
            </>
          )}

          {isTeam && (
            <>
              <div className="asgn-section-h">
                Subtasks
                <button type="button" className="pdf-link-btn" onClick={addSubtask}>+ Add task</button>
              </div>
              {subtasks.length === 0 ? (
                <div className="pdf-muted" style={{ padding: '4px 0 8px' }}>No subtasks yet — add at least one to split the work.</div>
              ) : (
                <div className="asgn-subtasks">
                  {subtasks.map(s => (
                    <div key={s.tempId} className="asgn-subtask-row">
                      <div className="asgn-subtask-fields">
                        <input
                          className="input"
                          type="text"
                          placeholder="Subtask title"
                          value={s.title}
                          onChange={e => updateSubtask(s.tempId, { title: e.target.value })}
                          maxLength={120}
                        />
                        <input
                          className="input"
                          type="text"
                          placeholder="Brief description (optional)"
                          value={s.description}
                          onChange={e => updateSubtask(s.tempId, { description: e.target.value })}
                          maxLength={240}
                        />
                        {distributionMode === 'professor' && (
                          <select
                            className="input"
                            value={s.assignedTo}
                            onChange={e => updateSubtask(s.tempId, { assignedTo: e.target.value })}
                          >
                            <option value="">Assign to…</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-icon-x"
                        aria-label="Remove subtask"
                        onClick={() => removeSubtask(s.tempId)}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="asgn-section-h">How are tasks distributed?</div>
              <div className="asgn-dist-modes">
                {[
                  { value: 'professor',   label: 'Professor assigns each task' },
                  { value: 'team_leader', label: 'A team leader assigns them' },
                  { value: 'self_pick',   label: 'Students self-pick (open pool)' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`asgn-dist-mode ${distributionMode === opt.value ? 'active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="dist-mode"
                      value={opt.value}
                      checked={distributionMode === opt.value}
                      onChange={() => setDistributionMode(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>

              {distributionMode === 'team_leader' && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label>Team leader</label>
                  <select className="input" value={leaderId} onChange={e=>setLeaderId(e.target.value)}>
                    <option value="">Pick a leader…</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {distributionMode === 'self_pick' && (
                <div className="pdf-muted" style={{ padding: '4px 0 8px' }}>
                  Subtasks land in an open pool — any team member can claim one.
                </div>
              )}
            </>
          )}

          <div className="asgn-section-h">Grading & deadline</div>
          <div className="field">
            <label>Max points</label>
            <input className="input" type="number" min="0" max="10000" value={maxPoints} onChange={e=>setMaxPoints(e.target.value)} onFocus={onFieldFocus} />
          </div>
          <div className="field">
            <label>Due date <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· optional</span></label>
            <input className="input" type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} onFocus={onFieldFocus} />
          </div>
          <Segmented
            value={deadlineType}
            onChange={setDeadlineType}
            options={[
              { value: 'hard',  label: 'Hard deadline' },
              { value: 'grace', label: 'Grace period' },
            ]}
          />
          {deadlineType === 'grace' && (
            <div className="field" style={{ marginTop: 10 }}>
              <label>Grace days</label>
              <input className="input" type="number" min="0" max="60" value={graceDays} onChange={e=>setGraceDays(e.target.value)} onFocus={onFieldFocus} />
            </div>
          )}

          <div className="asgn-ai-row disabled" aria-disabled="true" title="Coming soon">
            <input type="checkbox" disabled checked={false} readOnly />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                AI plagiarism check
                <span className="asgn-soon-badge">Coming soon</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
                Will run Claude relevance, similarity, and web checks on each submission. Lands with Feature 8.
              </div>
            </div>
          </div>

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
            >{busy ? 'Creating…' : 'Create Assignment'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
