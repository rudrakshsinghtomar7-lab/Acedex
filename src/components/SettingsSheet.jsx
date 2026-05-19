import { useState } from 'react';
import { useDemoMode } from '../hooks/useDemoMode.jsx';

export default function SettingsSheet({onClose, apiKey, setApiKey}) {
  const [draft, setDraft] = useState(apiKey || '');
  const { demoMode, setDemoMode, available: demoAvailable } = useDemoMode();

  const save = () => {
    setApiKey(draft.trim());
    onClose();
  };
  const clear = () => {
    setApiKey('');
    setDraft('');
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
        <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.6,marginBottom:18}}>
          Don't have one? Visit <strong style={{color:'var(--indigo-bright)'}}>console.anthropic.com</strong> → API Keys → Create Key. Free tier available.
        </div>

        {demoAvailable && (
          <>
            <div className="sh-h2" style={{fontSize:14,marginTop:8,marginBottom:10}}>Developer</div>
            <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,marginBottom:18,cursor:'pointer'}}>
              <div>
                <div style={{fontSize:13.5,fontWeight:600}}>Show demo data</div>
                <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.5,marginTop:2}}>Populated fake projects, comments, and notifications for pitches and testing. Admin-only.</div>
              </div>
              <input type="checkbox" checked={demoMode} onChange={(e)=>setDemoMode(e.target.checked)} style={{width:18,height:18,cursor:'pointer'}}/>
            </label>
          </>
        )}

        <div style={{display:'flex',gap:10}}>
          {apiKey && <button className="btn btn-g" style={{flex:1}} onClick={clear}>Clear</button>}
          <button className="btn btn-g" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-p" style={{flex:2}} onClick={save} disabled={!draft.trim()}>Save key</button>
        </div>
      </div>
    </div>
  );
}
