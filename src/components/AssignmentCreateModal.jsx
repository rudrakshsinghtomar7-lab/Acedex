import { useEffect, useState } from 'react';
import { createAssignment } from '../lib/assignments.js';

export default function AssignmentCreateModal({ project, ownerId, supabase, isDemo, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function onSubmit() {
    const t = title.trim();
    if (!t) { setError('Title is required.'); return; }
    setError(null);
    setBusy(true);
    try {
      if (isDemo) {
        // Local-only synthetic row so the tab renders in demo without DB.
        const row = {
          id: `demo-asgn-${Date.now()}`,
          team_id: project.id,
          title: t,
          description: description.trim() || null,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          owner_id: 'demo-prof-1',
          owner: { id: 'demo-prof-1', full_name: 'Dr. Sarah Rivera', role: 'professor' },
          status: 'active',
          order_idx: (project.assignments?.length ?? 0) + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        project.assignments = [...(project.assignments || []), row];
        onCreated(row);
        return;
      }
      const isoDue = dueAt ? new Date(dueAt).toISOString() : null;
      const row = await createAssignment(supabase, {
        teamId: project.id,
        ownerId,
        title: t,
        description: description.trim(),
        dueAt: isoDue,
      });
      onCreated(row);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ovl pdf-modal-ovl" onClick={() => !busy && onClose()}>
      <div className="pdf-card-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pdf-card-head">
          <div className="pdf-file-icon" style={{ background: 'rgba(124,108,255,.12)', borderColor: 'rgba(124,108,255,.32)', color: 'var(--indigo-bright)' }}>NEW</div>
          <div className="pdf-card-titleblock">
            <div className="pdf-card-title">Create assignment</div>
            <div className="pdf-card-meta">{project.title}</div>
          </div>
          <button type="button" className="btn-icon-x" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Title</label>
          <input
            className="input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Methodology section"
            maxLength={120}
            autoFocus
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Description</label>
          <textarea
            className="textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What should students hand in?"
          />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Due date <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· optional</span></label>
          <input
            className="input"
            type="datetime-local"
            value={dueAt}
            onChange={e => setDueAt(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 12 }}>
            <span>◇</span><div>{error}</div>
          </div>
        )}

        <div className="pdf-card-actions">
          <button type="button" className="btn btn-g pdf-card-btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-p pdf-card-btn"
            disabled={busy || !title.trim()}
            onClick={onSubmit}
          >{busy ? 'Creating…' : 'Create assignment'}</button>
        </div>
      </div>
    </div>
  );
}
