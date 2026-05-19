import { useRef, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import { useAuth } from '../../providers/SessionProvider.jsx';
import { uploadPdfDocument, validatePdfFile } from '../../lib/pdfs.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function looksLikeUuid(v) { return typeof v === 'string' && UUID_RE.test(v); }
function todayShort() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Tasks({ project }) {
  const { supabase, user } = useAuth();
  const isDemo = typeof project?.id === 'string' && project.id.startsWith('demo-');
  const [tasks, setTasks] = useState(project.tasks ?? []);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const fileInputs = useRef({});

  const toggle = (id) => setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const pickFile = (taskId) => fileInputs.current[taskId]?.click();

  async function onFileChange(task, event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const v = validatePdfFile(file);
    if (v) { setError(v); return; }
    setError(null);
    setBusyId(task.id);
    try {
      if (isDemo) {
        // Demo: there's no real assignment UUID and no DB. We synthesize a
        // project.pdfs row so the PDFs + Activity tabs surface the upload on
        // their next mount, mark the task submitted locally, and flash a
        // confirmation. Mutating project.pdfs is the same in-memory side
        // effect demo mode relies on for other tabs.
        const newPdf = {
          id: `demo-pdf-new-${task.id}-${Date.now()}`,
          title: file.name,
          uploaded_by: 'Alex Chen',
          uploaded_at: todayShort(),
          pages: 1,
          annotations: 0,
          status: 'pending',
          file_size_bytes: file.size,
        };
        project.pdfs = [...(project.pdfs || []), newPdf];
        await new Promise(r => setTimeout(r, 350));
      } else {
        const assignmentId = looksLikeUuid(task.id) ? task.id : null;
        await uploadPdfDocument(supabase, {
          teamId: project.id,
          userId: user.id,
          assignmentId,
          file,
        });
      }
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, submitted: true, submittedFile: file.name }
        : t));
      setFlash(`Submitted ${file.name}`);
      setTimeout(() => setFlash(f => (f === `Submitted ${file.name}` ? null : f)), 3000);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  const todo = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

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

      {flash && (
        <div className="task-flash" role="status">{flash}</div>
      )}

      {error && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <span>◇</span><div>{error}</div>
        </div>
      )}

      {todo.length > 0 && (
        <>
          <div style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Active</div>
          {todo.map(t => {
            const busy = busyId === t.id;
            const submitted = !!t.submitted;
            return (
              <div key={t.id} className={`task ${submitted ? 'task-has-submission' : ''}`}>
                <div className={`check ${t.done?"done":""}`} onClick={()=>toggle(t.id)}>{t.done?"✓":""}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className={`task-n ${t.done?"done":""}`}>{t.title}</div>
                  <div style={{display:"flex",gap:7,marginTop:6,alignItems:"center"}}>
                    <Avatar name={t.assignee} size={18}/>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>{t.assignee.split(" ")[0]}</span>
                    <span style={{fontSize:11.5,marginLeft:"auto",fontWeight:500,color:t.priority==="high"?"var(--indigo-bright)":"var(--muted)"}}>{t.due}</span>
                  </div>
                  {submitted && (
                    <div className="task-submitted-line">
                      <span className="task-submitted-badge">Submitted</span>
                      <span className="task-submitted-file">{t.submittedFile}</span>
                    </div>
                  )}
                </div>
                {!submitted && (
                  <button
                    type="button"
                    className="btn btn-p btn-sm task-submit-btn"
                    disabled={busy}
                    onClick={() => pickFile(t.id)}
                  >{busy ? 'Uploading…' : 'Submit Work'}</button>
                )}
                <input
                  ref={el => { fileInputs.current[t.id] = el; }}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={e => onFileChange(t, e)}
                />
              </div>
            );
          })}
        </>
      )}

      {done.length > 0 && (
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
