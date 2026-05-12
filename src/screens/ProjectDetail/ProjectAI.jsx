import { useState, useEffect, useRef } from 'react';
import { askClaude } from '../../lib/claude.js';
import { sanitize } from '../../utils/sanitize.js';

export default function ProjectAI({project, role, apiKey}) {
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
