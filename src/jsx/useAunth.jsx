import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase_Client';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [welcomeUserId, setWelcomeUserId] = useState(null);
  const showLoginWelcome = Boolean(user && welcomeUserId === user.id);

  useEffect(() => {
    if (!showLoginWelcome || loading || !profile) return;
    const timer = window.setTimeout(() => setWelcomeUserId(null), 3000);
    return () => window.clearTimeout(timer);
  }, [showLoginWelcome, loading, profile?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else { setWelcomeUserId(null); setProfile(null); setLoading(false); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(id) {
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', id).maybeSingle();

      if (error) throw error;
      setProfile(data ?? null);
    } catch (error) {
      console.warn('Profile lookup failed:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    setLoginInProgress(true);
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error && result.data?.user) setWelcomeUserId(result.data.user.id);
      return result;
    } finally {
      setLoginInProgress(false);
    }
  }

  const resetPassword = (email) => {
    const configuredAppUrl = import.meta.env.DEV ? import.meta.env.VITE_APP_URL : '';
    const appUrl = (configuredAppUrl || window.location.origin).replace(/\/+$/, '');
    const basePath = import.meta.env.BASE_URL === '/'
      ? ''
      : import.meta.env.BASE_URL.replace(/\/+$/, '');

    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}${basePath}/reset-password`,
    });
  };

  const updatePassword = (password) =>
    supabase.auth.updateUser({ password });

  const signOut = () => supabase.auth.signOut();

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const isStudent = profile?.role === 'student';

  const contextValue = useMemo(() => ({
    user, profile, loading, loginInProgress, showLoginWelcome,
    signIn, resetPassword, updatePassword, signOut,
    refreshProfile: () => user && fetchProfile(user.id),
    isSuperAdmin, isAdmin, isStudent,
  }), [user, profile, loading, loginInProgress, showLoginWelcome, isSuperAdmin, isAdmin, isStudent]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
