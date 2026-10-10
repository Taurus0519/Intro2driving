import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { createAccount } from './accounts';
import { useAuth } from './useAunth.jsx';
import { ACHIEVEMENTS } from './achievementData.js';

export default function Students() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', age: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [achievementError, setAchievementError] = useState('');
  const [achievementProgress, setAchievementProgress] = useState({});
  const [achievementProgressLoading, setAchievementProgressLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  async function load() {
    setStudentsLoading(true);
    setError('');
    setAchievementError('');
    setAchievementProgressLoading(true);
    try {
      const { data, error: loadError } = await supabase
        .from('profiles').select('*').eq('role', 'student').order('name');
      if (loadError) throw loadError;
      setStudents(data || []);
    } catch (loadError) {
      setError(`Students could not be loaded: ${loadError.message || 'Please try again.'}`);
      setStudentsLoading(false);
      setAchievementProgressLoading(false);
      return;
    }
    setStudentsLoading(false);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch('/api/achievement-progress', {
        headers: { Authorization: ['Bearer', session.access_token].join(' ') },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Achievement progress could not be loaded.');
      const knownAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
      const completedByStudent = new Map();
      for (const award of result?.awards || []) {
        if (!knownAchievementIds.has(award.achievement_id)) continue;
        const completed = completedByStudent.get(award.user_id) || new Set();
        completed.add(award.achievement_id);
        completedByStudent.set(award.user_id, completed);
      }
      setAchievementProgress(
        Object.fromEntries([...completedByStudent].map(([userId, completed]) => [userId, completed.size])),
      );
    } catch (progressLoadError) {
      setAchievementError(progressLoadError.message || 'Achievement progress could not be loaded.');
    } finally {
      setAchievementProgressLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createAccount({ ...form, age: Number(form.age), role: 'student' });
      setForm({ name: '', email: '', username: '', password: '', age: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function toggleStatus(s) {
    const { error: updateError } = await supabase.from('profiles')
      .update({ status: s.status === 'Active' ? 'Inactive' : 'Active' })
      .eq('id', s.id);
    if (updateError) {
      setError(`Student status could not be updated: ${updateError.message}`);
      return;
    }
    await load();
  }

  async function remove(s) {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    setError('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', session.access_token].join(' '),
        },
        body: JSON.stringify({ userId: s.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Student account could not be deleted.');
      await load();
    } catch (deleteError) {
      setError(deleteError.message || 'Student account could not be deleted. Please try again.');
    }
  }

  return (
    <>
      <div className="toolbar">
        <div><h3>Students</h3><p>Manage student accounts.</p></div>
        {isAdmin && (
          <button type="button" className="button primary small-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add student'}
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {showForm && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <label>Full name<input value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Username<input value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
          <label>Age<input type="number" min="0" step="1" value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })} required /></label>
          <label>Password<input type="password" value={form.password} minLength={6}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <button type="submit" className="button primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create student'}
          </button>
        </form>
      )}

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Status</th><th>Progress</th><th>Achievements</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {studentsLoading ? (
              <tr><td colSpan="6">Loading students...</td></tr>
            ) : students.map((s) => {
              const status = s.status || 'Unknown';
              return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td><span className={`status ${status.toLowerCase()}`}>{status}</span></td>
                <td>{s.progress ?? 0}%</td>
                <td>
                  {achievementProgressLoading
                    ? 'Loading...'
                    : achievementError
                      ? 'Unavailable'
                      : `${achievementProgress[s.id] || 0}/${ACHIEVEMENTS.length}`}
                </td>
                <td>
                  <button type="button" className="button small-button" onClick={() => toggleStatus(s)}>
                    {status === 'Active' ? 'Disable' : 'Enable'}
                  </button>{' '}
                  <button type="button" className="button small-button danger" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {achievementError && <p className="error" role="alert">Achievement progress could not be loaded: {achievementError}</p>}
    </>
  );
}