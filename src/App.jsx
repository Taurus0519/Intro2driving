import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './useAunth';
import Layout from './Layout';
import Dashboard from './Dashboard';
import LoginPage from './Loginpage';
import ResetPassword from './ResetPassword';
import Students from './Students';
import Admins from './admins';
import Lessons from './lessons';
import Assignments from './assignments';
import Messages from './messages';
import Profile from './Profile';
import Achievements from './Achievements';
import './App.css';

function Protected() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading portal...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="loading-screen">Your account has no profile. Contact your school administrator.</div>;
  return <Layout />;
}
function Role({ allow }) {
  const { profile } = useAuth();
  return allow.includes(profile?.role) ? <Outlet /> : <Navigate to="/" replace />;
}
function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading portal...</div>;
  return user ? <Navigate to="/" replace /> : children;
}
export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<Guest><LoginPage /></Guest>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route element={<Protected />}>
      <Route index element={<Dashboard />} />
      <Route path="assignments" element={<Assignments />} />
      <Route path="messages" element={<Messages />} />
      <Route path="achievements" element={<Achievements />} />
      <Route element={<Role allow={['student']} />}><Route path="profile" element={<Profile />} /></Route>
      <Route element={<Role allow={['student', 'admin', 'superadmin']} />}>
        <Route path="quiz" element={<Lessons />} />
        <Route path="lessons" element={<Navigate to="/quiz" replace />} />
      </Route>
      <Route element={<Role allow={['admin', 'superadmin']} />}>
        <Route path="students" element={<Students />} />
      </Route>
      <Route element={<Role allow={['superadmin']} />}><Route path="admins" element={<Admins />} /></Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></AuthProvider>;
}
