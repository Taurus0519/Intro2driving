import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './useAunth.jsx';

export default function LoginPage() {
  const { signIn, resetPassword, pinStatus, user, authError, signOut } = useAuth();
  const forgotPassword = useLocation().pathname === '/forgot-password';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordWarning, setPasswordWarning] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPasswordWarning(false);
    try {
      const { error } = forgotPassword ? await resetPassword(form.email) : await signIn(form.email, form.password);
      if (error) { setError(error.message); setPasswordWarning(error.attemptsRemaining !== undefined); }
      else if (forgotPassword) setError('Password reset email sent. Check your inbox.');
    } catch (error) { setError(error.message || 'Sign in failed. Please try again.'); }
    finally { setForm((current) => ({ ...current, password: '' })); setLoading(false); }
  }

  if (user && authError) return <div className="login-view"><div className="login-card">
    <h1>Portal unavailable</h1><p className="error" role="alert">{authError}</p>
    <button type="button" className="button" onClick={() => void signOut()}>Sign out</button>
  </div></div>;

  let submitButtonLabel = 'Sign in';
  if (loading) {
    submitButtonLabel = 'Please wait...';
  } else if (forgotPassword) {
    submitButtonLabel = 'Send reset link';
  }

  return (
    <div className="login-view">
      <nav className="login-public-nav" aria-label="Public navigation">
        <Link to="/">Home</Link>
        <Link to="/#faq">FAQ</Link>
      </nav>
      <div className="login-card">
        <img className="brand-mark-image" src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="Riteway Driving School" />
        <p className="eyebrow">RITEWAY DRIVING SCHOOL</p>
        <h1>{forgotPassword ? 'Reset your password' : 'Welcome!'}</h1>
        <p className="muted">
          {forgotPassword
            ? 'Enter your email and we will send you a reset link.'
            : 'Sign in with your assigned email and password.'}
        </p>
        {!forgotPassword && passwordWarning && <p className="login-security-hint" role="alert">{error} After 3 unsuccessful password attempts, sign in is locked for 15 minutes.</p>}

        <form onSubmit={submit}>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Enter email" required /></label>
          {!forgotPassword && <label>
            Password{' '}
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter password"
              required
            />
            <button
              type="button"
              className="text-button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
          </label>}

          {error && !passwordWarning && <p className="error" role="alert">{error}</p>}

          <button type="submit" className="button primary full" disabled={loading}>
            {submitButtonLabel}
          </button>
        </form>

        <div className="login-links">
          <Link className="text-button" to={forgotPassword ? '/login' : '/forgot-password'}>
            {forgotPassword ? 'Back to sign in' : 'Forgot password?'}
          </Link>
          <Link className="text-button" to="/#faq">Frequently asked questions</Link>
        </div>
      </div>
    </div>
  );
}
