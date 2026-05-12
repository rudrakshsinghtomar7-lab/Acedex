import Avatar from '../components/Avatar.jsx';

export default function Profile({role, projects, openSettings}) {
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
