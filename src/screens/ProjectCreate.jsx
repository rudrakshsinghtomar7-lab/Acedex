// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';
import { createCourse, createTeam, listProfessorCourses } from '../lib/teams.js';
import { createMilestone } from '../lib/milestones.js';
import { createTask } from '../lib/tasks.js';
import { useBriefDraft } from '../hooks/useBriefDraft.js';
import { serverDraftDriver } from '../lib/draftStream.js';
import { MAX_BRIEF_CHARS } from '../lib/aiDraft.js';
// fixtureDraftDriver (also in lib/draftStream.js) remains the local dev/offline
// fallback and keeps data/aiDraftFixture.js in use.
import BriefDraftReview from '../components/BriefDraftReview.jsx';
import SectionLabel from '../components/study/SectionLabel.jsx';

const TERM_OPTIONS = ['Spring', 'Summer', 'Fall'];

function defaultTerm() {
  const m = new Date().getMonth() + 1;
  if (m <= 5) return 'Spring';
  if (m <= 8) return 'Summer';
  return 'Fall';
}

export default function ProjectCreate() {
  const { supabase, user, profile, session } = useAuth();
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

  // Brief-to-draft (Step 1: fixture-backed, no API). Optional and non-blocking —
  // if it's never used or is discarded, the form below creates the project
  // exactly as it did before.
  const [brief, setBrief] = useState('');
  const draft = useBriefDraft();

  function draftFromBrief() {
    // Deliberate trigger only — never auto-fires on paste/change. Streams from
    // the draft-from-brief Edge Function; parseDraft-grade defensive coercion
    // runs on every event inside the driver (network response is untrusted).
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-from-brief`;
    draft.startDraft(
      serverDraftDriver({
        url,
        token: session?.access_token,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        brief,
      }),
      {
        // Pre-fill the description field, but never stomp on what the professor
        // has already typed there.
        onDescription: (d) => setDescription((cur) => (cur.trim() ? cur : d)),
      },
    );
  }

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

      // If a drafted plan is present, write its milestones + tasks through the
      // EXISTING creation functions. Sequential because each task needs its
      // milestone's real id. Empty-named rows are skipped defensively. This runs
      // only when hasPlan — otherwise creation is byte-for-byte the old flow.
      //
      // Non-blocking by design: the project (team) already exists at this point,
      // so a failure writing the plan must NOT strand the professor on an error.
      // We log it and still navigate into the created project, where the plan can
      // be finished by hand. (Best-effort, like the course rollback above — true
      // atomicity would need an RPC.)
      if (draft.hasPlan) {
        try {
          const plan = draft.milestones;
          for (let i = 0; i < plan.length; i += 1) {
            const m = plan[i];
            if (!m.name.trim()) continue;
            const milestone = await createMilestone(supabase, {
              teamId: team.id, createdBy: user.id, title: m.name, orderIdx: i, dueAt: m.dueAt || null,
            });
            for (const t of m.tasks) {
              if (!t.name.trim()) continue;
              await createTask(supabase, {
                teamId: team.id, createdBy: user.id, title: t.name, description: t.description, milestoneId: milestone.id,
              });
            }
          }
        } catch (planErr) {
          console.error('Draft plan write failed (project still created):', planErr);
        }
      }

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
        {/* Brief-to-draft: seen BEFORE manual entry, framed as an alternative. */}
        <div className="bd-brief">
          <SectionLabel>Start from your assignment brief</SectionLabel>
          <p className="bd-brief-hint">Paste your brief and let AI draft the milestones and tasks — or skip this and fill the form in yourself.</p>
          <textarea
            className="textarea bd-brief-input"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={MAX_BRIEF_CHARS}
            placeholder="Paste your assignment brief here…"
          />
          <div className="bd-brief-foot">
            <span className={`bd-brief-count${brief.length >= MAX_BRIEF_CHARS ? ' is-max' : ''}`}>
              {brief.length >= MAX_BRIEF_CHARS ? `Capped at ${MAX_BRIEF_CHARS.toLocaleString()} characters` : `${brief.length.toLocaleString()} / ${MAX_BRIEF_CHARS.toLocaleString()}`}
            </span>
            <button
              type="button"
              className="btn btn-p btn-sm"
              onClick={draftFromBrief}
              disabled={!brief.trim() || draft.status === 'drafting'}
            >
              {draft.status === 'drafting' ? <span className="spin"/> : (draft.hasPlan ? 'Re-draft from brief' : 'Draft from brief')}
            </button>
          </div>
          {draft.error && <div className="bd-brief-msg">{draft.error}</div>}
        </div>

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
          <div style={{padding:14,borderRadius:12,background:'rgba(var(--accent-rgb),.06)',border:'1px solid rgba(var(--accent-rgb),.18)',marginBottom:14}}>
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

        {/* Drafted plan sits AFTER the details a professor fills regardless, so
            the paste step reads as a shortcut for the rest of setup. The review's
            own "Drafted plan" header is the section divider — no extra label. */}
        {draft.hasPlan && (
          <>
            <BriefDraftReview milestones={draft.milestones} status={draft.status} actions={draft.actions} />
            <button type="button" className="bd-discard" onClick={draft.discard}>Discard draft &amp; fill in manually</button>
          </>
        )}

        {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}

        <button type="submit" className="btn btn-p btn-bl" disabled={saving || draft.status === 'drafting'} style={{marginTop:8}}>
          {saving ? <span className="spin"/> : (draft.hasPlan ? 'Create project & plan' : 'Create project')}
        </button>
      </form>
    </>
  );
}
