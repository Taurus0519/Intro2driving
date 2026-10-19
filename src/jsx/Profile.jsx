import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth';
import { saveProfileNameParts, splitProfileName, updateProfileIdentity } from '../js/profileIdentity.mjs';
import { getStaffProfileDetails, saveStaffProfileDetails } from '../js/staffProfile.mjs';
import '../css/Profile.css';

const fields = ['nickname', 'gender', 'date_of_birth', 'address'];
const labels = {
  nickname: 'Nickname',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  address: 'Address'
};

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() + 1 !== month ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getTodayDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'superadmin';
  const roleLabel = profile?.role === 'superadmin' ? 'Super Admin' : isStaff ? 'Admin' : 'Student';
  const staffDetails = user?.user_metadata?.staff_profile;
  const nameParts = splitProfileName(profile?.name, user?.user_metadata?.profile_name);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({});
  const [originalIdentity, setOriginalIdentity] = useState(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('Info');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    if (!user?.id) return;

    if (isStaff) {
      setDetails(getStaffProfileDetails(user));
      return;
    }

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
      });

    return () => { active = false; };
  }, [user?.id, isStaff, staffDetails]);

  function toggleEditing() {
    if (saving) return;
    setOriginalIdentity({ id: profile.id, name: profile.name, username: profile.username });
    setForm({
      ...nameParts,
      username: profile.username || '',
      nickname: details?.nickname || '',
      gender: details?.gender || '',
      date_of_birth: details?.date_of_birth || '',
      address: details?.address || '',
      about: details?.about || '',
      goals: details?.goals || '',
    });
    setEditing(!editing);
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');

    let identitySaved = false;
    try {
      await updateProfileIdentity(supabase, { userId: user?.id, profile: originalIdentity, values: form });
      identitySaved = true;
      await saveProfileNameParts(supabase, { user, profile: originalIdentity, values: form });

      if (isStaff) {
        const data = await saveStaffProfileDetails(supabase, { userId: user.id, profile, values: form });
        setDetails(data);
      } else {
        const payload = {
          student_id: user.id,
          nickname: form.nickname || null,
          age: getAge(form.date_of_birth),
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

        if (error) throw error;
        setDetails(data);
      }
      setEditing(false);
      setMessage('Profile saved.');
    } catch (error) {
      const prefix = identitySaved ? 'Name and username saved, but the other profile details could not be saved. ' : '';
      setMessage(prefix + (error.message || 'Please try again.'));
    } finally {
      if (identitySaved) await refreshProfile();
      setSaving(false);
    }
  }

  if (!details && user?.id) return <p>Loading profile...</p>;

  let content;

  if (editing) {
    content = (
      <form onSubmit={save} className="profile-form">
        {tab === 'Info' && (
          <>
            <label>
              <span>First Name</span>
              <input name="firstName" autoComplete="given-name" value={form.firstName || ''} onChange={e => setForm({ ...form, firstName: e.target.value })} disabled={saving} required />
            </label>

            <label>
              <span>Last Name</span>
              <input name="lastName" autoComplete="family-name" value={form.lastName || ''} onChange={e => setForm({ ...form, lastName: e.target.value })} disabled={saving} required />
            </label>

            <label>
              <span>Username</span>
              <input name="username" autoComplete="username" value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} disabled={saving} aria-describedby="profile-username-help" required />
              <small id="profile-username-help">Your username is separate from your full name.</small>
            </label>

            <label>
              <span>Email</span>
              <input value={user.email || ''} disabled />
            </label>

            <label>
              <span>Age</span>
              <input value={getAge(form.date_of_birth) ?? '—'} readOnly />
            </label>

            {fields.map((key) => {
              const inputType = key === 'date_of_birth' ? 'date' : 'text';

              return (
                <label key={key}>
                  {labels[key]}
                  <input
                    name={key}
                    type={inputType}
                    disabled={saving}
                    max={key === 'date_of_birth' ? getTodayDate() : undefined}
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
              name={tab.toLowerCase()}
              rows="6"
              disabled={saving}
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
          ['First Name', nameParts.firstName],
          ['Last Name', nameParts.lastName],
          ['Username', profile.username],
          ['Nickname', details?.nickname],
          ['Email', user.email],
          ['Age', getAge(details?.date_of_birth)],
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
          <span className="profile-badge">{roleLabel}</span>
        </div>
        <button type="button" className="button profile-edit" onClick={toggleEditing} disabled={saving || !details}>
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
                disabled={saving}
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
            {isStaff ? 'Joined' : 'Enrolled'}
            <br />
            <small>{(isStaff ? user.created_at : details?.created_at)
              ? new Date(isStaff ? user.created_at : details.created_at).toLocaleDateString()
              : '—'}</small>
          </p>
          <p>
            Role
            <br />
            <small>{roleLabel}</small>
          </p>
        </aside>
      </div>
    </div>
  );
}
