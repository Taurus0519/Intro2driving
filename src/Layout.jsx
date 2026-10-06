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
  ],
  admin: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/students', label: 'Students' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/messages', label: 'Messages' },
  ],
  student: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/quiz', label: 'Quiz' },
    { to: '/messages', label: 'Messages' },
    { to: '/profile', label: 'Profile' },
    { to: '/achievements', label: 'Achievements' },
  ],
};

export default function Layout() {
  const { profile, signOut } = useAuth();
  const items = NAV[profile.role] || [];
  const location = useLocation();
  const pageTitle = items.find((item) => item.to === location.pathname)?.label || 'Dashboard';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-mark">R</div>
        <div className="brand-name">Riteway</div>
        <div className="role-badge">{profile.role.toUpperCase()}</div>
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
            <span className="portal-eyebrow">DRIVING SCHOOL PORTAL</span>
            <h2>{pageTitle}</h2>
          </div>
          <div className="top-actions">
            <button className="button logout" onClick={signOut}>Log out</button>
            <span className="user-chip">{profile.name}</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}