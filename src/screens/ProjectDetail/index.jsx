import { useEffect, useState } from 'react';
import Overview from './Overview.jsx';
import Milestones from './Milestones.jsx';
import Tasks from './Tasks.jsx';
import Team from './Team.jsx';
import Activity from './Activity.jsx';
import Insights from './Insights.jsx';
import ProjectAI from './ProjectAI.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { adaptTeam, getTeamDetail } from '../../lib/teams.js';

export default function ProjectDetail({id, role, onBack, apiKey}) {
  const { supabase } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
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
  }, [id, supabase]);

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
    ? ['overview','milestones','tasks','team','activity','insights','ai']
    : ['overview','milestones','tasks','team','activity','ai'];

  return (
    <>
      <div className="sh-head">
        <button className="back" onClick={onBack}>←</button>
        <div className="sh-title">{project.title}</div>
        <button className="icon-btn" style={{width:36,height:36}}>···</button>
      </div>
      <div className="dtabs">
        {tabs.map(t => (
          <button key={t} className={`dtab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='insights'?'✦ Insights':t==='ai'?'✦ AI':t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{padding:'20px 24px'}}>
        {tab==='overview' && <Overview project={project} role={role}/>}
        {tab==='milestones' && <Milestones project={project}/>}
        {tab==='tasks' && <Tasks project={project}/>}
        {tab==='team' && <Team project={project}/>}
        {tab==='activity' && <Activity project={project}/>}
        {tab==='insights' && role==='professor' && <Insights project={project}/>}
        {tab==='ai' && <ProjectAI project={project} role={role} apiKey={apiKey}/>}
      </div>
    </>
  );
}
