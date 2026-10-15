import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './useAunth';
import Layout from './Layout';
import '../css/App.css';

const Dashboard = lazy(() => import('./Dashboard'));
const LoginPage = lazy(() => import('./Loginpage'));
const ResetPassword = lazy(() => import('./ResetPassword'));
const Students = lazy(() => import('./Students'));
const Admins = lazy(() => import('./admins'));
const Lessons = lazy(() => import('./lessons'));
const Assignments = lazy(() => import('./assignments'));
const Messages = lazy(() => import('./messages'));
const Profile = lazy(() => import('./Profile'));
const Achievements = lazy(() => import('./Achievements'));
const PdcChecklist = lazy(() => import('./PdcChecklist'));

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
  const basename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '');

  return <AuthProvider><BrowserRouter basename={basename}><Suspense fallback={<div className="loading-screen">Loading page...</div>}><Routes>
    <Route path="/login" element={<Guest><LoginPage /></Guest>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route element={<Protected />}>
      <Route index element={<Dashboard />} />
      <Route path="assignments" element={<Assignments />} />
      <Route path="messages" element={<Messages />} />
      <Route path="achievements" element={<Achievements />} />
      <Route element={<Role allow={['student', 'admin', 'superadmin']} />}>
        <Route path="pdc-checklist" element={<PdcChecklist />} />
      </Route>
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
  </Routes></Suspense></BrowserRouter></AuthProvider>;
}
