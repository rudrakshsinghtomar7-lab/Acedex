import { Link } from 'react-router-dom';

export default function Login() {
  const submit = (e) => { e.preventDefault(); };
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
          <input className="input" type="email" placeholder="you@school.edu" autoComplete="email"/>
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" placeholder="••••••••" autoComplete="current-password"/>
        </div>
        <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}}>Sign in</button>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:18}}>
          <Link to="/reset" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Forgot your password?</Link>
        </div>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:10}}>
          New here? <Link to="/signup" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Create an account</Link>
        </div>
      </form>
    </>
  );
}
