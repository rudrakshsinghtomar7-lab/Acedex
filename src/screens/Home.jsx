// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study design system — Home reference screen. Warm, restrained, grounded (no
// floating cards, no stat-tile grid, no foil dividers). Content is REAL and
// specific: actual deadlines, names, counts, percentages pulled from each
// project — never uniform generic metrics.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/SessionProvider.jsx';
import { useDemoMode } from '../hooks/useDemoMode.jsx';
import SectionLabel from '../components/study/SectionLabel.jsx';
import StatusDot from '../components/study/StatusDot.jsx';
import ProjectItem from '../components/study/ProjectItem.jsx';
import ActivityRow from '../components/study/ActivityRow.jsx';
import {
  adaptTeam, listTeamsForUser,
  loadHomeStatsForProfessor, loadHomeStatsForStudent,
} from '../lib/teams.js';
import { timeGreeting, buildDueSoon, buildRecent, needCount } from './home/derive.js';

export default function Home({ role, openSettings, openNotif, notifUnread }) {
  const { user, profile, supabase } = useAuth();
  const { demoMode, demoData } = useDemoMode();
  const navigate = useNavigate();
  const demoOn = demoMode && demoData;
  const isProf = role === 'professor';

  const nameTokens = (profile?.full_name ?? '').split(/\s+/).filter(Boolean);
  const firstName = nameTokens[0] ?? '';
  const lastName = nameTokens[nameTokens.length - 1] ?? '';
  const displayName = isProf ? (lastName ? `Prof. ${lastName}` : '') : firstName;

  const [stats, setStats] = useState(null);
  const [realProjects, setRealProjects] = useState([]);
  const [dataError, setDataError] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !role) return;
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      try {
        setDataError(null);
        const [s, teams] = await Promise.all([
          isProf
            ? loadHomeStatsForProfessor(supabase, user.id)
            : loadHomeStatsForStudent(supabase, user.id),
          listTeamsForUser(supabase, { role, userId: user.id }),
        ]);
        if (cancelled) return;
        setStats(s);
        setRealProjects(teams.map(t => adaptTeam(t, t.members)));
      } catch (e) {
        if (!cancelled) setDataError(e.message || String(e));
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, role, supabase]);

  // Demo projects visible to this persona (pros see all; students see their own).
  const demoProjects = demoOn
    ? (isProf
        ? demoData.DEMO_PROJECTS
        : demoData.getDemoProjectsForStudent(demoData.DEMO_CURRENT_STUDENT_ID))
    : [];
  const projects = demoOn ? [...realProjects, ...demoProjects] : realProjects;

  const dStats = demoOn ? (isProf ? demoData.DEMO_STATS.professor : demoData.DEMO_STATS.student) : null;
  const studentsCount = (stats?.students ?? 0) + (dStats?.students ?? 0);
  const atRiskCount = (stats?.atRisk ?? 0) + (dStats?.atRisk ?? 0);

  const need = needCount(projects);
  const dueSoon = buildDueSoon(projects);
  const recent = buildRecent(projects);
  // Streak is real only in demo (no live source yet) — degrade silently.
  const streak = demoOn && !isProf ? 12 : null;

  const onOpenProject = (p) => navigate(`/projects/${p.id}`);

  const plural = (n) => (n === 1 ? '' : 's');

  const greeting = displayName
    ? <>{timeGreeting()}, <span className="nm">{displayName}</span></>
    : <>{timeGreeting()}</>;

  // Subtitle — role-aware, specific counts, no generic filler.
  const subtitle = isProf
    ? (
        <>
          {atRiskCount > 0
            ? <>{atRiskCount} project{plural(atRiskCount)} need attention</>
            : <>All projects on track</>}
          {studentsCount > 0 && <> · {studentsCount} students</>}
        </>
      )
    : (
        <>
          {need > 0
            ? <>{need} project{plural(need)} need you today</>
            : <>Nothing pressing today</>}
          {streak != null && <> · {streak}-day streak <span className="gold">✦</span></>}
        </>
      );

  const loadingOnly = dataLoading && realProjects.length === 0 && !demoOn;
  const hardError = dataError && !demoOn;

  return (
    <div className="study-home">
      <div className="study-head">
        <div className="study-greet">{greeting}</div>
        <div className="study-icons">
          <button className="study-ico" onClick={openNotif} aria-label="Notifications">
            ◔
            {notifUnread > 0 && <span className="study-ico-bdg">{notifUnread}</span>}
          </button>
          <button className="study-ico" onClick={openSettings} aria-label="Settings">⚙</button>
        </div>
      </div>
      <div className="study-sub">{subtitle}</div>
      {demoOn && (
        <div className="study-note"><span style={{ color: 'var(--sd-gold)' }}>✦</span> Demo data mixed with your projects</div>
      )}

      {/* DUE SOON */}
      {dueSoon.length > 0 && (
        <div className="study-section">
          <SectionLabel>Due soon</SectionLabel>
          {dueSoon.map(item => (
            <div key={item.id} className="study-due">
              <StatusDot status={item.status} />
              <span className="study-due-name">{item.name}</span>
              {item.when && <span className="study-due-when">{item.when}</span>}
            </div>
          ))}
        </div>
      )}

      {/* PROJECTS */}
      <div className="study-section">
        <SectionLabel>{isProf ? 'Supervised' : 'Projects'}</SectionLabel>
        {hardError ? (
          <div className="study-empty">Couldn't load your projects. {dataError}</div>
        ) : loadingOnly ? (
          <div className="study-empty">Loading your projects…</div>
        ) : projects.length === 0 ? (
          <div className="study-empty">
            {isProf ? 'No supervised projects yet.' : 'No projects have found their way to you yet.'}
          </div>
        ) : (
          projects.map(p => <ProjectItem key={p.id} project={p} onOpen={onOpenProject} />)
        )}
        {dataError && demoOn && (
          <div className="study-note">Showing demo data only — couldn't reach live projects.</div>
        )}
      </div>

      {/* RECENT */}
      {recent.length > 0 && (
        <div className="study-section">
          <SectionLabel>Recent</SectionLabel>
          {recent.map(r => (
            <ActivityRow key={r.id} before={r.before} accent={r.accent} tone={r.tone} />
          ))}
        </div>
      )}

      <div className="study-close">Nothing else needs you right now.</div>
    </div>
  );
}
