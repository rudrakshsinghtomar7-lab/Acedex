import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { useAuth } from '../providers/SessionProvider.jsx';
import { useDemoMode } from '../hooks/useDemoMode.jsx';
import { loadExtension, loadProfileById } from '../lib/profile.js';

export default function ProfileView() {
  const { id } = useParams();
  const { supabase, user } = useAuth();
  const { demoData } = useDemoMode();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [ext, setExt] = useState(null);
  const [error, setError] = useState(null);

  const isDemoId = !!id && id.startsWith('demo-');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    setExt(null);

    // Demo profile: resolve from in-memory demo data; no Supabase query.
    // Wait if demoData hasn't finished its dynamic import yet.
    if (isDemoId) {
      if (!demoData) return;
      const p = demoData.findDemoProfileById(id);
      if (cancelled) return;
      setProfile(p);
      setExt(p); // demo records carry year/major/interests/etc. inline
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const p = await loadProfileById(supabase, id);
        if (cancelled) return;
        setProfile(p);
        if (p) {
          const e = await loadExtension(supabase, p.id, p.role);
          if (!cancelled) setExt(e);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, supabase, isDemoId, demoData]);

  if (user?.id === id) return <Navigate to="/profile" replace/>;

  if (loading) {
    return <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>;
  }

  if (error) {
    return <div className="empty"><div className="empty-h">Couldn't load profile</div><p style={{fontSize:13,color:'var(--muted)'}}>{error}</p></div>;
  }

  if (!profile) {
    return <div className="empty"><div className="empty-h">Not visible</div><p style={{fontSize:13,color:'var(--muted)'}}>This profile isn't accessible to you.</p></div>;
  }

  const name = profile.full_name;
  const isProf = profile.role === 'professor';
  const sub = isProf
    ? [ext?.title, ext?.department].filter(Boolean).join(' · ')
    : [ext?.year, ext?.major].filter(Boolean).join(' · ');

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">{isProf ? 'Professor' : 'Student'}</div>
          <div className="display">{name}</div>
        </div>
      </div>

      <div style={{textAlign:'center',padding:'12px 24px 28px'}}>
        <Avatar name={name} size={92}/>
        <div style={{fontSize:22,fontWeight:700,letterSpacing:'-0.025em',marginTop:14}}>{name}</div>
        {sub && <div style={{fontSize:13.5,color:'var(--muted)',marginTop:5,fontWeight:500}}>{sub}</div>}
      </div>

      {profile.bio && (
        <div className="section">
          <div className="section-head"><h3>About</h3></div>
          <div className="card" style={{padding:18,cursor:'default',fontSize:13.5,lineHeight:1.55,color:'var(--text-1)'}}>{profile.bio}</div>
        </div>
      )}

      {!ext && (
        <div className="section">
          <div className="card" style={{padding:18,cursor:'default',fontSize:13,color:'var(--muted)'}}>
            Details on this profile aren't visible to you.
          </div>
        </div>
      )}

      {ext && isProf && (
        <div className="section">
          <div className="section-head"><h3>Faculty details</h3></div>
          <div className="card" style={{padding:18,cursor:'default',display:'grid',gap:10,fontSize:13.5}}>
            {ext.research_areas?.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Subjects</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {ext.research_areas.map(s => (
                    <span key={s} className="tag" style={{padding:'4px 10px',borderRadius:999,background:'var(--bg-3)',fontSize:12,fontWeight:600}}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {ext.office_location && <div><span style={{color:'var(--muted)'}}>Office:</span> {ext.office_location}</div>}
            {ext.office_hours && <div><span style={{color:'var(--muted)'}}>Hours:</span> {ext.office_hours}</div>}
            {ext.homepage_url && <div><a href={ext.homepage_url} target="_blank" rel="noreferrer" style={{color:'var(--indigo-bright)',textDecoration:'none'}}>{ext.homepage_url}</a></div>}
          </div>
        </div>
      )}

      {ext && !isProf && (
        <div className="section">
          <div className="section-head"><h3>Student details</h3></div>
          <div className="card" style={{padding:18,cursor:'default',display:'grid',gap:10,fontSize:13.5}}>
            {ext.interests?.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Interests</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {ext.interests.map(s => (
                    <span key={s} className="tag" style={{padding:'4px 10px',borderRadius:999,background:'var(--bg-3)',fontSize:12,fontWeight:600}}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
