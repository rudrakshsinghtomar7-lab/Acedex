import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/SessionProvider.jsx';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signUp(email, password, { full_name: fullName, role });
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Signup failed.');
      return;
    }
    navigate('/home', { replace: true });
  }

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Get started</div>
          <div className="display">Create account</div>
        </div>
      </div>
      <form onSubmit={submit} style={{padding:"0 24px"}}>
        <div className="field">
          <label>Full name</label>
          <input className="input" type="text" placeholder="Alex Chen" autoComplete="name"
            value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" placeholder="you@school.edu" autoComplete="email"
            value={email} onChange={(e)=>setEmail(e.target.value)} required/>
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" placeholder="At least 8 characters" autoComplete="new-password"
            value={password} onChange={(e)=>setPassword(e.target.value)} minLength={8} required/>
        </div>
        <div className="field">
          <label>Role</label>
          <select className="select" value={role} onChange={(e)=>setRole(e.target.value)}>
            <option value="student">student</option>
            <option value="professor">professor</option>
            <option value="admin">admin</option>
          </select>
        </div>
        {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}
        <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}} disabled={submitting}>
          {submitting ? <span className="spin"/> : 'Create account'}
        </button>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:18}}>
          Already have an account? <Link to="/login" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Sign in</Link>
        </div>
      </form>
    </>
  );
}
