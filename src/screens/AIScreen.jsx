import { useState, useEffect, useRef } from 'react';
import { askClaude } from '../lib/claude.js';
import { sanitize } from '../utils/sanitize.js';

export default function AIScreen({role, projects, apiKey}) {
  const [selected, setSelected] = useState(projects[0]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);
  useEffect(() => {
    const greeting = role==="professor"
      ? `I'm Claude, your review assistant for **${selected.title}**. I'll watch for plagiarism, unusual contributions, and workflow concerns. What would you like to investigate?`
      : `Hi! I'm Claude, your assistant for **${selected.title}**. Ask about planning, deadlines, or brainstorming.`;
    setMessages([{role:"ai", text:greeting}]);
  }, [selected, role]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const u = input.trim(); setInput("");
    setMessages(m => [...m, {role:"user", text:u}]);
    setLoading(true);
    const ctx = `Project: ${selected.title}
Course: ${selected.course}
Members: ${selected.contributions.map(c=>`${c.name}: ${c.pct}%`).join(", ")}
Milestones: ${selected.milestones.map(m=>`${m.title} (${m.status}, owner: ${m.owner})`).join("; ")}
Insights: ${selected.insights.map(i=>`[${i.type}] ${i.title}: ${i.body}`).join("; ") || "None"}`;
    const reply = await askClaude(apiKey, u, ctx, role);
    setMessages(m => [...m, {role:"ai", text:reply}]);
    setLoading(false);
  };

  const prompts = role==="professor"
    ? ["Review for plagiarism signals", "Analyze contribution balance", "Draft balanced feedback", "Flag suspicious patterns"]
    : ["Plan my week", "What's most urgent?", "Brainstorm ideas", "Summarize progress"];

  return (
    <div className="chat">
      <div className="header" style={{paddingBottom:12}}>
        <div>
          <div className="greeting">{role==="professor"?"Review assistant":"Project assistant"}</div>
          <div className="display"><span className="accent">Claude</span> {role==="professor"?"Review":"Assistant"}</div>
        </div>
      </div>
      {!apiKey && (
        <div style={{padding:"0 24px 12px"}}>
          <div className="key-warn">
            <strong>API key required.</strong> Add yours from the Home screen settings (gear icon). Get one at console.anthropic.com.
          </div>
        </div>
      )}
      <div style={{padding:"0 24px 12px"}}>
        <select className="select" value={selected.id} onChange={e=>setSelected(projects.find(p=>p.id===Number(e.target.value)))}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="chips">
        {prompts.map(p => <div key={p} className="chip" onClick={()=>setInput(p)}>{p}</div>)}
      </div>
      <div className="msgs">
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
      <div className="ibar">
        <textarea className="ai-in" rows={1} value={input} placeholder="Ask Claude..." onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
        <button className="send" onClick={send} disabled={loading||!input.trim()}>{loading?<div className="spin"/>:"↑"}</button>
      </div>
    </div>
  );
}
