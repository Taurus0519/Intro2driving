import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { createAccount } from './accounts';

export default function Admins() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('profiles').select('*').in('role', ['admin', 'superadmin']).order('name');
    setAdmins(data || []);
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createAccount({ ...form, role: 'admin' });
      setForm({ name: '', email: '', username: '', password: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="toolbar">
        <div><h3>Admin accounts</h3><p>Super Admin can create and manage admins.</p></div>
        <button type="button" className="button primary small-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create admin'}
        </button>
      </div>

      {showForm && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <label>Full name<input value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Username<input value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
          <label>Role<input value="Admin" readOnly /></label>
          <label>Password<input type="password" value={form.password} minLength={6}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="button primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create admin'}
          </button>
        </form>
      )}

      <div className="panel table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>{a.role === 'superadmin' ? 'Super Admin' : 'Admin'}</td>
                <td><span className={`status ${a.status.toLowerCase()}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
