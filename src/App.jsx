import { useState, useEffect, useRef } from 'react';
import { PROJECTS, HEATMAP, heatColor } from './data/projects.js';
import { avatarBg, initials } from './utils/helpers.js';
import { askClaude } from './lib/claude.js';

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
function Avatar({name, size=28}) {
  return <div className="av" style={{width:size,height:size,fontSize:size*.36,background:avatarBg(name)}}>{initials(name)}</div>;
}

function ProgBar({value}) {
  return <div className="pb"><div className="pb-fill" style={{width:`${value}%`}} /></div>;
}

function ProgCircle({value, size=48}) {
  const r=(size-6)/2, circ=2*Math.PI*r, off=circ-(value/100)*circ;
  const id=`g${value}_${Math.random().toString(36).slice(2,6)}`;
  return (
    <div className="pc" style={{width:size,height:size}}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c6cff"/>
            <stop offset="100%" stopColor="#a875ff"/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--bg-3)" strokeWidth="3" fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={`url(#${id})`} strokeWidth="3" fill="none" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{transition:"stroke-dashoffset 600ms cubic-bezier(.22,.61,.36,1)"}}/>
      </svg>
      <span className="pct">{value}</span>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <img src="assets/logo.png" alt="Acedex" className="status-logo"/>
    </div>
  );
}

function Confidence({level}) {
  return (
    <div className="conf">
      <span>AI Confidence</span>
      <div className="conf-d">
        {[1,2,3,4,5].map(i => <span key={i} className={i<=level?"f":""}/>)}
      </div>
      <span style={{marginLeft:4}}>{level>=4?"High":level>=3?"Moderate":"Low"}</span>
    </div>
  );
}

function StatusTag({status}) {
  const m={"active":{c:"tag-a",t:"Active"},"at-risk":{c:"tag-w",t:"At risk"},"completed":{c:"tag-s",t:"Completed"}};
  const s=m[status]||m.active;
  return <span className={`tag ${s.c}`}>{s.t}</span>;
}

const formatText = (text) => ({__html: text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")});

// ─── ONBOARDING ─────────────────────────────────────────────────────────────
function Onboarding({onComplete, role, setRole}) {
  const [step, setStep] = useState(0);
  const studentSteps = [
    {eyebrow:"Welcome to Acedex", title:"Where academic projects come together", body:"A calm, structured space for student teams to plan, track, and ship projects."},
    {eyebrow:"Step 1 · Navigate", title:"Four tabs, everything you need",
      steps:[{n:"⌂",title:"Home",body:"Active projects, weekly milestones, activity heatmap."},{n:"▦",title:"Projects",body:"Every workspace with filters and search."},{n:"✦",title:"AI",body:"Context-aware Claude assistant for planning."},{n:"◉",title:"Profile",body:"Settings and your API key."}]}
  ];
  const profSteps = [
    {eyebrow:"Welcome to Acedex", title:"AI-powered academic review", body:"Claude analyzes student workflows for plagiarism patterns and unusual contributions — you make the final call."},
    {eyebrow:"Step 1 · How AI helps", title:"Calm, evidence-based review",
      steps:[{n:"1",title:"Read insights",body:"Claude flags review-worthy patterns with evidence."},{n:"2",title:"Check confidence",body:"Higher dots = more reliable signal."},{n:"3",title:"Use AI tab",body:"Ask Claude to deep-review any project for plagiarism, ghostwriting, or balance issues."},{n:"4",title:"Decide",body:"Mark Reviewed, or Add to Follow-ups. You decide."}]}
  ];
  const steps = role==="professor" ? profSteps : studentSteps;
  const cur = steps[step];

  return (
    <div className="ob">
      <div className="ob-c">
        <div style={{textAlign:"center"}}>
          <div className="ob-logo">✦</div>
          <div style={{fontSize:11,fontWeight:600,color:"var(--indigo-bright)",textTransform:"uppercase",letterSpacing:".12em",marginBottom:8}}>{cur.eyebrow}</div>
          <div className="ob-t">{cur.title}</div>
          {cur.body && <div className="ob-s">{cur.body}</div>}
        </div>
        {step===0 && (
          <>
            <div className="gh">Choose your role</div>
            <div className="role-switch" style={{margin:0}}>
              <div className={`role-opt ${role==="student"?"active":""}`} onClick={()=>setRole("student")}>I'm a student</div>
              <div className={`role-opt ${role==="professor"?"active":""}`} onClick={()=>setRole("professor")}>I'm a professor</div>
            </div>
          </>
        )}
        {cur.steps && cur.steps.map((s,i) => (
          <div key={i} className="gstep">
            <div className="gstep-n">{s.n}</div>
            <div className="gstep-i">
              <div className="gstep-t">{s.title}</div>
              <div className="gstep-b">{s.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="ob-foot">
        {step>0 && <button className="btn btn-g" style={{flex:1}} onClick={()=>setStep(step-1)}>Back</button>}
        <button className="btn btn-p" style={{flex:step>0?2:1}} onClick={()=>step<steps.length-1?setStep(step+1):onComplete()}>
          {step<steps.length-1?`Continue (${step+1}/${steps.length})`:"Enter app"}
        </button>
      </div>
    </div>
  );
}

// ─── HOME ───────────────────────────────────────────────────────────────────
function Home({role, projects, onOpenProject, setRole, openSettings}) {
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

// ─── PROJECTS LIST ──────────────────────────────────────────────────────────
function ProjectsList({role, projects, onOpenProject}) {
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

// ─── PROJECT DETAIL ─────────────────────────────────────────────────────────
function ProjectDetail({project, role, onBack, apiKey}) {
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

function Overview({project, role}) {
  return (
    <>
      <div className="card" style={{marginBottom:16,padding:20,cursor:"default"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em"}}>Overall progress</div>
          <StatusTag status={project.status}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:16}}>
          <div style={{fontSize:40,fontWeight:700,lineHeight:1,letterSpacing:"-0.04em",background:"var(--grad)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{project.progress}%</div>
          <div style={{flex:1}}>
            <ProgBar value={project.progress}/>
            <div style={{fontSize:12.5,color:"var(--muted)",marginTop:8,fontWeight:500}}>Due {project.dueDate}</div>
          </div>
        </div>
        <div className="row3">
          <div className="tile"><div className="tv s">{project.milestones.filter(m=>m.status==="done").length}</div><div className="tl">Done</div></div>
          <div className="tile"><div className="tv a">{project.milestones.filter(m=>m.status==="active").length}</div><div className="tl">Active</div></div>
          <div className="tile"><div className="tv m">{project.milestones.filter(m=>m.status==="pending").length}</div><div className="tl">Pending</div></div>
        </div>
      </div>
      {role==="professor" && project.insights.length>0 && (
        <div className="alert" style={{marginBottom:18}}>
          <span style={{fontSize:16}}>✦</span>
          <div>
            <div><strong>{project.insights.length} insight{project.insights.length!==1?"s":""}</strong> from this workflow.</div>
            <div style={{color:"var(--muted)",marginTop:2}}>Tap the Insights tab to review.</div>
          </div>
        </div>
      )}
      <div className="section-head" style={{marginBottom:12}}><h3 style={{fontSize:16}}>Milestones</h3></div>
      {project.milestones.map((m,i) => (
        <div key={m.id} className="ms">
          <div className={`ms-n ${m.status}`}>{m.status==="done"?"✓":i+1}</div>
          <div className="ms-info">
            <div className="ms-name">{m.title}</div>
            <div className="ms-meta">{m.owner} · Due {m.due}</div>
          </div>
          <span className={`tag ${m.status==="done"?"tag-s":m.status==="active"?"tag-a":"tag-m"}`}>{m.status}</span>
        </div>
      ))}
      <div className="section-head" style={{marginTop:28,marginBottom:12}}><h3 style={{fontSize:16}}>Contributions</h3></div>
      {project.contributions.map(c => (
        <div key={c.name} className="ctb">
          <Avatar name={c.name} size={34}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13.5,fontWeight:600,marginBottom:6}}>{c.name}</div>
            <ProgBar value={c.pct}/>
          </div>
          <div style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>{c.pct}%</div>
        </div>
      ))}
    </>
  );
}

function Milestones({project}) {
  return (
    <>
      {project.milestones.map((m,i) => (
        <div key={m.id} className={`card ${m.status==="active"?"glow":""}`} style={{marginBottom:12,cursor:"default"}}>
          <div style={{display:"flex",gap:14}}>
            <div className={`ms-n ${m.status}`}>{m.status==="done"?"✓":i+1}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div className="ms-name">{m.title}</div>
                <span className={`tag ${m.status==="done"?"tag-s":m.status==="active"?"tag-a":"tag-m"}`}>{m.status}</span>
              </div>
              <div className="ms-meta" style={{marginTop:6}}>Owner · {m.owner}</div>
              <div className="ms-meta">Due · {m.due}</div>
              <div className="ms-meta">{m.submissions} submission{m.submissions!==1?"s":""}</div>
              {m.status==="active" && <button className="btn btn-p btn-sm" style={{marginTop:14,width:"100%"}}>Submit work</button>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function Tasks({project}) {
  const [tasks, setTasks] = useState(project.tasks);
  const toggle = (id) => setTasks(tasks.map(t=>t.id===id?{...t,done:!t.done}:t));
  const todo = tasks.filter(t=>!t.done);
  const done = tasks.filter(t=>t.done);
  return (
    <>
      <div style={{display:"flex",gap:10,marginBottom:22}}>
        <div style={{flex:1,background:"var(--bg-1)",border:"1px solid var(--border)",borderRadius:"var(--r-md)",padding:14,textAlign:"center"}}>
          <div className="tv a">{todo.length}</div><div className="tl">To do</div>
        </div>
        <div style={{flex:1,background:"var(--bg-1)",border:"1px solid var(--border)",borderRadius:"var(--r-md)",padding:14,textAlign:"center"}}>
          <div className="tv s">{done.length}</div><div className="tl">Completed</div>
        </div>
      </div>
      {todo.length>0 && (
        <>
          <div style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Active</div>
          {todo.map(t => (
            <div key={t.id} className="task">
              <div className={`check ${t.done?"done":""}`} onClick={()=>toggle(t.id)}>{t.done?"✓":""}</div>
              <div style={{flex:1}}>
                <div className={`task-n ${t.done?"done":""}`}>{t.title}</div>
                <div style={{display:"flex",gap:7,marginTop:6,alignItems:"center"}}>
                  <Avatar name={t.assignee} size={18}/>
                  <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>{t.assignee.split(" ")[0]}</span>
                  <span style={{fontSize:11.5,marginLeft:"auto",fontWeight:500,color:t.priority==="high"?"var(--indigo-bright)":"var(--muted)"}}>{t.due}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      {done.length>0 && (
        <>
          <div style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",margin:"22px 0 10px"}}>Completed</div>
          {done.map(t => (
            <div key={t.id} className="task" style={{opacity:.6}}>
              <div className="check done" onClick={()=>toggle(t.id)}>✓</div>
              <div className="task-n done">{t.title}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function Team({project}) {
  return (
    <>
      <div style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>{project.members.length} Members</div>
      {project.members.map(m => {
        const ctb = project.contributions.find(c=>c.name===m);
        return (
          <div key={m} className="card" style={{marginBottom:10,cursor:"default"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <Avatar name={m} size={44}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14.5,letterSpacing:"-0.015em"}}>{m}</div>
                <div style={{fontSize:12.5,color:"var(--muted)",marginTop:3,fontWeight:500}}>{ctb?`${ctb.pct}% contribution`:"Member"}</div>
              </div>
            </div>
            {ctb && <div style={{marginTop:14}}><ProgBar value={ctb.pct}/></div>}
          </div>
        );
      })}
    </>
  );
}

function Activity({project}) {
  if (!project.activity || project.activity.length===0) return <div className="empty"><div className="empty-i">◐</div><div className="empty-h">No activity yet</div></div>;
  return (
    <>
      <div style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>Recent activity</div>
      {project.activity.map((a,i) => (
        <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"var(--indigo)",marginTop:6,flexShrink:0,boxShadow:"0 0 0 3px rgba(124,108,255,.15)"}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:"var(--text-2)",lineHeight:1.5}} dangerouslySetInnerHTML={{__html:a.text}}/>
            <div style={{fontSize:11.5,color:"var(--muted-2)",marginTop:3,fontWeight:500}}>{a.time}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function Insights({project}) {
  const [decided, setDecided] = useState({});
  if (project.insights.length===0) return <div className="empty"><div className="empty-i">✦</div><div className="empty-h">No insights surfaced</div></div>;
  return (
    <>
      <div className="alert" style={{marginBottom:20}}>
        <span style={{fontSize:15}}>✦</span>
        <div>
          <div><strong>Insights are observations, not judgments.</strong></div>
          <div style={{color:"var(--muted)",marginTop:2}}>Final decisions remain yours.</div>
        </div>
      </div>
      {project.insights.map(it => (
        <div key={it.id} className={`ins ${it.type}`}>
          <div className={`ins-b ${it.type}`}>
            {it.type==="review"?"Review recommended":it.type==="positive"?"Positive pattern":"For your attention"}
          </div>
          <div className="ins-t">{it.title}</div>
          <div className="ins-body">{it.body}</div>
          <div className="ins-ev">{it.evidence.map((ev,i) => <span key={i} className="tag tag-m">{ev}</span>)}</div>
          <Confidence level={it.confidence}/>
          {it.type!=="positive" && !decided[it.id] ? (
            <div className="ins-act">
              <button className="btn btn-g btn-sm" style={{flex:1}} onClick={()=>setDecided({...decided,[it.id]:"ok"})}>Mark reviewed</button>
              <button className="btn btn-p btn-sm" style={{flex:1}} onClick={()=>setDecided({...decided,[it.id]:"follow"})}>Add to follow-ups</button>
            </div>
          ) : decided[it.id] ? (
            <div style={{marginTop:14}}>
              <span className={`tag ${decided[it.id]==="ok"?"tag-s":"tag-a"}`}>{decided[it.id]==="ok"?"✓ Reviewed":"✦ Added to follow-ups"}</span>
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}

function ProjectAI({project, role, apiKey}) {
  const [messages, setMessages] = useState([{
    role: "ai",
    text: role==="professor"
      ? `Hello. I'm your Claude review assistant for **${project.title}**. I can analyze contribution patterns, flag potential plagiarism or copying concerns, evaluate workflow consistency, and draft balanced feedback. What would you like me to look at?`
      : `Hi! I'm your Claude assistant for **${project.title}**. I can help you plan tasks, brainstorm approaches, or summarize where things stand. What's on your mind?`
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const u = input.trim(); setInput("");
    setMessages(m => [...m, {role:"user", text:u}]);
    setLoading(true);
    const ctx = `Project: ${project.title}
Course: ${project.course}
Status: ${project.status} · ${project.progress}% complete
Due: ${project.dueDate}
Team contributions: ${project.contributions.map(c=>`${c.name}: ${c.pct}%`).join(", ")}
Milestones:
${project.milestones.map(m=>`- ${m.title} (${m.status}, owner: ${m.owner}, ${m.submissions} submissions)`).join("\n")}
Recent activity: ${project.activity.map(a=>a.text.replace(/<[^>]+>/g,"")).join("; ")}
Existing flagged insights: ${project.insights.map(i=>`[${i.type}] ${i.title}: ${i.body}`).join("; ") || "None"}`;
    const reply = await askClaude(apiKey, u, ctx, role);
    setMessages(m => [...m, {role:"ai", text:reply}]);
    setLoading(false);
  };

  const profPrompts = ["Review for plagiarism signals", "Analyze contribution balance", "Draft feedback for the team", "Flag any unusual patterns"];
  const studentPrompts = ["Plan my next task", "Summarize progress", "What's overdue?"];
  const prompts = role==="professor" ? profPrompts : studentPrompts;

  return (
    <>
      {!apiKey && (
        <div className="key-warn">
          <strong>API key required.</strong> Tap the gear icon on Home to add your Claude API key. Get one at console.anthropic.com.
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
        {messages.map((m,i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role==="ai" && <div className="ai-av">✦</div>}
            <div className="bubble" style={{whiteSpace:"pre-wrap"}} dangerouslySetInnerHTML={formatText(m.text)}/>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="ai-av">✦</div>
            <div className="bubble"><div className="spin"/></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {prompts.map(q => <div key={q} className="chip" onClick={()=>setInput(q)}>{q}</div>)}
      </div>
      <div style={{display:"flex",gap:10}}>
        <textarea className="ai-in" rows={2} value={input} placeholder="Ask Claude..." onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
        <button className="send" onClick={send} disabled={loading||!input.trim()}>{loading?<div className="spin"/>:"↑"}</button>
      </div>
    </>
  );
}

// ─── AI SCREEN ──────────────────────────────────────────────────────────────
function AIScreen({role, projects, apiKey}) {
  const [selected, setSelected] = useState(projects[0]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);
  useEffect(() => {
    const greeting = role==="professor"
      ? `I'm Claude, your review assistant for **${selected.title}**. I'll watch for plagiarism, unusual contributions, and workflow concerns. What would you like to investigate?`
      : `Hi! I'm Claude, your assistant for **${selected.title}**. Ask about planning, deadlines, or brainstorming.`;
    setMessages([{role:"ai", text:greeting}]);
  }, [selected, role]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const u = input.trim(); setInput("");
    setMessages(m => [...m, {role:"user", text:u}]);
    setLoading(true);
    const ctx = `Project: ${selected.title}
Course: ${selected.course}
Members: ${selected.contributions.map(c=>`${c.name}: ${c.pct}%`).join(", ")}
Milestones: ${selected.milestones.map(m=>`${m.title} (${m.status}, owner: ${m.owner})`).join("; ")}
Insights: ${selected.insights.map(i=>`[${i.type}] ${i.title}: ${i.body}`).join("; ") || "None"}`;
    const reply = await askClaude(apiKey, u, ctx, role);
    setMessages(m => [...m, {role:"ai", text:reply}]);
    setLoading(false);
  };

  const prompts = role==="professor"
    ? ["Review for plagiarism signals", "Analyze contribution balance", "Draft balanced feedback", "Flag suspicious patterns"]
    : ["Plan my week", "What's most urgent?", "Brainstorm ideas", "Summarize progress"];

  return (
    <div className="chat">
      <div className="header" style={{paddingBottom:12}}>
        <div>
          <div className="greeting">{role==="professor"?"Review assistant":"Project assistant"}</div>
          <div className="display"><span className="accent">Claude</span> {role==="professor"?"Review":"Assistant"}</div>
        </div>
      </div>
      {!apiKey && (
        <div style={{padding:"0 24px 12px"}}>
          <div className="key-warn">
            <strong>API key required.</strong> Add yours from the Home screen settings (gear icon). Get one at console.anthropic.com.
          </div>
        </div>
      )}
      <div style={{padding:"0 24px 12px"}}>
        <select className="select" value={selected.id} onChange={e=>setSelected(projects.find(p=>p.id===Number(e.target.value)))}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="chips">
        {prompts.map(p => <div key={p} className="chip" onClick={()=>setInput(p)}>{p}</div>)}
      </div>
      <div className="msgs">
        {messages.map((m,i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role==="ai" && <div className="ai-av">✦</div>}
            <div className="bubble" style={{whiteSpace:"pre-wrap"}} dangerouslySetInnerHTML={formatText(m.text)}/>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="ai-av">✦</div>
            <div className="bubble"><div className="spin"/></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="ibar">
        <textarea className="ai-in" rows={1} value={input} placeholder="Ask Claude..." onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
        <button className="send" onClick={send} disabled={loading||!input.trim()}>{loading?<div className="spin"/>:"↑"}</button>
      </div>
    </div>
  );
}

// ─── PROFILE ────────────────────────────────────────────────────────────────
function Profile({role, projects, openSettings}) {
  const me = role==="professor" ? "Prof. Rivera" : "Alex Chen";
  return (
    <>
      <div className="header">
        <div><div className="greeting">Settings & profile</div><div className="display">Profile</div></div>
        <button className="icon-btn" onClick={openSettings}>⚙</button>
      </div>
      <div style={{textAlign:"center",padding:"12px 24px 28px"}}>
        <div style={{display:"inline-block",position:"relative",marginBottom:16}}>
          <Avatar name={me} size={92}/>
          <div style={{position:"absolute",bottom:2,right:2,width:28,height:28,background:"var(--grad)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,border:"3px solid var(--bg-0)",boxShadow:"0 4px 12px rgba(124,108,255,.35)"}}>✓</div>
        </div>
        <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.025em"}}>{me}</div>
        <div style={{fontSize:13.5,color:"var(--muted)",marginTop:5,fontWeight:500}}>{role==="professor"?"Computer Science · Tenured":"CS Junior · 3.8 GPA"}</div>
      </div>
      <div className="section">
        <div className="pstats">
          <div className="pstat"><div className="v a">{projects.length}</div><div className="l">Projects</div></div>
          <div className="pdiv"/>
          <div className="pstat"><div className="v">{role==="professor"?"23":"12"}</div><div className="l">{role==="professor"?"Reviews":"Streak"}</div></div>
          <div className="pdiv"/>
          <div className="pstat"><div className="v">{role==="professor"?"12":"4/9"}</div><div className="l">{role==="professor"?"Students":"Achievements"}</div></div>
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
        {[
          {i:"🔔",t:"Notifications",s:"Manage alerts"},
          {i:"🌙",t:"Appearance",s:"Dark theme"},
          {i:"🔒",t:"Privacy & security",s:"Account and data"},
          {i:"💬",t:"Help & support",s:"Documentation"}
        ].map((it,i) => (
          <div key={i} className="set">
            <div className="set-i">{it.i}</div>
            <div className="set-info"><div className="set-t">{it.t}</div><div className="set-s">{it.s}</div></div>
            <span className="chev">›</span>
          </div>
        ))}
        <button className="btn btn-bl btn-g" style={{marginTop:16}}>Sign out</button>
      </div>
    </>
  );
}

// ─── SETTINGS SHEET (API KEY) ───────────────────────────────────────────────
function SettingsSheet({onClose, apiKey, setApiKey}) {
  const [draft, setDraft] = useState(apiKey || "");
  const save = () => {
    setApiKey(draft.trim());
    localStorage.setItem("Acedex_api_key", draft.trim());
    onClose();
  };
  const clear = () => {
    setApiKey("");
    localStorage.removeItem("Acedex_api_key");
    setDraft("");
  };
  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="handle"/>
        <div className="sh-h2">Claude AI Setup</div>
        <div className="key-warn">
          <strong>Your key stays in your browser.</strong> Stored only in localStorage on this device. Never sent anywhere except api.anthropic.com.
        </div>
        <div className="field">
          <label>Anthropic API Key</label>
          <input className="input" type="password" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="sk-ant-..." autoComplete="off"/>
        </div>
        <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.6,marginBottom:18}}>
          Don't have one? Visit <strong style={{color:"var(--indigo-bright)"}}>console.anthropic.com</strong> → API Keys → Create Key. Free tier available.
        </div>
        <div style={{display:"flex",gap:10}}>
          {apiKey && <button className="btn btn-g" style={{flex:1}} onClick={clear}>Clear</button>}
          <button className="btn btn-g" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-p" style={{flex:2}} onClick={save} disabled={!draft.trim()}>Save key</button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ───────────────────────────────────────────────────────────────
function App() {
  const [showOnboard, setShowOnboard] = useState(true);
  const [role, setRole] = useState("student");
  const [tab, setTab] = useState("home");
  const [openProject, setOpenProject] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const projects = PROJECTS;

  useEffect(() => {
    const saved = localStorage.getItem("Acedex_api_key");
    if (saved) setApiKey(saved);
  }, []);

  const totalInsights = projects.reduce((a,p)=>a+p.insights.filter(i=>i.type!=="positive").length,0);
  const tabs = [
    {id:"home",icon:"⌂",label:"Home"},
    {id:"projects",icon:"▦",label:"Projects"},
    {id:"ai",icon:"✦",label:"AI",badge:role==="professor"?totalInsights:0},
    {id:"profile",icon:"◉",label:"Profile"}
  ];

  return (
    <div className="phone">
      <div className="island"/>
      <StatusBar/>
      {showOnboard && <Onboarding role={role} setRole={setRole} onComplete={()=>setShowOnboard(false)}/>}
      {!showOnboard && (
        openProject
          ? <div className="screen"><ProjectDetail project={openProject} role={role} apiKey={apiKey} onBack={()=>setOpenProject(null)}/></div>
          : tab==="ai"
            ? <AIScreen role={role} projects={projects} apiKey={apiKey}/>
            : <div className="screen">
                {tab==="home" && <Home role={role} projects={projects} onOpenProject={p=>setOpenProject(p)} setRole={setRole} openSettings={()=>setShowSettings(true)}/>}
                {tab==="projects" && <ProjectsList role={role} projects={projects} onOpenProject={p=>setOpenProject(p)}/>}
                {tab==="profile" && <Profile role={role} projects={projects} openSettings={()=>setShowSettings(true)}/>}
              </div>
      )}
      {!showOnboard && !openProject && (
        <div className="bnav">
          {tabs.map(t => (
            <button key={t.id} className={`nav ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              <span className="nav-i">{t.icon}</span>
              <span className="nav-l">{t.label}</span>
              {t.badge>0 && <span className="nav-b">{t.badge}</span>}
            </button>
          ))}
        </div>
      )}
      {showSettings && <SettingsSheet onClose={()=>setShowSettings(false)} apiKey={apiKey} setApiKey={setApiKey}/>}
    </div>
  );
}

export default App;
