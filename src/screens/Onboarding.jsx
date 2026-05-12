import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Onboarding({role, setRole}) {
  const navigate = useNavigate();
  const onComplete = () => navigate('/home');
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
