export default function Milestones({project}) {
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
