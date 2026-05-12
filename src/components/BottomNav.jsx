import { NavLink } from 'react-router-dom';

export default function BottomNav({role, insightBadgeCount = 0}) {
  const tabs = [
    {to:"/home",     icon:"⌂", label:"Home"},
    {to:"/projects", icon:"▦", label:"Projects"},
    {to:"/ai",       icon:"✦", label:"AI", badge: role==="professor" ? insightBadgeCount : 0},
    {to:"/profile",  icon:"◉", label:"Profile"}
  ];
  return (
    <div className="bnav">
      {tabs.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({isActive}) => `nav ${isActive ? "active" : ""}`}
          style={{textDecoration:"none"}}
        >
          <span className="nav-i">{t.icon}</span>
          <span className="nav-l">{t.label}</span>
          {t.badge>0 && <span className="nav-b">{t.badge}</span>}
        </NavLink>
      ))}
    </div>
  );
}
