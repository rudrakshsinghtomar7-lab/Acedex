// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { heatColor } from '../data/projects.js';
import Avatar from '../components/Avatar.jsx';
import Bell from '../components/Bell.jsx';
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

export default function Home({role, openSettings, openNotif, notifUnread}) {
  const { user, profile, supabase } = useAuth();
  const { demoMode, demoData } = useDemoMode();
  const navigate = useNavigate();
  const demoOn = demoMode && demoData;

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
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !role) return;
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      try {
        setDataError(null);
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
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, role, supabase]);

  const onOpenProject = (p) => navigate(`/projects/${p.id}`);

  // Demo projects visible to this user: pros see everything, students see only
  // projects where the demo persona is a member.
  const demoProjects = demoOn
    ? (isProf
        ? demoData.DEMO_PROJECTS
        : demoData.getDemoProjectsForStudent(demoData.DEMO_CURRENT_STUDENT_ID))
    : [];

  // Combined view: real (when available) + demo. If the real fetch errored
  // and demo is on, surface demo only and render the error as a soft banner.
  const allProjects = demoOn ? [...realProjects, ...demoProjects] : realProjects;

  // Numbers feeding the stat tiles use the same filtered list so a student's
  // tiles match what they actually see in the projects section.
  const dProj = demoOn ? demoProjects : [];
  const demoFakeTotalTasks = demoOn ? dProj.flatMap(p => p.tasks ?? []).length : 0;
  const demoFakeDoneTasks  = demoOn ? dProj.flatMap(p => p.tasks ?? []).filter(t => t.done).length : 0;
  const demoFakeActiveMs   = demoOn ? dProj.flatMap(p => p.milestones ?? []).filter(m => m.status === 'active').length : 0;
  const demoFakeInsights   = demoOn ? dProj.reduce((a, p) => a + (p.insights ?? []).filter(i => i.type !== 'positive').length, 0) : 0;

  // Stats: real + (when demo on) demoData.DEMO_STATS. Falls back to demo-only
  // when the real fetch errored so tiles aren't stuck on '—'.
  const dStats = demoOn ? (isProf ? demoData.DEMO_STATS.professor : demoData.DEMO_STATS.student) : null;
  const combinedStats = (stats || demoOn) ? {
    projects: (stats?.projects ?? 0) + (dStats?.projects ?? 0),
    students: (stats?.students ?? 0) + (dStats?.students ?? 0),
    atRisk:   (stats?.atRisk   ?? 0) + (dStats?.atRisk   ?? 0),
  } : null;

  const realValOrSoon = (v) => (combinedStats ? v : '—');

  const statTiles = isProf
    ? [
        { i: '⊞', v: realValOrSoon(combinedStats?.projects), l: 'Projects' },
        { i: '◐', v: realValOrSoon(combinedStats?.students), l: 'Students' },
        demoOn
          ? { i: '✦', v: demoFakeInsights, l: 'Insights' }
          : { i: '✦', v: '—', l: 'Insights (soon)', soon: true },
        { i: '◇', v: realValOrSoon(combinedStats?.atRisk), l: 'At Risk' },
      ]
    : [
        { i: '⊞', v: realValOrSoon(combinedStats?.projects), l: 'Active Projects' },
        demoOn
          ? { i: '✓', v: `${demoFakeDoneTasks}/${demoFakeTotalTasks}`, l: 'Tasks Done' }
          : { i: '✓', v: '—', l: 'Tasks Done (soon)', soon: true },
        demoOn
          ? { i: '◎', v: demoFakeActiveMs, l: 'Active Milestones' }
          : { i: '◎', v: '—', l: 'Active Milestones (soon)', soon: true },
        demoOn
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
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Bell count={notifUnread ?? 0} onClick={openNotif}/>
          <button className="icon-btn" onClick={openSettings}>⚙</button>
        </div>
      </div>

      {demoMode && (
        <div className="demo-banner">
          <span style={{fontSize:13}}>✦</span>
          <div><strong>Demo mode</strong> · placeholders mixed with real data</div>
        </div>
      )}

      {demoOn && !isProf && (
        <div className="welcome">
          <div className="welcome-eye">This week</div>
          <div className="welcome-t">{demoFakeActiveMs} active milestone{demoFakeActiveMs !== 1 ? 's' : ''} · keep momentum</div>
          <div className="welcome-s">You're contributing consistently. Strong work on the literature review.</div>
        </div>
      )}
      {demoOn && isProf && demoFakeInsights > 0 && (
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
        {dataError && demoOn && allProjects.length > 0 && (
          <div className="alert" style={{marginBottom:14,background:'rgba(245,181,107,.08)',borderColor:'rgba(245,181,107,.18)'}}>
            <span style={{fontSize:13}}>◇</span>
            <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.5}}>
              <strong>Showing demo data only.</strong> Couldn't load real projects: {dataError}
            </div>
          </div>
        )}
        {dataError && !demoOn ? (
          <div className="empty"><div className="empty-h">Couldn't load projects</div><p style={{fontSize:13,color:'var(--muted)'}}>{dataError}</p></div>
        ) : dataLoading && realProjects.length === 0 && !demoOn ? (
          <div className="empty"><div className="spin" style={{margin:'0 auto'}}/></div>
        ) : allProjects.length === 0 ? (
          <div className="empty">
            <div className="empty-i">⊞</div>
            <div className="empty-h">No projects yet</div>
            <p style={{fontSize:13,color:'var(--muted)'}}>
              {isProf ? 'Create your first project from the Projects tab.' : 'You haven\'t been added to any projects yet.'}
            </p>
          </div>
        ) : allProjects.map(p => (
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

      {!isProf && demoOn && (
        <div className="section">
          <div className="section-head"><h3>Your activity</h3></div>
          <div className="card" style={{padding:18,cursor:'default'}}>
            <div className="heat">
              {demoData.DEMO_HEATMAP.slice(0,70).map((v,i) => <div key={i} className="h-c" style={{background:heatColor(v)}}/>)}
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
