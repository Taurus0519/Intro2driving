import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase_Client';
import { securityRequest } from './securityApi';
import { IDLE_LOCK_MS } from '../js/securityConfig.mjs';

const AuthContext = createContext({});

function readActivity() {
  try { return Number(localStorage.getItem('riteway-portal-activity')) || 0; }
  catch { return 0; }
}
function storeEvent(key, value) {
  try { localStorage.setItem(key, String(value)); }
  catch { /* The current tab still enforces its inactivity timer. */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [welcomeUserId, setWelcomeUserId] = useState(null);
  const [pinStatus, setPinStatus] = useState(null);
  const [authError, setAuthError] = useState('');
  const [moduleActive, setModuleActive] = useState(false);
  const authVersion = useRef(0);
  const activityTime = useRef(Date.now());
  const tokenRef = useRef(null);
  const showLoginWelcome = Boolean(user && welcomeUserId === user.id);

  useEffect(() => {
    if (!showLoginWelcome || loading || !profile) return;
    const timer = window.setTimeout(() => setWelcomeUserId(null), 1000);
    return () => window.clearTimeout(timer);
  }, [showLoginWelcome, loading, profile?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      tokenRef.current = session?.access_token;
      if (session?.user) void fetchProfile();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        tokenRef.current = session?.access_token;
        if (session?.user) window.setTimeout(() => void fetchProfile(), 0);
        else { authVersion.current++; setWelcomeUserId(null); setProfile(null); setPinStatus(null); setAuthError(''); setLoading(false); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(token) {
    const version = ++authVersion.current;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) throw new Error('Please sign in to load your profile.');
      const { data: accountProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      if (version !== authVersion.current) return;
      setAuthError('');
      setProfile(accountProfile);
    } catch (error) {
      if (version !== authVersion.current) return;
      setAuthError(error.message);
    } finally {
      if (version === authVersion.current) setLoading(false);
    }
  }

  async function signIn(email, password) {
    setLoginInProgress(true);
    try {
      const { session } = await securityRequest('sign-in', { email, password });
      const result = await supabase.auth.setSession(session);
      if (!result.error) await fetchProfile(session.access_token);
      return result;
    } catch (error) {
      return { error };
    } finally {
      setLoginInProgress(false);
    }
  }

  async function completePin(action, values) {
    const result = await securityRequest(action, values);
    ++authVersion.current;
    if (result.pinRequired) {
      setPinStatus(result);
    } else {
      activityTime.current = Date.now();
      storeEvent('riteway-portal-activity', activityTime.current);
      setPinStatus(null); setAuthError(''); setProfile(result.profile); setWelcomeUserId(result.profile.id);
    }
    return result;
  }

  async function lockPortal(broadcast = true) {
    const version = ++authVersion.current;
    const lockState = { pinRequired: true, needsSetup: false, passwordRequired: false };
    setPinStatus({ ...lockState, locking: true });
    setWelcomeUserId(null);
    if (broadcast) storeEvent('riteway-portal-lock', Date.now());
    try {
      const result = await securityRequest('lock', {}, tokenRef.current);
      if (version === authVersion.current) setPinStatus(result);
    } catch {
      // Keep the screen covered even when disconnected; the server expires it too.
      if (version === authVersion.current) setPinStatus(lockState);
    }
  }

  useEffect(() => {
    if (!user || !profile || pinStatus || !moduleActive) return;
    const stored = readActivity();
    activityTime.current = stored || Date.now();
    let busy = false;
    let lastTouch = Date.now();
    let lastActivitySent = activityTime.current;
    let lastStored = 0;
    function onActivity(event) {
      if (!event.isTrusted) return;
      const now = Date.now();
      if (now - activityTime.current >= IDLE_LOCK_MS) { void lockPortal(); return; }
      activityTime.current = now;
      if (now - lastStored >= 1000) { storeEvent('riteway-portal-activity', now); lastStored = now; }
    }
    function onStorage(event) {
      if (event.key === 'riteway-portal-lock') void lockPortal(false);
      if (event.key === 'riteway-portal-activity') activityTime.current = Number(event.newValue) || activityTime.current;
    }
    async function check() {
      if (busy) return;
      if (Date.now() - activityTime.current >= IDLE_LOCK_MS) { void lockPortal(); return; }
      if (Date.now() - lastTouch < 30000) return;
      if (activityTime.current <= lastActivitySent) return;
      busy = true;
      const version = authVersion.current;
      try {
        const result = await securityRequest('touch', {}, tokenRef.current);
        if (version === authVersion.current && result.pinRequired) { setPinStatus(result); }
        lastTouch = Date.now();
        lastActivitySent = activityTime.current;
      } catch { if (version === authVersion.current) void lockPortal(); }
      finally { busy = false; }
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const interval = window.setInterval(check, 1000);
    void check();
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener('storage', onStorage); window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check); window.clearInterval(interval);
    };
  }, [user?.id, profile?.id, Boolean(pinStatus), moduleActive]);

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

  const signOut = async () => {
    if (tokenRef.current) await securityRequest('lock', {}, tokenRef.current).catch(() => {});
    return supabase.auth.signOut();
  };

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const isStudent = profile?.role === 'student';

  const contextValue = {
    user, profile, loading, loginInProgress, showLoginWelcome, pinStatus, authError,
    signIn, resetPassword, updatePassword, signOut, completePin, lockPortal, setModuleActive,
    checkModule: async () => { const result = await securityRequest('module-status'); setPinStatus(result.pinRequired ? result : null); return result; },
    refreshProfile: () => user && fetchProfile(tokenRef.current),
    isSuperAdmin, isAdmin, isStudent,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
