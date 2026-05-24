// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/SessionProvider.jsx';

export default function UpdatePassword() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Could not update password.');
      return;
    }
    navigate('/home', { replace: true });
  }

  if (loading) {
    return <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>;
  }
  if (!session) {
    return (
      <>
        <div className="header"><div><div className="greeting">Reset link expired</div><div className="display">Try again</div></div></div>
        <div style={{padding:"0 24px",fontSize:13,color:"var(--text-2)",lineHeight:1.5}}>
          This reset link is invalid or has expired. Request a new one from the sign-in page.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Set a new password</div>
          <div className="display">New password</div>
        </div>
      </div>
      <form onSubmit={submit} style={{padding:"0 24px"}}>
        <div className="field">
          <label>New password</label>
          <input className="input" type="password" autoComplete="new-password" placeholder="At least 8 characters"
            value={password} onChange={(e)=>setPassword(e.target.value)} minLength={8} required/>
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input className="input" type="password" autoComplete="new-password"
            value={confirm} onChange={(e)=>setConfirm(e.target.value)} minLength={8} required/>
        </div>
        {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}
        <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}} disabled={submitting}>
          {submitting ? <span className="spin"/> : 'Update password'}
        </button>
      </form>
    </>
  );
}
