import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase_Client';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
        else { setProfile(null); setLoading(false); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(id) {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', id).single();
    setProfile(data);
    setLoading(false);
  }

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

  const updatePassword = (password) =>
    supabase.auth.updateUser({ password });

  const signOut = () => supabase.auth.signOut();

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const isStudent = profile?.role === 'student';

  const contextValue = useMemo(() => ({
    user, profile, loading,
    signIn, resetPassword, updatePassword, signOut,
    refreshProfile: () => user && fetchProfile(user.id),
    isSuperAdmin, isAdmin, isStudent,
  }), [user, profile, loading, isSuperAdmin, isAdmin, isStudent]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);