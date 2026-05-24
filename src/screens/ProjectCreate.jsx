// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';
import { createCourse, createTeam, listProfessorCourses } from '../lib/teams.js';

const TERM_OPTIONS = ['Spring', 'Summer', 'Fall'];

function defaultTerm() {
  const m = new Date().getMonth() + 1;
  if (m <= 5) return 'Spring';
  if (m <= 8) return 'Summer';
  return 'Fall';
}

export default function ProjectCreate() {
  const { supabase, user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [mode, setMode] = useState('pick');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [ncCode, setNcCode] = useState('');
  const [ncName, setNcName] = useState('');
  const [ncTerm, setNcTerm] = useState(defaultTerm());
  const [ncYear, setNcYear] = useState(new Date().getFullYear());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // Anyone reaching this form sees their own owned courses (if any).
        // Non-profs / new users with zero rows fall through to "new course"
        // mode automatically.
        const list = await listProfessorCourses(supabase, user.id);
        if (cancelled) return;
        setCourses(list);
        if (list.length === 0) setMode('new');
        else setSelectedCourseId(list[0].id);
      } catch (e) {
        if (cancelled) return;
        setError(e.message || String(e));
        setMode('new');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, supabase]);

  // Anyone signed in can reach the form. RLS (migration 013) requires
  // created_by = auth.uid() on teams and professor_id = auth.uid() on
  // courses, so the row always traces back to the creator regardless of
  // their stored role.

  if (loading || !profile) {
    return <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    let createdCourseId = null;
    try {
      let courseId = selectedCourseId;
      if (mode === 'new') {
        if (!ncCode.trim() || !ncName.trim()) {
          throw new Error('Course code and name are required.');
        }
        const yearNum = parseInt(String(ncYear).trim(), 10);
        if (!Number.isInteger(yearNum) || yearNum < 2020 || yearNum > 2099) {
          throw new Error('Course year must be a number between 2020 and 2099.');
        }
        const created = await createCourse(supabase, {
          university_id: profile.university_id,
          professor_id: user.id,
          code: ncCode.trim(),
          name: ncName.trim(),
          term: ncTerm,
          year: yearNum,
        });
        courseId = created.id;
        createdCourseId = created.id;
      }
      if (!courseId) throw new Error('Pick a course.');

      const team = await createTeam(supabase, {
        course_id: courseId,
        name: title.trim(),
        description: description.trim() || null,
        created_by: user.id,
      });
      navigate(`/projects/${team.id}`, { replace: true });
    } catch (e2) {
      // Best-effort rollback: if we just created a course but the team insert
      // failed, delete the orphan course so it doesn't pollute the dropdown.
      // Not a true transaction — proper atomicity needs an RPC (migration 003).
      if (createdCourseId) {
        try {
          await supabase.from('courses').delete().eq('id', createdCourseId);
        } catch (rollbackErr) {
          console.error('Course rollback failed:', rollbackErr);
        }
      }
      setError(e2.message || String(e2));
    } finally {
      setSaving(false);
    }
  }

  const showInlineNew = mode === 'new' || courses.length === 0;

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">New workspace</div>
          <div className="display">Create project</div>
        </div>
        <Link to="/projects" className="icon-btn" style={{textDecoration:'none'}}>✕</Link>
      </div>

      <form onSubmit={submit} style={{padding:'12px 24px 24px'}}>
        <div className="field">
          <label>Title</label>
          <input className="input" type="text" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g. LLM Hallucination Study" required/>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea className="textarea" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Optional. What's the project about?"/>
        </div>

        {courses.length > 0 && (
          <div className="field">
            <label>Course</label>
            <div style={{display:'flex',gap:8}}>
              <select className="select" value={mode === 'pick' ? selectedCourseId : ''}
                disabled={mode === 'new'}
                onChange={(e)=>{ setMode('pick'); setSelectedCourseId(e.target.value); }}
                style={{flex:1}}>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name} ({c.term} {c.year})</option>
                ))}
              </select>
              <button type="button" className="btn btn-g" style={{whiteSpace:'nowrap'}}
                onClick={()=>setMode(mode === 'new' ? 'pick' : 'new')}>
                {mode === 'new' ? 'Use existing' : '+ New course'}
              </button>
            </div>
          </div>
        )}

        {showInlineNew && (
          <div style={{padding:14,borderRadius:12,background:'rgba(124,108,255,.06)',border:'1px solid rgba(124,108,255,.18)',marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--indigo-bright)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>New course</div>
            <div className="field">
              <label>Course code</label>
              <input className="input" type="text" value={ncCode} onChange={(e)=>setNcCode(e.target.value)} placeholder="e.g. CS 4890" required={mode === 'new'}/>
            </div>
            <div className="field">
              <label>Course name</label>
              <input className="input" type="text" value={ncName} onChange={(e)=>setNcName(e.target.value)} placeholder="e.g. Advanced NLP" required={mode === 'new'}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <div className="field" style={{flex:1}}>
                <label>Term</label>
                <select className="select" value={ncTerm} onChange={(e)=>setNcTerm(e.target.value)}>
                  {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field" style={{flex:1}}>
                <label>Year</label>
                <input className="input" type="number" value={ncYear} onChange={(e)=>setNcYear(e.target.value)} min={2020} max={2099}/>
              </div>
            </div>
          </div>
        )}

        {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}

        <button type="submit" className="btn btn-p btn-bl" disabled={saving} style={{marginTop:8}}>
          {saving ? <span className="spin"/> : 'Create project'}
        </button>
      </form>
    </>
  );
}
