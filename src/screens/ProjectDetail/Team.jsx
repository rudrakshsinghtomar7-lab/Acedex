import Avatar from '../../components/Avatar.jsx';
import ProgBar from '../../components/ProgBar.jsx';

export default function Team({project}) {
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
