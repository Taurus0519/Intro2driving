export function splitProfileName(name, savedParts) {
  if (typeof savedParts?.firstName === 'string' && typeof savedParts?.lastName === 'string') {
    const firstName = savedParts.firstName.trim();
    const lastName = savedParts.lastName.trim();
    if (`${firstName} ${lastName}` === name?.trim()) return { firstName, lastName };
  }
  const parts = typeof name === 'string' ? name.trim().split(/\s+/).filter(Boolean) : [];
  const lastName = parts.length > 1 ? parts.pop() : '';
  return { firstName: parts.join(' '), lastName };
}

export function getProfileDisplayName(profile, fallback) {
  return profile?.username || profile?.name?.trim().split(/\s+/)[0] || fallback;
}

export async function saveProfileNameParts(client, { user, profile, values }) {
  if (!user?.id || profile?.id !== user.id) throw new Error('Sign in again to update your profile.');
  const firstName = typeof values.firstName === 'string' ? values.firstName.trim() : '';
  const lastName = typeof values.lastName === 'string' ? values.lastName.trim() : '';
  if (!firstName) throw new Error('First name is required.');
  if (!lastName) throw new Error('Last name is required.');
  const saved = user.user_metadata?.profile_name;
  if (saved?.firstName === firstName && saved?.lastName === lastName) return;

  const { data, error } = await client.auth.updateUser({ data: { profile_name: { firstName, lastName } } });
  if (error) throw new Error(error.message || 'Your first and last names could not be saved.');
  if (data?.user?.id !== user.id) throw new Error('Your first and last names could not be saved. Please sign in again.');
}

export async function updateProfileIdentity(client, { userId, profile, values }) {
  if (!userId || profile?.id !== userId) {
    throw new Error('Sign in again to update your profile.');
  }

  const separateNames = 'firstName' in values || 'lastName' in values;
  let name;
  if (separateNames) {
    const firstName = typeof values.firstName === 'string' ? values.firstName.trim() : '';
    const lastName = typeof values.lastName === 'string' ? values.lastName.trim() : '';
    if (!firstName) throw new Error('First name is required.');
    if (!lastName) throw new Error('Last name is required.');
    name = `${firstName} ${lastName}`;
  } else {
    name = typeof values.name === 'string' ? values.name.trim() : '';
  }
  const username = typeof values.username === 'string' ? values.username.trim() : '';
  if (!name) throw new Error('Full name is required.');
  if (!username) throw new Error('Username is required.');

  const changes = {};
  if (name !== (profile.name || '')) changes.name = name;
  if (username !== (profile.username || '')) changes.username = username;
  if (!Object.keys(changes).length) return { name, username };

  const { data, error } = await client
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select('id, name, username')
    .single();

  if (error) {
    if (error.code === '23505' && changes.username) {
      throw new Error('That username is already in use. Choose a different username.');
    }
    throw new Error(error.message || 'Your name and username could not be saved.');
  }
  if (!data || data.id !== userId) {
    throw new Error('Your profile could not be updated. Please sign in again.');
  }
  return { name: data.name, username: data.username };
}
