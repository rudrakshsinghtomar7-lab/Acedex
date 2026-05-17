import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';
import ProgBar from '../components/ProgBar.jsx';
import TagInput from '../components/TagInput.jsx';
import {
  loadExtension, loadUniversities, saveProfile, completenessFor,
} from '../lib/profile.js';

const YEAR_OPTIONS    = ['freshman','sophomore','junior','senior','graduate'];
const TITLE_OPTIONS   = ['lecturer','adjunct','assistant','associate','full','emeritus'];
const INST_WARN = 'Changing institution hides your current projects (they remain in your previous university). Continue?';

export default function ProfileEdit() {
  const { supabase, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [bio, setBio] = useState('');

  // Student fields
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [interests, setInterests] = useState([]);

  // Professor fields
  const [title, setTitle] = useState('lecturer');
  const [department, setDepartment] = useState('');
  const [researchAreas, setResearchAreas] = useState([]);
  const [officeLocation, setOfficeLocation] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [homepageUrl, setHomepageUrl] = useState('');

  const [ext, setExt] = useState(null);
  const [universities, setUniversities] = useState([]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        const [extRow, unis] = await Promise.all([
          loadExtension(supabase, profile.id, profile.role),
          loadUniversities(supabase),
        ]);
        if (cancelled) return;
        setExt(extRow);
        setUniversities(unis);
        setFullName(profile.full_name ?? '');
        setAvatarUrl(profile.avatar_url ?? '');
        setUniversityId(profile.university_id ?? '');
        setBio(profile.bio ?? '');
        if (profile.role === 'student') {
          setMajor(extRow?.major ?? '');
          setYear(extRow?.year ?? '');
          setInterests(extRow?.interests ?? []);
        } else if (profile.role === 'professor') {
          setTitle(extRow?.title ?? 'lecturer');
          setDepartment(extRow?.department && extRow.department !== 'TBD' ? extRow.department : '');
          setResearchAreas(extRow?.research_areas ?? []);
          setOfficeLocation(extRow?.office_location ?? '');
          setOfficeHours(extRow?.office_hours ?? '');
          setHomepageUrl(extRow?.homepage_url ?? '');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, supabase]);

  if (loading || !profile) {
    return <div className="empty"><div className="spin" style={{margin:'0 auto 12px'}}/><p className="empty-h">Loading…</p></div>;
  }

  const livePct = (() => {
    const liveProfile = { ...profile, full_name: fullName, university_id: universityId };
    const liveExt = profile.role === 'professor'
      ? { ...ext, title, department, research_areas: researchAreas }
      : { ...ext, interests, major };
    return completenessFor(liveProfile, liveExt);
  })();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    if (universityId !== profile.university_id && !window.confirm(INST_WARN)) {
      setUniversityId(profile.university_id);
      return;
    }

    setSaving(true);
    try {
      const profileUpdate = {
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || null,
        university_id: universityId,
        bio: bio.trim() || null,
      };
      const extUpdate = profile.role === 'professor'
        ? {
            title,
            department: department.trim() || 'TBD',
            research_areas: researchAreas,
            office_location: officeLocation.trim() || null,
            office_hours: officeHours.trim() || null,
            homepage_url: homepageUrl.trim() || null,
          }
        : {
            major: major.trim() || null,
            year: year || null,
            interests,
          };
      await saveProfile(supabase, { profileId: profile.id, role: profile.role, profileUpdate, extUpdate });
      await refreshProfile();
      setSavedAt(new Date());
    } catch (e2) {
      setError(e2.message || String(e2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="header">
        <div>
          <div className="greeting">Your profile</div>
          <div className="display">Edit profile</div>
        </div>
        <Link to="/profile" className="icon-btn" style={{textDecoration:'none'}}>✕</Link>
      </div>

      <div style={{padding:'0 24px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,fontSize:12.5,color:'var(--muted)',fontWeight:600}}>
          <span>Profile completeness</span>
          <span>{livePct}%</span>
        </div>
        <ProgBar value={livePct}/>
      </div>

      <form onSubmit={onSubmit} style={{padding:'12px 24px 24px'}}>
        <div className="field">
          <label>Full name</label>
          <input className="input" type="text" value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>
        </div>

        <div className="field">
          <label>Avatar URL</label>
          <input className="input" type="url" placeholder="https://…" value={avatarUrl} onChange={(e)=>setAvatarUrl(e.target.value)}/>
        </div>

        <div className="field">
          <label>Institution</label>
          <select className="select" value={universityId} onChange={(e)=>setUniversityId(e.target.value)}>
            {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Bio</label>
          <textarea className="textarea" value={bio} onChange={(e)=>setBio(e.target.value)}/>
        </div>

        {profile.role === 'student' && (
          <>
            <div className="field">
              <label>Major</label>
              <input className="input" type="text" value={major} onChange={(e)=>setMajor(e.target.value)}/>
            </div>
            <div className="field">
              <label>Year</label>
              <select className="select" value={year} onChange={(e)=>setYear(e.target.value)}>
                <option value="">—</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Interests</label>
              <TagInput values={interests} onChange={setInterests} placeholder="e.g. NLP, distributed systems"/>
            </div>
          </>
        )}

        {profile.role === 'professor' && (
          <>
            <div className="field">
              <label>Title</label>
              <select className="select" value={title} onChange={(e)=>setTitle(e.target.value)}>
                {TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Department</label>
              <input className="input" type="text" value={department} onChange={(e)=>setDepartment(e.target.value)} placeholder="e.g. Computer Science"/>
            </div>
            <div className="field">
              <label>Subjects</label>
              <TagInput values={researchAreas} onChange={setResearchAreas} placeholder="e.g. ML, ethics"/>
            </div>
            <div className="field">
              <label>Office location</label>
              <input className="input" type="text" value={officeLocation} onChange={(e)=>setOfficeLocation(e.target.value)}/>
            </div>
            <div className="field">
              <label>Office hours</label>
              <input className="input" type="text" value={officeHours} onChange={(e)=>setOfficeHours(e.target.value)} placeholder="e.g. Tue 2-4pm"/>
            </div>
            <div className="field">
              <label>Website</label>
              <input className="input" type="url" value={homepageUrl} onChange={(e)=>setHomepageUrl(e.target.value)} placeholder="https://…"/>
            </div>
          </>
        )}

        {error && <div className="alert" style={{marginBottom:14}}><span>{error}</span></div>}
        {savedAt && !error && (
          <div className="alert" style={{marginBottom:14,background:'rgba(124,108,255,.08)',borderColor:'rgba(124,108,255,.35)'}}>
            <span>Saved.</span>
          </div>
        )}

        <button type="submit" className="btn btn-p btn-bl" disabled={saving} style={{marginTop:8}}>
          {saving ? <span className="spin"/> : 'Save changes'}
        </button>
        <button type="button" className="btn btn-g" disabled={saving} style={{marginTop:10}}
          onClick={() => navigate('/profile')}>
          Cancel
        </button>
      </form>
    </>
  );
}
