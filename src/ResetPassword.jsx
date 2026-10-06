import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAunth.jsx';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
        <form onSubmit={submit}>
          <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
          <label>Confirm password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required /></label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button type="submit" className="button primary full" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <button type="button" className="text-button" onClick={() => navigate('/login')}>Back to sign in</button>
      </div>
    </div>
  );
}