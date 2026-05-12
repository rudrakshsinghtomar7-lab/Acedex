import { useState } from 'react';

export default function SettingsSheet({onClose, apiKey, setApiKey}) {
  const [draft, setDraft] = useState(apiKey || "");
  const save = () => {
    setApiKey(draft.trim());
    onClose();
  };
  const clear = () => {
    setApiKey("");
    setDraft("");
  };
  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="handle"/>
        <div className="sh-h2">Claude AI Setup</div>
        <div className="key-warn">
          <strong>Your key stays in your browser.</strong> Stored only in localStorage on this device. Never sent anywhere except api.anthropic.com.
        </div>
        <div className="field">
          <label>Anthropic API Key</label>
          <input className="input" type="password" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="sk-ant-..." autoComplete="off"/>
        </div>
        <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.6,marginBottom:18}}>
          Don't have one? Visit <strong style={{color:"var(--indigo-bright)"}}>console.anthropic.com</strong> → API Keys → Create Key. Free tier available.
        </div>
        <div style={{display:"flex",gap:10}}>
          {apiKey && <button className="btn btn-g" style={{flex:1}} onClick={clear}>Clear</button>}
          <button className="btn btn-g" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-p" style={{flex:2}} onClick={save} disabled={!draft.trim()}>Save key</button>
        </div>
      </div>
    </div>
  );
}
