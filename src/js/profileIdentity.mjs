export async function updateProfileIdentity(client, { userId, profile, values }) {
  if (!userId || profile?.id !== userId) {
    throw new Error('Sign in again to update your profile.');
  }

  const name = typeof values.name === 'string' ? values.name.trim() : '';
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
