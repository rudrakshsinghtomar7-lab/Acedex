// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useState } from 'react';
import Confidence from '../../components/Confidence.jsx';

export default function Insights({project}) {
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
