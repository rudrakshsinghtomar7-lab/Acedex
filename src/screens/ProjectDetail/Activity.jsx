import { sanitize } from '../../utils/sanitize.js';

export default function Activity({project}) {
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
