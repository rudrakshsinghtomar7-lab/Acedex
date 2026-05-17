import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar.jsx';

function memberBadge(roleInTeam) {
  if (roleInTeam === 'leader') return { t: 'Leader', c: 'tag-a' };
  return { t: 'Member', c: 'tag-m' };
}

export default function Team({project}) {
  const prof = project.professor;
  const members = project.memberRecords ?? [];
  const total = (prof ? 1 : 0) + members.length;

  return (
    <>
      <div style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>{total} {total === 1 ? 'Member' : 'Members'}</div>

      {prof && (
        <Link to={`/profile/${prof.id}`} className="card" style={{marginBottom:10,textDecoration:'none',color:'inherit',display:'block'}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Avatar name={prof.full_name} size={44}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14.5,letterSpacing:"-0.015em"}}>{prof.full_name}</div>
              <div style={{fontSize:12.5,color:"var(--muted)",marginTop:3,fontWeight:500}}>Course professor</div>
            </div>
            <span className="tag tag-a">Professor</span>
          </div>
        </Link>
      )}

      {members.map(m => {
        const p = m.profile;
        if (!p) return null;
        const b = memberBadge(m.role_in_team);
        return (
          <Link key={p.id} to={`/profile/${p.id}`} className="card" style={{marginBottom:10,textDecoration:'none',color:'inherit',display:'block'}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <Avatar name={p.full_name} size={44}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14.5,letterSpacing:"-0.015em"}}>{p.full_name}</div>
                <div style={{fontSize:12.5,color:"var(--muted)",marginTop:3,fontWeight:500}}>{p.role === 'professor' ? 'Professor' : 'Student'}</div>
              </div>
              <span className={`tag ${b.c}`}>{b.t}</span>
            </div>
          </Link>
        );
      })}

      {total === 0 && (
        <div className="empty"><div className="empty-h">No members yet</div></div>
      )}
    </>
  );
}
