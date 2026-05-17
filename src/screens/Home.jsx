import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HEATMAP, heatColor } from '../data/projects.js';
import Avatar from '../components/Avatar.jsx';
import ProgBar from '../components/ProgBar.jsx';
import ProgCircle from '../components/ProgCircle.jsx';
import StatusTag from '../components/StatusTag.jsx';
import { useAuth } from '../providers/SessionProvider.jsx';
import { useDemoMode } from '../hooks/useDemoMode.jsx';
import {
  adaptTeam, listTeamsForUser,
  loadHomeStatsForProfessor, loadHomeStatsForStudent,
} from '../lib/teams.js';

function statSoonStyle(soon) {
  return soon ? { opacity: 0.55 } : undefined;
}

export default function Home({role, projects: fakeProjects = [], openSettings}) {
  const { user, profile, supabase } = useAuth();
  const [demoMode] = useDemoMode();
  const navigate = useNavigate();

  const tokens = (profile?.full_name ?? '').split(/\s+/).filter(Boolean);
  const firstName = tokens[0] ?? '';
  const lastName = tokens[tokens.length - 1] ?? '';
  const isProf = role === 'professor';
  const greeting = !firstName
    ? (isProf ? 'Welcome back' : 'Hi there')
    : isProf
      ? <>Welcome back, <span className="accent">Prof. {lastName}</span></>
      : <>Hey <span className="accent">{firstName}</span></>;

  const [stats, setStats] = useState(null);
  const [realProjects, setRealProjects] = useState([]);
  const [dataError, setDataError] = useState(null);

  useEffect(() => {
    if (!user?.id || !role) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, teams] = await Promise.all([
          role === 'professor'
            ? loadHomeStatsForProfessor(supabase, user.id)
            : loadHomeStatsForStudent(supabase, user.id),
          listTeamsForUser(supabase, { role, userId: user.id }),
        ]);
        if (cancelled) return;
        setStats(s);
        setRealProjects(teams.map(t => adaptTeam(t, t.members)));
      } catch (e) {
        if (!cancelled) setDataError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, role, supabase]);

  const onOpenProject = (p) => navigate(`/projects/${p.id}`);

  // Fake-derived numbers for demo mode (only computed if demoMode is on)
  const demoFakeTotalTasks = demoMode ? fakeProjects.flatMap(p => p.tasks ?? []).length : 0;
  const demoFakeDoneTasks  = demoMode ? fakeProjects.flatMap(p => p.tasks ?? []).filter(t => t.done).length : 0;
  const demoFakeActiveMs   = demoMode ? fakeProjects.flatMap(p => p.milestones ?? []).filter(m => m.status === 'active').length : 0;
  const demoFakeInsights   = demoMode ? fakeProjects.reduce((a, p) => a + (p.insights ?? []).filter(i => i.type !== 'positive').length, 0) : 0;

  const realValOrSoon = (v) => (stats ? v : '—');

  const statTiles = isProf
    ? [
        { i: '⊞', v: realValOrSoon(stats?.projects), l: 'Projects' },
        { i: '◐', v: realValOrSoon(stats?.students), l: 'Students' },
        demoMode
          ? { i: '✦', v: demoFakeInsights, l: 'Insights' }
          : { i: '✦', v: '—', l: 'Insights (soon)', soon: true },
        { i: '◇', v: realValOrSoon(stats?.atRisk), l: 'At Risk' },
      ]
    : [
        { i: '⊞', v: realValOrSoon(stats?.projects), l: 'Active Projects' },
        demoMode
          ? { i: '✓', v: `${demoFakeDoneTasks}/${demoFakeTotalTasks}`, l: 'Tasks Done' }
          : { i: '✓', v: '—', l: 'Tasks Done (soon)', soon: true },
        demoMode
          ? { i: '◎', v: demoFakeActiveMs, l: 'Active Milestones' }
          : { i: '◎', v: '—', l: 'Active Milestones (soon)', soon: true },
        demoMode
          ? { i: '↗', v: '12d', l: 'Streak' }
          : { i: '↗', v: '—', l: 'Streak (soon)', soon: true },
      ];

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Friday, May 8</div>
          <div className="display">{greeting}</div>
        </div>
        <button className="icon-btn" onClick={openSettings}>⚙</button>
      </div>

      {demoMode && (
        <div className="demo-banner">
          <span style={{fontSize:13}}>✦</span>
          <div><strong>Demo mode</strong> · placeholders mixed with real data</div>
        </div>
      )}

      {demoMode && !isProf && (
        <div className="welcome">
          <div className="welcome-eye">This week</div>
          <div className="welcome-t">{demoFakeActiveMs} active milestone{demoFakeActiveMs !== 1 ? 's' : ''} · keep momentum</div>
          <div className="welcome-s">You're contributing consistently. Strong work on the literature review.</div>
        </div>
      )}
      {demoMode && isProf && demoFakeInsights > 0 && (
        <div style={{margin:'0 24px 28px'}}>
          <div className="welcome" style={{margin:0}}>
            <div className="welcome-eye">For your review</div>
            <div className="welcome-t">{demoFakeInsights} workflow insight{demoFakeInsights !== 1 ? 's' : ''} surfaced</div>
            <div className="welcome-s">Claude noticed patterns worth a brief look. Final judgment is always yours.</div>
          </div>
        </div>
      )}

      <div className="stats">
        {statTiles.map((s, i) => (
          <div key={i} className="stat" style={statSoonStyle(s.soon)}>
            <div className="stat-icon">{s.i}</div>
            <div className="stat-v">{s.v}</div>
            <div className="stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-head"><h3>{isProf ? 'Supervised projects' : 'Your projects'}</h3></div>
        {dataError ? (
          <div className="empty"><div className="empty-h">Couldn't load projects</div><p style={{fontSize:13,color:'var(--muted)'}}>{dataError}</p></div>
        ) : realProjects.length === 0 ? (
          <div className="empty">
            <div className="empty-i">⊞</div>
            <div className="empty-h">No projects yet</div>
            <p style={{fontSize:13,color:'var(--muted)'}}>
              {isProf ? 'Create your first project from the Projects tab.' : 'You haven\'t been added to any projects yet.'}
            </p>
          </div>
        ) : realProjects.map(p => (
          <div key={p.id} className="card" onClick={() => onOpenProject(p)}>
            <div className="card-head">
              <div style={{flex:1,minWidth:0}}>
                <div className="card-title">{p.title}</div>
                <div className="card-sub">{p.course}</div>
              </div>
              <ProgCircle value={p.progress}/>
            </div>
            <ProgBar value={p.progress}/>
            <div className="card-meta">
              <div className="av-s">
                {p.members.slice(0,3).map(m => <Avatar key={m} name={m} size={24}/>)}
                {p.members.length > 3 && (
                  <div className="av" style={{width:24,height:24,fontSize:9,background:'var(--bg-3)',color:'var(--muted)',border:'2px solid var(--bg-1)',marginLeft:-8,fontWeight:700}}>+{p.members.length - 3}</div>
                )}
              </div>
              <div style={{display:'flex',gap:7,alignItems:'center'}}>
                <StatusTag status={p.status}/>
                {p.dueDate && <span style={{fontSize:12.5,color:'var(--muted)',fontWeight:500}}>Due {p.dueDate}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isProf && demoMode && (
        <div className="section">
          <div className="section-head"><h3>Your activity</h3></div>
          <div className="card" style={{padding:18,cursor:'default'}}>
            <div className="heat">
              {HEATMAP.slice(0,70).map((v,i) => <div key={i} className="h-c" style={{background:heatColor(v)}}/>)}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,fontSize:11.5,color:'var(--muted)',fontWeight:500}}>
              <span>10 weeks</span>
              <div style={{display:'flex',gap:5,alignItems:'center'}}>
                <span>Less</span>
                {[0,1,2,3,4].map(v => <div key={v} style={{width:10,height:10,borderRadius:3,background:heatColor(v)}}/>)}
                <span>More</span>
              </div>
              <span>Today</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
