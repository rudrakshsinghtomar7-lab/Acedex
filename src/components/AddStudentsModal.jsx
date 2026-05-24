// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../providers/SessionProvider.jsx';
import Avatar from './Avatar.jsx';
import { inviteToTeam, searchProfiles } from '../lib/invitations.js';

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function AddStudentsModal({ teamId, existingMemberIds = [], onClose, onChanged, title = 'Add students' }) {
  const { supabase, profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const debounce = useRef(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const rows = await searchProfiles(supabase, {
          query,
          universityId: profile?.university_id,
          excludeProfileIds: existingMemberIds,
        });
        setResults(rows);
      } catch (e) { setError(e.message || String(e)); }
      finally { setSearching(false); }
    }, 220);
    return () => debounce.current && clearTimeout(debounce.current);
  }, [query, supabase, profile?.university_id, existingMemberIds]);

  const sendInvite = async ({ profileId = null, email = null }) => {
    setError(null); setNotice(null);
    setBusy(profileId || email);
    try {
      await inviteToTeam(supabase, { teamId, profileId, email });
      setNotice(email && !profileId
        ? `Invite saved for ${email}. They'll see it after signing up.`
        : 'Invite sent.');
      setQuery('');
      setResults([]);
      onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally { setBusy(null); }
  };

  const q = query.trim();
  const showEmailFallback = q.length > 0 && isEmail(q) && results.every(r => r.email.toLowerCase() !== q.toLowerCase());

  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle"/>
        <div className="sh-h2">{title}</div>

        <div className="field">
          <label>Search by name or email</label>
          <input
            className="input"
            autoFocus
            placeholder="alex@school.edu or Alex Chen"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {error  && <div className="key-warn" style={{ marginBottom: 12 }}>{error}</div>}
        {notice && <div className="alert" style={{ marginBottom: 12 }}><div>{notice}</div></div>}

        <div style={{ minHeight: 80, marginBottom: 14 }}>
          {searching && q && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Searching…</div>}
          {!searching && q && results.length === 0 && !showEmailFallback && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No matching students.</div>
          )}
          {results.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={p.full_name} size={36}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.email}</div>
                </div>
                <button
                  className="btn btn-p btn-sm"
                  disabled={busy === p.id}
                  onClick={() => sendInvite({ profileId: p.id })}
                >
                  {busy === p.id ? 'Sending…' : 'Invite'}
                </button>
              </div>
            </div>
          ))}
          {showEmailFallback && (
            <div className="card" style={{ marginBottom: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="notif-icon" style={{ width: 36, height: 36 }}>@</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Invite by email</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{q}</div>
                </div>
                <button
                  className="btn btn-g btn-sm"
                  disabled={busy === q}
                  onClick={() => sendInvite({ email: q })}
                >
                  {busy === q ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
