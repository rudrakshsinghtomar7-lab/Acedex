// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar.jsx';
import AddStudentsModal from '../../components/AddStudentsModal.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { removeTeamMember } from '../../lib/invitations.js';

function memberBadge(roleInTeam) {
  if (roleInTeam === 'leader') return { t: 'Leader', c: 'tag-a' };
  return { t: 'Member', c: 'tag-m' };
}

export default function Team({ project, role, onMembersChanged }) {
  const { supabase, user } = useAuth();
  const [modal, setModal] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);

  const prof = project.professor;
  const members = project.memberRecords ?? [];
  const total = (prof ? 1 : 0) + members.length;

  const isProf = role === 'professor';
  const iAmMember = members.some(m => m.profile?.id === user?.id);
  const existingMemberIds = members.map(m => m.profile?.id).filter(Boolean);
  if (prof?.id) existingMemberIds.push(prof.id);

  const onRemove = async (profileId) => {
    if (!confirm('Remove this member from the team?')) return;
    setError(null);
    setRemoving(profileId);
    try {
      await removeTeamMember(supabase, { teamId: project.id, profileId });
      onMembersChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally { setRemoving(null); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {total} {total === 1 ? 'Member' : 'Members'}
        </div>
        {(isProf || iAmMember) && (
          <button className="btn btn-p btn-sm" onClick={() => setModal(isProf ? 'add' : 'invite')}>
            {isProf ? '+ Add students' : '+ Invite peer'}
          </button>
        )}
      </div>

      {error && <div className="key-warn" style={{ marginBottom: 12 }}>{error}</div>}

      {prof && (
        <Link to={`/profile/${prof.id}`} className="card" style={{ marginBottom: 10, textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={prof.full_name} size={44}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.015em' }}>{prof.full_name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, fontWeight: 500 }}>Course professor</div>
            </div>
            <span className="tag tag-a">Professor</span>
          </div>
        </Link>
      )}

      {members.map(m => {
        const p = m.profile;
        if (!p) return null;
        const b = memberBadge(m.role_in_team);
        const canRemove = isProf && p.id !== user?.id;
        return (
          <div key={p.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link to={`/profile/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <Avatar name={p.full_name} size={44}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.015em' }}>{p.full_name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, fontWeight: 500 }}>{p.role === 'professor' ? 'Professor' : 'Student'}</div>
                </div>
                <span className={`tag ${b.c}`}>{b.t}</span>
              </Link>
              {canRemove && (
                <button
                  className="icon-btn"
                  style={{ width: 32, height: 32, fontSize: 14 }}
                  onClick={() => onRemove(p.id)}
                  disabled={removing === p.id}
                  aria-label="Remove member"
                  title="Remove from team"
                >×</button>
              )}
            </div>
          </div>
        );
      })}

      {total === 0 && (
        <div className="empty"><div className="empty-h">No members yet</div><p className="empty-quote">A collaboration of one, for now.</p></div>
      )}

      {modal && (
        <AddStudentsModal
          teamId={project.id}
          existingMemberIds={existingMemberIds}
          title={modal === 'add' ? 'Add students' : 'Invite a peer'}
          onClose={() => setModal(null)}
          onChanged={onMembersChanged}
        />
      )}
    </>
  );
}
