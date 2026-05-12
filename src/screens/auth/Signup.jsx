import { Link } from 'react-router-dom';

export default function Signup() {
  const submit = (e) => { e.preventDefault(); };
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
          <input className="input" type="text" placeholder="Alex Chen" autoComplete="name"/>
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" placeholder="you@school.edu" autoComplete="email"/>
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" placeholder="At least 8 characters" autoComplete="new-password"/>
        </div>
        <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}}>Create account</button>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:18}}>
          Already have an account? <Link to="/login" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Sign in</Link>
        </div>
      </form>
    </>
  );
}
