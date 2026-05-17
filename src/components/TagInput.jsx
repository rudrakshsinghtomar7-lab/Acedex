import { useState } from 'react';

export default function TagInput({ values = [], onChange, placeholder = 'Add and press Enter' }) {
  const [draft, setDraft] = useState('');

  function add(raw) {
    const t = raw.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft('');
  }

  function remove(t) {
    onChange(values.filter(v => v !== t));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      remove(values[values.length - 1]);
    }
  }

  return (
    <div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
        {values.map(t => (
          <span key={t} className="tag" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:999,background:'var(--bg-3)',color:'var(--text-1)',fontSize:12.5,fontWeight:600}}>
            {t}
            <button type="button" onClick={() => remove(t)}
              style={{background:'transparent',border:0,color:'var(--muted)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>×</button>
          </span>
        ))}
      </div>
      <input
        className="input"
        type="text"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}
