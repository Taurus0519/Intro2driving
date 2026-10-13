import { useState } from 'react';
import { useAuth } from './useAunth.jsx';

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const [forgotPassword, setForgotPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = forgotPassword
      ? await resetPassword(form.email)
      : await signIn(form.email, form.password);
    if (error) setError(error.message);
    else if (forgotPassword) setError('Password reset email sent. Check your inbox.');
    setLoading(false);
  }

  let submitButtonLabel = 'Sign in';
  if (loading) {
    submitButtonLabel = 'Please wait...';
  } else if (forgotPassword) {
    submitButtonLabel = 'Send reset link';
  }

  return (
    <div className="login-view">
      <div className="login-card">
        <div className="brand-mark">R</div>
        <p className="eyebrow">RITEWAY DRIVING SCHOOL</p>
        <h1>{forgotPassword ? 'Reset your password' : 'Welcome!'}</h1>
        <p className="muted">
          {forgotPassword
            ? 'Enter your email and we will send you a reset link.'
            : 'Sign in with your assigned email and password. Super Admin uses this same sign-in form.'}
        </p>

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

          {error && <p className="error">{error}</p>}

          <button type="submit" className="button primary full" disabled={loading}>
            {submitButtonLabel}
          </button>
        </form>

        <div className="login-links">
          <button type="button" className="text-button" onClick={() => { setForgotPassword(!forgotPassword); setError(''); }}>
            {forgotPassword ? 'Back to sign in' : 'Forgot password?'}
          </button>
        </div>
      </div>
    </div>
  );
}