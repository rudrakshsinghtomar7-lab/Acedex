import { Link, useLocation } from 'react-router-dom';

// Outlined/filled icon pairs. Inactive uses 1.75 stroke + no fill so it reads
// as a hairline outline; active uses a solid fill so the silhouette pops on
// top of the gradient pill.

function HomeIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.293 2.293a1 1 0 0 1 1.414 0l8.586 8.586A1 1 0 0 1 21 12.586V20a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-7.414a1 1 0 0 1 .293-.707l8-8z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 11l8.5-7.6 8.5 7.6" />
      <path d="M5.5 9.7V19.5a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1V9.7" />
      <path d="M9.75 20.5v-6.25a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V20.5" />
    </svg>
  );
}

function ProjectsIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="3"  y="3"  width="8" height="8" rx="2" />
      <rect x="13" y="3"  width="8" height="8" rx="2" />
      <rect x="3"  y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5"  y="3.5"  width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5"  width="7" height="7" rx="1.5" />
      <rect x="3.5"  y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function AiIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.05 2.8a1 1 0 0 1 1.9 0l1.45 4.35a1 1 0 0 0 .63.63L19.38 9.23a1 1 0 0 1 0 1.9l-4.35 1.45a1 1 0 0 0-.63.63L12.95 17.56a1 1 0 0 1-1.9 0L9.6 13.21a1 1 0 0 0-.63-.63L4.62 11.13a1 1 0 0 1 0-1.9L8.97 7.78a1 1 0 0 0 .63-.63L11.05 2.8z" />
      <path d="M18.55 15.05a.5.5 0 0 1 .9 0l.4 1.2a.5.5 0 0 0 .31.32l1.2.4a.5.5 0 0 1 0 .94l-1.2.4a.5.5 0 0 0-.31.32l-.4 1.2a.5.5 0 0 1-.9 0l-.4-1.2a.5.5 0 0 0-.32-.32l-1.2-.4a.5.5 0 0 1 0-.94l1.2-.4a.5.5 0 0 0 .32-.32l.4-1.2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3.2l1.55 4.2 4.2 1.55-4.2 1.55L12 14.7l-1.55-4.2-4.2-1.55 4.2-1.55L12 3.2z" />
      <path d="M18.8 15.4l.65 1.65 1.65.65-1.65.65L18.8 20l-.65-1.65-1.65-.65 1.65-.65.65-1.65z" />
    </svg>
  );
}

function ProfileIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0 1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.5 20.5c.7-4 4-6.4 7.5-6.4s6.8 2.4 7.5 6.4" />
    </svg>
  );
}

const TABS = [
  { to: '/home',     label: 'Home',     Icon: HomeIcon },
  { to: '/projects', label: 'Projects', Icon: ProjectsIcon },
  { to: '/ai',       label: 'AI',       Icon: AiIcon },
  { to: '/profile',  label: 'Profile',  Icon: ProfileIcon },
];

export default function BottomNav({ role, insightBadgeCount = 0 }) {
  const location = useLocation();
  const path = location.pathname;
  // Match exact route or any nested path under the tab (e.g. /projects/123).
  const activeIdx = TABS.findIndex(t => path === t.to || path.startsWith(`${t.to}/`));

  return (
    <nav
      className="bnav"
      data-active={activeIdx}
      style={{ '--active-idx': activeIdx < 0 ? 0 : activeIdx, '--tab-count': TABS.length }}
    >
      <span className="bnav-pill" aria-hidden />
      {TABS.map((t, i) => {
        const isActive = i === activeIdx;
        const Icon = t.Icon;
        const badge = t.to === '/ai' && role === 'professor' ? insightBadgeCount : 0;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`nav ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={t.label}
          >
            <span className="nav-icon" aria-hidden>
              <Icon active={isActive} />
            </span>
            <span className="nav-label">{t.label}</span>
            {badge > 0 && <span className="nav-badge">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
