import { Link } from 'react-router-dom';

export default function Reset() {
  const submit = (e) => { e.preventDefault(); };
  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Forgot your password?</div>
          <div className="display">Reset</div>
        </div>
      </div>
      <form onSubmit={submit} style={{padding:"0 24px"}}>
        <div style={{fontSize:13,color:"var(--text-2)",lineHeight:1.5,marginBottom:18}}>
          Enter your account email and we'll send you a link to set a new password.
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" placeholder="you@school.edu" autoComplete="email"/>
        </div>
        <button type="submit" className="btn btn-p btn-bl" style={{marginTop:8}}>Send reset link</button>
        <div style={{textAlign:"center",fontSize:13,color:"var(--muted)",marginTop:18}}>
          <Link to="/login" style={{color:"var(--indigo-bright)",textDecoration:"none"}}>Back to sign in</Link>
        </div>
      </form>
    </>
  );
}
