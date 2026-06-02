// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/SessionProvider.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Sign-in failed.');
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Welcome back</div>
          <div className="display">Sign in</div>
        </div>
      </div>
      <form onSubmit={submit} style={{padding:"0 24px"}}>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" placeholder="you@school.edu" autoComplete="email"
            value={email} onChange={(e)=>setEmail(e.target.value)} required/>
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" placeholder="••••••••" autoComplete="current-password"
            value={password} onChange={(e)=>setPassword(e.target.value)} required/>
        </div>
        {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}
        <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}} disabled={submitting}>
          {submitting ? <span className="spin"/> : 'Sign in'}
        </button>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:18}}>
          <Link to="/reset" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Forgot your password?</Link>
        </div>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:10}}>
          New here? <Link to="/signup" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Create an account</Link>
        </div>
        <div style={{textAlign:"center",fontSize:11.5,color:"var(--muted)",lineHeight:1.6,marginTop:22}}>
          By continuing you agree to our{' '}
          <Link to="/legal/terms" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Terms of Service</Link>{' '}
          and <Link to="/legal/privacy" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Privacy Policy</Link>.
        </div>
      </form>
    </>
  );
}
