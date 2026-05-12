import { useNavigate } from 'react-router-dom';
import { HEATMAP, heatColor } from '../data/projects.js';
import Avatar from '../components/Avatar.jsx';
import ProgBar from '../components/ProgBar.jsx';
import ProgCircle from '../components/ProgCircle.jsx';

export default function Home({role, projects, setRole, openSettings}) {
  const navigate = useNavigate();
  const onOpenProject = (p) => navigate(`/projects/${p.id}`);
  const totalTasks = projects.flatMap(p=>p.tasks).length;
  const doneTasks = projects.flatMap(p=>p.tasks).filter(t=>t.done).length;
  const activeMs = projects.flatMap(p=>p.milestones).filter(m=>m.status==="active").length;
  const totalInsights = projects.reduce((a,p)=>a+p.insights.filter(i=>i.type!=="positive").length,0);
  const atRisk = projects.filter(p=>p.status==="at-risk").length;

  const stats = role==="professor"
    ? [{l:"Projects",v:projects.length,i:"⊞"},{l:"Students",v:[...new Set(projects.flatMap(p=>p.members))].length,i:"◐"},{l:"Insights",v:totalInsights,i:"✦"},{l:"At Risk",v:atRisk,i:"◇"}]
    : [{l:"Active Projects",v:projects.filter(p=>p.status!=="completed").length,i:"⊞"},{l:"Tasks Done",v:`${doneTasks}/${totalTasks}`,i:"✓"},{l:"Active Milestones",v:activeMs,i:"◎"},{l:"Streak",v:"12d",i:"↗"}];

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Friday, May 8</div>
          <div className="display">
            {role==="professor" ? <>Welcome back, <span className="accent">Prof. Rivera</span></> : <>Hey <span className="accent">Alex</span></>}
          </div>
        </div>
        <button className="icon-btn" onClick={openSettings}>⚙</button>
      </div>

      <div className="demo-banner">
        <span style={{fontSize:13}}>✦</span>
        <div><strong>Demo mode</strong> · sample data with real Claude AI</div>
      </div>

      <div className="role-switch">
        <div className={`role-opt ${role==="student"?"active":""}`} onClick={()=>setRole("student")}>Student</div>
        <div className={`role-opt ${role==="professor"?"active":""}`} onClick={()=>setRole("professor")}>Professor</div>
      </div>

      {role==="student" && (
        <div className="welcome">
          <div className="welcome-eye">This week</div>
          <div className="welcome-t">{activeMs} active milestone{activeMs!==1?"s":""} · keep momentum</div>
          <div className="welcome-s">You're contributing consistently. Strong work on the literature review.</div>
        </div>
      )}
      {role==="professor" && totalInsights>0 && (
        <div style={{margin:"0 24px 28px"}}>
          <div className="welcome" style={{margin:0}}>
            <div className="welcome-eye">For your review</div>
            <div className="welcome-t">{totalInsights} workflow insight{totalInsights!==1?"s":""} surfaced</div>
            <div className="welcome-s">Claude noticed patterns worth a brief look. Final judgment is always yours.</div>
          </div>
        </div>
      )}

      <div className="stats">
        {stats.map((s,i) => (
          <div key={i} className="stat">
            <div className="stat-icon">{s.i}</div>
            <div className="stat-v">{s.v}</div>
            <div className="stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-head"><h3>{role==="professor"?"Supervised projects":"Your projects"}</h3></div>
        {projects.map(p => (
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
              <div className="av-s">
                {p.members.slice(0,3).map(m => <Avatar key={m} name={m} size={24}/>)}
                {p.members.length>3 && (
                  <div className="av" style={{width:24,height:24,fontSize:9,background:"var(--bg-3)",color:"var(--muted)",border:"2px solid var(--bg-1)",marginLeft:-8,fontWeight:700}}>+{p.members.length-3}</div>
                )}
              </div>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                {role==="professor" && p.insights.length>0 && <span className="tag tag-a">✦ {p.insights.length}</span>}
                {p.status==="at-risk" && <span className="tag tag-w">At risk</span>}
                <span style={{fontSize:12.5,color:"var(--muted)",fontWeight:500}}>Due {p.dueDate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {role==="student" && (
        <div className="section">
          <div className="section-head"><h3>Your activity</h3></div>
          <div className="card" style={{padding:18,cursor:"default"}}>
            <div className="heat">
              {HEATMAP.slice(0,70).map((v,i) => <div key={i} className="h-c" style={{background:heatColor(v)}}/>)}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,fontSize:11.5,color:"var(--muted)",fontWeight:500}}>
              <span>10 weeks</span>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
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
