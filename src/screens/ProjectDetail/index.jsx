import { useState } from 'react';
import Overview from './Overview.jsx';
import Milestones from './Milestones.jsx';
import Tasks from './Tasks.jsx';
import Team from './Team.jsx';
import Activity from './Activity.jsx';
import Insights from './Insights.jsx';
import ProjectAI from './ProjectAI.jsx';

export default function ProjectDetail({project, role, onBack, apiKey}) {
  const [tab, setTab] = useState("overview");
  const tabs = role==="professor" ? ["overview","milestones","tasks","team","activity","insights","ai"] : ["overview","milestones","tasks","team","activity","ai"];
  return (
    <>
      <div className="sh-head">
        <button className="back" onClick={onBack}>←</button>
        <div className="sh-title">{project.title}</div>
        <button className="icon-btn" style={{width:36,height:36}}>···</button>
      </div>
      <div className="dtabs">
        {tabs.map(t => (
          <button key={t} className={`dtab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t==="insights"?"✦ Insights":t==="ai"?"✦ AI":t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{padding:"20px 24px"}}>
        {tab==="overview" && <Overview project={project} role={role}/>}
        {tab==="milestones" && <Milestones project={project}/>}
        {tab==="tasks" && <Tasks project={project}/>}
        {tab==="team" && <Team project={project}/>}
        {tab==="activity" && <Activity project={project}/>}
        {tab==="insights" && role==="professor" && <Insights project={project}/>}
        {tab==="ai" && <ProjectAI project={project} role={role} apiKey={apiKey}/>}
      </div>
    </>
  );
}
