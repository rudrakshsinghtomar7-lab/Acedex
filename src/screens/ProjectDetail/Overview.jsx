import Avatar from '../../components/Avatar.jsx';
import ProgBar from '../../components/ProgBar.jsx';
import StatusTag from '../../components/StatusTag.jsx';

export default function Overview({project, role}) {
  return (
    <>
      {(project.course || project.description) && (
        <div className="card" style={{marginBottom:16,padding:18,cursor:"default"}}>
          {project.course && project.course !== '—' && (
            <div style={{fontSize:11,fontWeight:600,color:"var(--indigo-bright)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>{project.course}</div>
          )}
          {project.description && (
            <div style={{fontSize:13.5,lineHeight:1.55,color:"var(--text-1)"}}>{project.description}</div>
          )}
        </div>
      )}
      <div className="card" style={{marginBottom:16,padding:20,cursor:"default"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em"}}>Overall progress</div>
          <StatusTag status={project.status}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:16}}>
          <div style={{fontSize:40,fontWeight:700,lineHeight:1,letterSpacing:"-0.04em",background:"var(--grad)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{project.progress}%</div>
          <div style={{flex:1}}>
            <ProgBar value={project.progress}/>
            <div style={{fontSize:12.5,color:"var(--muted)",marginTop:8,fontWeight:500}}>{project.dueDate ? `Due ${project.dueDate}` : 'No due date'}</div>
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
