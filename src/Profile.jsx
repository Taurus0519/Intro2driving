import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth';
import './Profile.css';

const fields = ['nickname', 'age', 'gender', 'date_of_birth', 'address'];
const labels = {
  nickname: 'Nickname',
  age: 'Age',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  address: 'Address'
};

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('Info');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    if (!user?.id) return;

    supabase
      .from('student_profiles')
      .select('*')
      .eq('student_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setMessage(error.message);
          setDetails({});
          return;
        }

        setDetails(data || {});
        setForm({
          name: profile.name || '',
          nickname: data?.nickname || '',
          age: data?.age ?? '',
          gender: data?.gender || '',
          date_of_birth: data?.date_of_birth || '',
          address: data?.address || '',
          about: data?.about || '',
          goals: data?.goals || ''
        });
      });

    return () => { active = false; };
  }, [user?.id, profile?.name]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const name = form.name?.trim();
    if (!name) {
      setMessage('Name is required.');
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', user.id);

    if (profileError) {
      setMessage(profileError.message);
      setSaving(false);
      return;
    }

    const payload = {
      student_id: user.id,
      nickname: form.nickname || null,
      age: form.age === '' ? null : Number(form.age),
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address || null,
      about: form.about || null,
      goals: form.goals || null
    };

    const { data, error } = await supabase
      .from('student_profiles')
      .upsert(payload, { onConflict: 'student_id' })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setDetails(data);
    setEditing(false);
    setMessage('Profile saved.');
    await refreshProfile();
    setSaving(false);
  }

  if (!details && user?.id) return <p>Loading profile...</p>;

  let content;

  if (editing) {
    content = (
      <form onSubmit={save} className="profile-form">
        {tab === 'Info' && (
          <>
            <label>
              <span>Full name</span>
              <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>

            <label>
              <span>Email</span>
              <input value={user.email || ''} disabled />
            </label>

            {fields.map((key) => {
              let inputType = 'text';
              if (key === 'date_of_birth') inputType = 'date';
              if (key === 'age') inputType = 'number';

              return (
                <label key={key}>
                  {labels[key]}
                  <input
                    type={inputType}
                    min={key === 'age' ? '0' : undefined}
                    value={form[key] ?? ''}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              );
            })}
          </>
        )}

        {tab !== 'Info' && (
          <label>
            {tab}
            <textarea
              rows="6"
              value={form[tab.toLowerCase()] || ''}
              onChange={e => setForm({ ...form, [tab.toLowerCase()]: e.target.value })}
            />
          </label>
        )}

        <button type="submit" className="button primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    );
  } else if (tab === 'Info') {
    content = (
      <dl className="profile-info">
        {[
          ['Nickname', details?.nickname],
          ['Email', user.email],
          ['Age', details?.age],
          ['Gender', details?.gender],
          ['Date of birth', details?.date_of_birth],
          ['Address', details?.address]
        ].map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    );
  } else {
    content = (
      <p className="profile-text">
        {details?.[tab.toLowerCase()] || 'Nothing added yet. Select Edit to add information.'}
      </p>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-banner">
        <div className="profile-avatar">{profile.name?.charAt(0)?.toUpperCase() || '?'}</div>
        <div>
          <h2>{profile.name}</h2>
          <span className="profile-badge">Student</span>
        </div>
        <button type="button" className="button profile-edit" onClick={() => { setEditing(!editing); setMessage(''); }}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="profile-body">
        <div className="profile-main">
          <div className="profile-tabs">
            {['Info', 'About', 'Goals'].map(item => (
              <button
                key={item}
                type="button"
                className={tab === item ? 'active' : ''}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <h3>{tab}</h3>

          {content}

          {message && (
            <output className={message === 'Profile saved.' ? 'success' : 'error'}>
              {message}
            </output>
          )}
        </div>

        <aside className="account-card">
          <strong>Account</strong>
          <p>
            Enrolled
            <br />
            <small>{details?.created_at ? new Date(details.created_at).toLocaleDateString() : '—'}</small>
          </p>
          <p>
            Role
            <br />
            <small>Student</small>
          </p>
        </aside>
      </div>
    </div>
  );
}
