// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import ProgBar from '../components/ProgBar.jsx';
import { useAuth } from '../providers/SessionProvider.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import { loadExtension, completenessFor } from '../lib/profile.js';

export default function Profile({role, projects, openSettings}) {
  const { supabase, profile, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const me = profile?.full_name ?? '';
  const [ext, setExt] = useState(null);

  useEffect(() => {
    if (!profile?.id || !profile?.role) return;
    let cancelled = false;
    (async () => {
      try {
        const e = await loadExtension(supabase, profile.id, profile.role);
        if (!cancelled) setExt(e);
      } catch { /* ignore — Profile still renders */ }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, supabase]);

  const pct = completenessFor(profile, ext);
  const isProf = role === 'professor';
  const subtitle = isProf
    ? [ext?.title, ext?.department && ext.department !== 'TBD' ? ext.department : null].filter(Boolean).join(' · ')
    : [ext?.year, ext?.major].filter(Boolean).join(' · ');

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <div className="header">
        <div><div className="greeting">Settings & profile</div><div className="display">Profile</div></div>
        <button className="icon-btn" onClick={openSettings}>⚙</button>
      </div>
      <div style={{textAlign:"center",padding:"12px 24px 28px"}}>
        <div style={{display:"inline-block",position:"relative",marginBottom:16}}>
          <Avatar name={me} size={92}/>
          <div style={{position:"absolute",bottom:2,right:2,width:28,height:28,background:"var(--grad)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,border:"3px solid var(--bg-0)",boxShadow:"0 4px 12px rgba(var(--accent-rgb),.35)"}}>✓</div>
        </div>
        <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.025em"}}>{me}</div>
        {subtitle && <div style={{fontSize:13.5,color:"var(--muted)",marginTop:5,fontWeight:500}}>{subtitle}</div>}
      </div>

      <div style={{padding:'0 24px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,fontSize:12.5,color:'var(--muted)',fontWeight:600}}>
          <span>Profile completeness</span>
          <span>{pct}%</span>
        </div>
        <ProgBar value={pct}/>
        <Link to="/profile/edit" className="btn btn-p btn-bl" style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:14}}>
          Edit profile
        </Link>
      </div>

      <div className="section">
        <div className="pstats">
          <div className="pstat"><div className="v a">{projects.length}</div><div className="l">Projects</div></div>
          <div className="pdiv"/>
          <div className="pstat"><div className="v">{isProf?"23":"12"}</div><div className="l">{isProf?"Reviews":"Streak"}</div></div>
          <div className="pdiv"/>
          <div className="pstat"><div className="v">{isProf?"12":"4/9"}</div><div className="l">{isProf?"Students":"Achievements"}</div></div>
        </div>
      </div>
      <div className="section">
        <div className="section-head"><h3>Settings</h3></div>
        <div className="set" onClick={openSettings}>
          <div className="set-i">🔑</div>
          <div className="set-info">
            <div className="set-t">Claude API key</div>
            <div className="set-s">Set up Claude AI integration</div>
          </div>
          <span className="chev">›</span>
        </div>
        <div className="set" onClick={toggleTheme} style={{cursor:'pointer'}}>
          <div className="set-i">{theme === 'dark' ? '🌙' : '☀️'}</div>
          <div className="set-info">
            <div className="set-t">Appearance</div>
            <div className="set-s">{theme === 'dark' ? 'Dark theme' : 'Light theme'}</div>
          </div>
          <span className="chev">›</span>
        </div>
        {[
          {i:"🔔",t:"Notifications",s:"Manage alerts"},
          {i:"🔒",t:"Privacy & security",s:"Account and data"},
          {i:"💬",t:"Help & support",s:"Documentation"}
        ].map((it,i) => (
          <div key={i} className="set">
            <div className="set-i">{it.i}</div>
            <div className="set-info"><div className="set-t">{it.t}</div><div className="set-s">{it.s}</div></div>
            <span className="chev">›</span>
          </div>
        ))}
        <button className="btn btn-bl btn-g" style={{marginTop:16}} onClick={onSignOut}>Sign out</button>
      </div>
    </>
  );
}
