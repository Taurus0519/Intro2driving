import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAunth.jsx';

export default function ResetPassword() {
  const { updatePassword, signOut, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const description = params.get('error_description');
    return description
      ? `${description.replace(/\+/g, ' ')} Request a new password reset link and try again.`
      : '';
  });
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
      } else {
        setPasswordUpdated(true);
      }
    } catch (updateError) {
      setError(updateError.message || 'Your password could not be updated. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function goToSignIn() {
    setError('');
    setSigningOut(true);
    try {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setError(`Your password was changed, but we could not end this reset session: ${signOutError.message}`);
        return;
      }
      navigate('/login', { replace: true });
    } catch (signOutError) {
      setError(`Your password was changed, but we could not end this reset session: ${signOutError.message || 'Please try again.'}`);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="login-view">
      <div className="login-card">
        <img className="brand-mark-image" src="/riteway-logo.png" alt="Riteway Driving School" />
        <p className="eyebrow">RITEWAY DRIVING SCHOOL</p>
        <h1>{passwordUpdated ? 'Password changed' : 'Create a new password'}</h1>
        <p className="muted">
          {passwordUpdated
            ? 'Your password has been updated. Sign in with your new password.'
            : 'Choose a new password with at least 6 characters, then confirm it below.'}
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        {authLoading ? (
          <p className="muted">Verifying your reset link...</p>
        ) : passwordUpdated ? (
          <button type="button" className="button primary full" onClick={goToSignIn} disabled={signingOut}>
            {signingOut ? 'Please wait...' : 'Continue to sign in'}
          </button>
        ) : user ? (
          <form onSubmit={submit}>
            <label>
              Create new password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <button type="submit" className="button primary full" disabled={loading}>
              {loading ? 'Changing password...' : 'Change password'}
            </button>
          </form>
        ) : (
          <p className="muted">This reset link is invalid or expired. Request a new one from the sign-in page.</p>
        )}
        {!passwordUpdated && (
          <button type="button" className="text-button" onClick={() => navigate('/login')}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}