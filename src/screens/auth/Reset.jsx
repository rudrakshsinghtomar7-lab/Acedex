import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../providers/SessionProvider.jsx';

export default function Reset() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/Acedex/update-password`;
    const { error: err } = await requestPasswordReset(email, redirectTo);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Could not send reset email.');
      return;
    }
    setSent(true);
  }

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Forgot your password?</div>
          <div className="display">Reset</div>
        </div>
      </div>
      <div style={{padding:"0 24px"}}>
        {sent ? (
          <>
            <div style={{fontSize:13,color:"var(--text-2)",lineHeight:1.5,marginBottom:18}}>
              Check <strong>{email}</strong> for a reset link. The link expires in 1 hour.
            </div>
            <Link to="/login" className="btn btn-p btn-bl" style={{display:'block',textAlign:'center',textDecoration:'none'}}>Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{fontSize:13,color:"var(--text-2)",lineHeight:1.5,marginBottom:18}}>
              Enter your account email and we'll send you a link to set a new password.
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" placeholder="you@school.edu" autoComplete="email"
                value={email} onChange={(e)=>setEmail(e.target.value)} required/>
            </div>
            {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}
            <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}} disabled={submitting}>
              {submitting ? <span className="spin"/> : 'Send reset link'}
            </button>
            <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:18}}>
              <Link to="/login" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
