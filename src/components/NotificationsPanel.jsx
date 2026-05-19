import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';
import { useDemoMode } from '../hooks/useDemoMode.jsx';
import {
  listNotifications, markAsRead, markAllAsRead, dismissNotification,
  relativeTime, TYPE_GLYPH,
} from '../lib/notifications.js';
import {
  acceptInvitation, declineInvitation, findPendingInvitation,
} from '../lib/invitations.js';

export default function NotificationsPanel({ onClose, onChanged }) {
  const { supabase, user } = useAuth();
  const { demoMode, demoData } = useDemoMode();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    setError(null);
    if (demoMode) {
      // In demo mode the panel sources from the in-memory fixture; the
      // mark-read / dismiss / accept-invite mutations all become local no-ops
      // (or local-state toggles) so demo state stays self-contained.
      setRows(demoData?.DEMO_NOTIFICATIONS ?? []);
      return;
    }
    if (!user?.id) return;
    let cancelled = false;
    listNotifications(supabase, user.id)
      .then(d => { if (!cancelled) setRows(d); })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [supabase, user?.id, demoMode, demoData]);

  const updateRow = (id, patch) =>
    setRows(rs => rs ? rs.map(r => r.id === id ? { ...r, ...patch } : r) : rs);

  const removeRow = (id) =>
    setRows(rs => rs ? rs.filter(r => r.id !== id) : rs);

  const onMarkRead = async (n) => {
    if (n.read) return;
    updateRow(n.id, { read: true });
    if (demoMode) return;
    try { await markAsRead(supabase, n.id); onChanged?.(); }
    catch (e) { setError(e.message); updateRow(n.id, { read: false }); }
  };

  const onMarkAll = async () => {
    if (!rows || rows.every(r => r.read)) return;
    setBusy('all');
    const prev = rows;
    setRows(rs => rs.map(r => ({ ...r, read: true })));
    if (demoMode) { setBusy(null); return; }
    try { await markAllAsRead(supabase, user.id); onChanged?.(); }
    catch (e) { setError(e.message); setRows(prev); }
    finally { setBusy(null); }
  };

  const onDismiss = async (n) => {
    setBusy(n.id);
    const prev = rows;
    removeRow(n.id);
    if (demoMode) { setBusy(null); return; }
    try { await dismissNotification(supabase, n.id); onChanged?.(); }
    catch (e) { setError(e.message); setRows(prev); }
    finally { setBusy(null); }
  };

  // Tap → navigate to the link (if any), close the panel, then mark read.
  // The accept/decline/dismiss buttons stopPropagation so they don't trigger
  // navigation through the row click.
  const onActivate = (n) => {
    if (n.link) {
      onClose?.();
      navigate(n.link);
    }
    onMarkRead(n);
  };

  const resolveInvitation = async (n) => {
    if (!n.related_team_id || !user?.id) return null;
    return findPendingInvitation(supabase, { teamId: n.related_team_id, recipientId: user.id });
  };

  const onAccept = async (n) => {
    setError(null);
    setBusy(n.id);
    try {
      const inv = await resolveInvitation(n);
      if (!inv) throw new Error('Invitation no longer pending');
      await acceptInvitation(supabase, inv.id);
      removeRow(n.id);
      onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally { setBusy(null); }
  };

  const onDecline = async (n) => {
    setError(null);
    setBusy(n.id);
    try {
      const inv = await resolveInvitation(n);
      if (!inv) throw new Error('Invitation no longer pending');
      await declineInvitation(supabase, inv.id);
      removeRow(n.id);
      onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally { setBusy(null); }
  };

  const unread = rows?.filter(r => !r.read).length ?? 0;

  return (
    <div className="ovl ovl-r" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="sh-h2" style={{ marginBottom: 2 }}>Notifications</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {unread > 0 && (
              <button className="btn btn-g btn-sm" onClick={onMarkAll} disabled={busy === 'all'}>
                Mark all read
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ width: 36, height: 36 }}>×</button>
          </div>
        </div>

        {error && (
          <div className="key-warn" style={{ marginBottom: 12 }}>{error}</div>
        )}

        <div className="panel-body">
          {rows === null ? (
            <div className="empty"><div className="spin" style={{ margin: '0 auto' }} /></div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="empty-i">◔</div>
              <div className="empty-h">No notifications</div>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>You'll see invites, mentions, and updates here.</p>
            </div>
          ) : (
            rows.map(n => (
              <NotificationRow
                key={n.id}
                n={n}
                busy={busy === n.id}
                onActivate={() => onActivate(n)}
                onDismiss={() => onDismiss(n)}
                onAccept={() => onAccept(n)}
                onDecline={() => onDecline(n)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationRow({ n, busy, onActivate, onDismiss, onAccept, onDecline }) {
  const glyph = TYPE_GLYPH[n.type] ?? '◉';
  const isInvite = n.type === 'team_invite' && !!n.related_team_id;
  const clickable = !!n.link;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <div
      className={`notif ${n.read ? '' : 'notif-unread'} ${clickable ? 'notif-clickable' : ''}`}
      onClick={onActivate}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } } : undefined}
    >
      <div className="notif-icon">{glyph}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="notif-title">{n.title}</div>
        {n.body && <div className="notif-body">{n.body}</div>}
        <div className="notif-meta">
          <span>{relativeTime(n.created_at)}</span>
          {n.team?.name && <span className="notif-dot">·</span>}
          {n.team?.name && <span>{n.team.name}</span>}
        </div>
        {isInvite && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={busy} onClick={stop(onAccept)}>
              {busy ? '…' : 'Accept'}
            </button>
            <button className="btn btn-g btn-sm" disabled={busy} onClick={stop(onDecline)}>
              Decline
            </button>
          </div>
        )}
      </div>
      <button
        className="icon-btn"
        onClick={stop(onDismiss)}
        disabled={busy}
        aria-label="Dismiss"
        style={{ width: 30, height: 30, fontSize: 14, flexShrink: 0 }}
      >×</button>
    </div>
  );
}
