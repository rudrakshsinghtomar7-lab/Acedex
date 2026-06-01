// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';

// Type-the-name-to-confirm guard for the permanent project delete. onConfirm is
// an async fn supplied by the parent (real → deleteProject; demo → in-memory
// splice). On success the parent navigates away, unmounting this.
export default function DeleteProjectModal({ project, onClose, onConfirm }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const match = typed.trim() === (project.title ?? '').trim() && typed.trim().length > 0;

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function handleDelete() {
    if (!match || busy) return;
    setBusy(true); setError(null);
    try {
      await onConfirm();
      // success → parent redirects; leave busy true so the button can't refire.
    } catch (e) {
      setError(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="ovl" onClick={() => !busy && onClose()}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div aria-hidden style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-bright)', margin: '0 auto 14px' }} />
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '4px 0 12px' }}>
          Delete “{project.title}”?
        </h3>

        <div style={{
          background: 'rgba(var(--error-rgb),.10)', border: '1px solid rgba(var(--error-rgb),.32)',
          color: 'var(--text-2)', borderRadius: 'var(--r-md)', padding: '12px 14px',
          fontSize: 13, lineHeight: 1.55, marginBottom: 18,
        }}>
          <strong style={{ color: 'var(--error)' }}>This is permanent.</strong> It deletes the
          project and <strong>everything in it</strong> — tasks, milestones, assignments,
          submissions, grades, PDFs and comments. This cannot be undone.
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
          Type the project name to confirm:
        </label>
        <input
          className="input"
          type="text"
          autoFocus
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleDelete(); }}
          placeholder={project.title}
          aria-label="Project name confirmation"
        />

        {error && (
          <div className="alert" style={{ marginTop: 12 }}><span>◇</span><div>{error}</div></div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn btn-g" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1.4,
              background: match ? 'var(--error)' : 'var(--bg-3)',
              color: match ? '#fff' : 'var(--muted)',
              border: '1px solid transparent',
              cursor: match && !busy ? 'pointer' : 'not-allowed',
            }}
            disabled={!match || busy}
            onClick={handleDelete}
          >
            {busy ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  );
}
