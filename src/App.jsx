import { useState, useEffect, useRef } from 'react';
import { PROJECTS } from './data/projects.js';
import { avatarBg, initials } from './utils/helpers.js';
import { askClaude } from './lib/claude.js';
import { sanitize } from './utils/sanitize.js';
import Avatar from './components/Avatar.jsx';
import ProgBar from './components/ProgBar.jsx';
import ProgCircle from './components/ProgCircle.jsx';
import Confidence from './components/Confidence.jsx';
import StatusTag from './components/StatusTag.jsx';
import PhoneFrame from './components/PhoneFrame.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import { useApiKey } from './hooks/useApiKey.js';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Projects from './screens/Projects.jsx';
import AIScreen from './screens/AIScreen.jsx';
import Profile from './screens/Profile.jsx';

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
            <div style={{fontSize:13,color:"var(--text-2)",lineHeight:1.5}} dangerouslySetInnerHTML={sanitize(a.text)}/>
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
            <div className="bubble" style={{whiteSpace:"pre-wrap"}} dangerouslySetInnerHTML={sanitize(m.text)}/>
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

// ─── ROOT APP ───────────────────────────────────────────────────────────────
function App() {
  const [showOnboard, setShowOnboard] = useState(true);
  const [role, setRole] = useState("student");
  const [tab, setTab] = useState("home");
  const [openProject, setOpenProject] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useApiKey();
  const projects = PROJECTS;

  const totalInsights = projects.reduce((a,p)=>a+p.insights.filter(i=>i.type!=="positive").length,0);
  const tabs = [
    {id:"home",icon:"⌂",label:"Home"},
    {id:"projects",icon:"▦",label:"Projects"},
    {id:"ai",icon:"✦",label:"AI",badge:role==="professor"?totalInsights:0},
    {id:"profile",icon:"◉",label:"Profile"}
  ];

  return (
    <PhoneFrame>
      {showOnboard && <Onboarding role={role} setRole={setRole} onComplete={()=>setShowOnboard(false)}/>}
      {!showOnboard && (
        openProject
          ? <div className="screen"><ProjectDetail project={openProject} role={role} apiKey={apiKey} onBack={()=>setOpenProject(null)}/></div>
          : tab==="ai"
            ? <AIScreen role={role} projects={projects} apiKey={apiKey}/>
            : <div className="screen">
                {tab==="home" && <Home role={role} projects={projects} onOpenProject={p=>setOpenProject(p)} setRole={setRole} openSettings={()=>setShowSettings(true)}/>}
                {tab==="projects" && <Projects role={role} projects={projects} onOpenProject={p=>setOpenProject(p)}/>}
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
    </PhoneFrame>
  );
}

export default App;
