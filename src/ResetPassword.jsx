import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAunth.jsx';

export default function ResetPassword() {
  const { updatePassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const description = params.get('error_description');
    return description
      ? `${description.replace(/\+/g, ' ')} Request a new password reset link and try again.`
      : '';
  });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    if (updateError) setError(updateError.message);
    else setMessage('Password updated. You can now sign in.');
    setLoading(false);
  }

  return (
    <div className="login-view">
      <div className="login-card">
        <div className="brand-mark">R</div>
        <h1>Choose a new password</h1>
        <p className="muted">Use a password with at least 6 characters.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        {authLoading ? (
          <p className="muted">Verifying your reset link...</p>
        ) : user ? (
          <form onSubmit={submit}>
            <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
            <label>Confirm password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required /></label>
            <button type="submit" className="button primary full" disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        ) : (
          <p className="muted">This reset link is invalid or expired. Request a new one from the sign-in page.</p>
        )}
        <button type="button" className="text-button" onClick={() => navigate('/login')}>Back to sign in</button>
      </div>
    </div>
  );
}