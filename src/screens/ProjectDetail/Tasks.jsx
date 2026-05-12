import { useState } from 'react';
import Avatar from '../../components/Avatar.jsx';

export default function Tasks({project}) {
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
