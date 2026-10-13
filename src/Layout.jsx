import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAunth.jsx';
import './Layout.css';

const NAV = {
  superadmin: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/admins', label: 'Admins' },
    { to: '/students', label: 'Students' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/messages', label: 'Messages' },
    { to: '/achievements', label: 'Achievements' },
    { to: '/pdc-checklist', label: 'PDC Checklist' },
  ],
  admin: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/students', label: 'Students' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/messages', label: 'Messages' },
    { to: '/pdc-checklist', label: 'PDC Checklist' },
  ],
  student: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/quiz', label: 'Quiz' },
    { to: '/messages', label: 'Messages' },
    { to: '/profile', label: 'Profile' },
    { to: '/achievements', label: 'Achievements' },
    { to: '/pdc-checklist', label: 'PDC Checklist' },
  ],
};

export default function Layout() {
  const { profile, signOut } = useAuth();
  const items = NAV[profile.role] || [];
  const location = useLocation();
  const pageTitle = items.find((item) => item.to === location.pathname)?.label || 'Dashboard';
  const roleLabel = profile.role === 'superadmin'
    ? 'Super Admin'
    : profile.role === 'admin' ? 'Admin' : 'Student';

  return (
    <div className="app">
      <aside className="sidebar">
        <img className="sidebar-logo" src="/riteway-logo.png" alt="Riteway Driving School" />
        <div className="brand-name">Riteway</div>
        <details className="account-menu sidebar-account-menu">
          <summary className="user-chip">
            <span className="account-menu-labels">
              <span className="account-menu-name">{profile.name}</span>
              <span className="account-menu-role">{roleLabel}</span>
            </span>
            <span className="account-menu-chevron" aria-hidden="true">▾</span>
          </summary>
          <div className="account-menu-panel">
            <span className="account-menu-role">{roleLabel}</span>
            <button type="button" className="button logout" onClick={signOut}>Log out</button>
          </div>
        </details>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="portal-eyebrow">RITEWAY DRIVING SCHOOL PORTAL</span>
            <h2>{pageTitle}</h2>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}