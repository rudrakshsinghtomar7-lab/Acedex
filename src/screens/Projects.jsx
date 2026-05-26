// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import FilterChips from '../components/FilterChips.jsx';
import ProgBar from '../components/ProgBar.jsx';
import ProgCircle from '../components/ProgCircle.jsx';
import StatusTag from '../components/StatusTag.jsx';
import { useAuth } from '../providers/SessionProvider.jsx';
import { useDemoMode } from '../hooks/useDemoMode.jsx';
import { adaptTeam, listTeamsForUser } from '../lib/teams.js';

export default function Projects({role}) {
  const { supabase, user } = useAuth();
  const { demoMode, demoData } = useDemoMode();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user?.id || !role) return;
    let cancelled = false;
    (async () => {
      try {
        const teams = await listTeamsForUser(supabase, { role, userId: user.id });
        if (cancelled) return;
        setProjects(teams.map(t => adaptTeam(t, t.members)));
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, role, supabase]);

  const onOpenProject = (p) => navigate(`/projects/${p.id}`);

  const demoOn = demoMode && demoData;
  const isProf = role === 'professor';
  const demoProjects = demoOn
    ? (isProf
        ? demoData.DEMO_PROJECTS
        : demoData.getDemoProjectsForStudent(demoData.DEMO_CURRENT_STUDENT_ID))
    : [];
  const allProjects = demoOn ? [...projects, ...demoProjects] : projects;

  let filtered = allProjects;
  if (filter === 'active') filtered = allProjects.filter(p => p.status === 'active');
  if (filter === 'at_risk') filtered = allProjects.filter(p => p.status === 'at_risk');
  if (filter === 'completed') filtered = allProjects.filter(p => p.status === 'completed');
  filtered = filtered.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
    || (p.course ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filters = [['all','All'],['active','Active'],['at_risk','At risk'],['completed','Done']];

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">All workspaces · {allProjects.length} total</div>
          <div className="display">Projects</div>
        </div>
        <Link to="/projects/create" className="icon-btn" style={{textDecoration:'none',fontSize:20,fontWeight:600}}>+</Link>
      </div>
      <div className="search">
        <span style={{fontSize:16}}>⌕</span>
        <input placeholder="Search projects, courses..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <FilterChips items={filters} active={filter} onChange={setFilter} />

      {error && demoOn && allProjects.length > 0 && (
        <div className="alert" style={{margin:'0 24px 14px',background:'rgba(var(--warn-rgb),.08)',borderColor:'rgba(var(--warn-rgb),.18)'}}>
          <span style={{fontSize:13}}>◇</span>
          <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.5}}>
            <strong>Showing demo data only.</strong> Couldn't load real projects: {error}
          </div>
        </div>
      )}

      {loading && !demoOn ? (
        <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>
      ) : error && !demoOn ? (
        <div className="empty"><div className="empty-h">Couldn't load projects</div><p style={{fontSize:13,color:'var(--muted)'}}>{error}</p></div>
      ) : allProjects.length === 0 ? (
        <div className="empty">
          <div className="empty-i">⊞</div>
          <div className="empty-h">No projects yet</div>
          <p style={{fontSize:13,color:'var(--muted)'}}>
            Create your first project to get started.
          </p>
          <Link to="/projects/create" className="btn btn-p btn-bl" style={{display:'inline-block',marginTop:16,textDecoration:'none'}}>Create project</Link>
        </div>
      ) : (
        <div className="section">
          {filtered.map(p => (
            <div key={p.id} className="card" onClick={()=>onOpenProject(p)}>
              <div className="card-head">
                <div style={{flex:1,minWidth:0}}>
                  <div className="card-title">{p.title}</div>
                  <div className="card-sub">{p.course}</div>
                </div>
                <ProgCircle value={p.progress}/>
              </div>
              <ProgBar value={p.progress}/>
              <div className="card-meta">
                <div className="av-s">{p.members.slice(0,3).map(m => <Avatar key={m} name={m} size={24}/>)}</div>
                <div style={{display:'flex',gap:7,alignItems:'center'}}>
                  <StatusTag status={p.status}/>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-i">⌕</div>
              <div className="empty-h">No matches</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

