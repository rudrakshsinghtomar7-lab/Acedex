import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import ProgBar from '../components/ProgBar.jsx';
import ProgCircle from '../components/ProgCircle.jsx';
import StatusTag from '../components/StatusTag.jsx';

export default function Projects({role, projects, onOpenProject}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  let filtered = projects;
  if (filter==="active") filtered = projects.filter(p=>p.status==="active");
  if (filter==="at-risk") filtered = projects.filter(p=>p.status==="at-risk");
  if (filter==="completed") filtered = projects.filter(p=>p.status==="completed");
  if (filter==="insights") filtered = projects.filter(p=>p.insights.length>0);
  filtered = filtered.filter(p=>p.title.toLowerCase().includes(search.toLowerCase())||p.course.toLowerCase().includes(search.toLowerCase()));

  const filters = role==="professor"
    ? [["all","All"],["active","Active"],["at-risk","At risk"],["insights","Insights"],["completed","Done"]]
    : [["all","All"],["active","Active"],["at-risk","At risk"],["completed","Done"]];

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">All workspaces · {projects.length} total</div>
          <div className="display">Projects</div>
        </div>
      </div>
      <div className="search">
        <span style={{fontSize:16}}>⌕</span>
        <input placeholder="Search projects, courses..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="chips">
        {filters.map(([k,t]) => (
          <div key={k} className={`chip ${filter===k?"active":""}`} onClick={()=>setFilter(k)}>{t}</div>
        ))}
      </div>
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
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <StatusTag status={p.status}/>
                {role==="professor" && p.insights.length>0 && <span className="tag tag-a">✦ {p.insights.length}</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0 && (
          <div className="empty">
            <div className="empty-i">⌕</div>
            <div className="empty-h">No matches</div>
          </div>
        )}
      </div>
    </>
  );
}
