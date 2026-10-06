import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth';
import './Achievements.css';

const emptyForm = { title: '', description: '', icon: '🌟' };
export default function Achievements() {
  const { profile, user } = useAuth();
  const isSuperAdmin = profile.role === 'superadmin';
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [awards, setAwards] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const [achievements, earned] = await Promise.all([
      supabase.from('achievements').select('*').order('created_at', { ascending: false }),
      supabase.from('student_achievements').select('achievement_id, student_id, awarded_at').order('awarded_at', { ascending: false }),
    ]);
    if (achievements.error || earned.error) setError(achievements.error?.message || earned.error?.message);
    else { setItems(achievements.data); setAwards(earned.data); }
  }
  useEffect(() => { load(); if (isSuperAdmin) supabase.from('profiles').select('id,name').eq('role','student').order('name').then(({ data, error }) => { if (error) setError(error.message); else setStudents(data || []); }); }, [isSuperAdmin]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const payload = { title: form.title.trim(), description: form.description.trim(), icon: form.icon.trim() || '🌟' };
    const result = editId ? await supabase.from('achievements').update(payload).eq('id', editId) : await supabase.from('achievements').insert(payload);
    if (result.error) setError(result.error.message);
    else { setForm(emptyForm); setEditId(null); await load(); }
    setBusy(false);
  }
  async function remove(id) {
    if (!window.confirm('Delete this achievement and its student awards?')) return;
    const { error } = await supabase.from('achievements').delete().eq('id', id);
    if (error) setError(error.message); else await load();
  }
  async function toggleAward(id, awarded) {
    if (!studentId) return;
    const result = awarded ? await supabase.from('student_achievements').delete().eq('student_id', studentId).eq('achievement_id', id) : await supabase.from('student_achievements').insert({ student_id: studentId, achievement_id: id });
    if (result.error) setError(result.error.message); else await load();
  }
  const visible = isSuperAdmin ? items : items.filter(item => awards.some(a => a.achievement_id === item.id && a.student_id === user.id));
  const latest = visible.find(item => awards.some(a => a.achievement_id === item.id && (!isSuperAdmin || a.student_id === studentId)));
  return <div className="achievements-page">
    <section className="achievement-latest"><h3>Latest Achievement</h3><div>{latest ? <><span>{latest.icon}</span> {latest.title}</> : 'No achievement unlocked yet'}</div></section>
    {isSuperAdmin && <><form className="achievement-editor" onSubmit={submit}><h3>{editId ? 'Edit achievement' : 'Add achievement'}</h3><label>Title<input required maxLength="100" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Icon<input maxLength="8" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /></label><button className="button primary" disabled={busy}>{editId ? 'Save achievement' : 'Add achievement'}</button>{editId && <button type="button" className="button" onClick={() => { setEditId(null); setForm(emptyForm); }}>Cancel</button>}</form>
    <label className="award-select">Award achievements to student<select value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Select a student</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></>}
    <h3>{isSuperAdmin ? 'Achievements' : 'Your Achievements'}</h3>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="achievement-list">{visible.length === 0 && <p>No achievements yet.</p>}{visible.map(item => { const awarded = awards.some(a => a.achievement_id === item.id && a.student_id === studentId); return <article key={item.id} className="achievement-row"><span className="achievement-icon">{item.icon || '🌟'}</span><div><strong>{item.title}</strong><p>{item.description}</p></div>{isSuperAdmin && <div className="achievement-actions"><button onClick={() => { setEditId(item.id); setForm({ title: item.title, description: item.description || '', icon: item.icon || '🌟' }); }}>Edit</button><button onClick={() => remove(item.id)}>Delete</button><button disabled={!studentId} onClick={() => toggleAward(item.id, awarded)}>{awarded ? 'Revoke' : 'Award'}</button></div>}</article>; })}</div>
  </div>;
}
