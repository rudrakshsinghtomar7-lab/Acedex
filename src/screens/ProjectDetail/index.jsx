// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Overview from './Overview.jsx';
import Milestones from './Milestones.jsx';
import Tasks from './Tasks.jsx';
import Assignments from './Assignments.jsx';
import Team from './Team.jsx';
import Activity from './Activity.jsx';
import Insights from './Insights.jsx';
import PDFs from './PDFs.jsx';
import ProjectAI from './ProjectAI.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { useDemoMode } from '../../hooks/useDemoMode.jsx';
import { adaptTeam, getTeamDetail } from '../../lib/teams.js';

export default function ProjectDetail({id, role, onBack, apiKey, initialTab, initialPdfId, initialPage}) {
  const { supabase } = useAuth();
  const { demoMode, demoData } = useDemoMode();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(initialTab || 'overview');
  const [refreshTick, setRefreshTick] = useState(0);
  const refetch = () => setRefreshTick(n => n + 1);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProject(null);

    // Demo projects use string ids like 'demo-proj-1'. Bypass the DB fetch.
    if (id.startsWith('demo-')) {
      if (!demoMode || !demoData) {
        setError('This project is part of demo mode. Enable "Show demo data" in Settings → Developer to view it.');
        setLoading(false);
        return;
      }
      const p = demoData.DEMO_PROJECTS.find(x => x.id === id);
      if (!p) setError('Demo project not found.');
      else setProject(p);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const detail = await getTeamDetail(supabase, id);
        if (cancelled) return;
        if (!detail) {
          setError('Project not found or not visible.');
        } else {
          setProject(adaptTeam(detail.team, detail.members));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, supabase, demoMode, demoData, refreshTick]);

  if (loading) {
    return (
      <>
        <div className="sh-head">
          <button className="back" onClick={onBack}>←</button>
          <div className="sh-title">Loading…</div>
        </div>
        <div className="empty"><div className="spin" style={{margin:'0 auto'}}/></div>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <div className="sh-head">
          <button className="back" onClick={onBack}>←</button>
          <div className="sh-title">Project</div>
        </div>
        <div className="empty">
          <div className="empty-h">Couldn't load this project</div>
          <p style={{fontSize:13,color:'var(--muted)'}}>{error || 'Not visible.'}</p>
        </div>
      </>
    );
  }

  const tabs = role === 'professor'
    ? ['overview','milestones','tasks','team','pdfs','assignments','activity','insights','ai']
    : ['overview','milestones','tasks','team','pdfs','assignments','activity','ai'];

  return (
    <>
      <div className="sh-head">
        <button className="back" onClick={onBack}>←</button>
        <div className="sh-title">{project.title}</div>
        <button className="icon-btn" style={{width:36,height:36}}>···</button>
      </div>
      <DTabs tabs={tabs} active={tab} onChange={setTab} />
      <div style={{padding:'20px 24px'}}>
        {tab==='overview' && <Overview project={project} role={role}/>}
        {tab==='milestones' && <Milestones project={project}/>}
        {tab==='tasks' && <Tasks project={project} role={role}/>}
        {tab==='assignments' && <Assignments project={project} role={role}/>}
        {tab==='team' && <Team project={project} role={role} onMembersChanged={refetch}/>}
        {tab==='pdfs' && <PDFs project={project} initialPdfId={initialPdfId} initialPage={initialPage}/>}
        {tab==='activity' && <Activity project={project}/>}
        {tab==='insights' && role==='professor' && <Insights project={project}/>}
        {tab==='ai' && <ProjectAI project={project} role={role} apiKey={apiKey}/>}
      </div>
    </>
  );
}

function tabLabel(t) {
  if (t === 'insights')    return '✦ Insights';
  if (t === 'ai')          return '✦ AI';
  if (t === 'pdfs')        return 'PDFs';
  if (t === 'assignments') return 'Assignments';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Variable-width sliding pill behind the active tab. We measure each button's
// offsetLeft / offsetWidth / offsetTop / offsetHeight after layout and write
// them into a single absolutely-positioned .dtab-pill. left + width transition
// together so the pill morphs between tabs the same way the bottom-nav pill
// slides. Because the pill is positioned inside the overflow-x:auto scroll
// container, its offset coordinates already live in content space — when the
// user scrolls horizontally the pill stays glued to its tab.
function DTabs({ tabs, active, onChange }) {
  const refs = useRef({});
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    const el = refs.current[active];
    if (!el) { setPill(p => ({ ...p, ready: false })); return; }
    setPill({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      ready: true,
    });
  }, [active, tabs.join('|')]);

  return (
    <div className="dtabs">
      <span
        className="dtab-pill"
        aria-hidden
        style={{
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
          opacity: pill.ready ? 1 : 0,
        }}
      />
      {tabs.map(t => (
        <button
          key={t}
          ref={el => { refs.current[t] = el; }}
          className={`dtab ${active === t ? 'active' : ''}`}
          onClick={() => onChange(t)}
        >
          {tabLabel(t)}
        </button>
      ))}
    </div>
  );
}
