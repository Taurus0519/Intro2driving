const PERSONAL_FIELDS = ['nickname', 'gender', 'date_of_birth', 'address', 'about', 'goals'];

export function getStaffProfileDetails(user) {
  const details = user?.user_metadata?.staff_profile;
  return Object.fromEntries(PERSONAL_FIELDS.map((field) => [
    field, typeof details?.[field] === 'string' ? details[field] : '',
  ]));
}

export async function saveStaffProfileDetails(client, { userId, profile, values }) {
  if (!userId || profile?.id !== userId || !['admin', 'superadmin'].includes(profile.role)) {
    throw new Error('Sign in to your administrator account to update your profile.');
  }

  // Keep personal details out of student records and never use them to assign roles.
  const details = Object.fromEntries(PERSONAL_FIELDS.map((field) => [
    field, typeof values[field] === 'string' ? values[field].trim() || null : null,
  ]));
  const { data, error } = await client.auth.updateUser({ data: { staff_profile: details } });
  if (error) throw new Error(error.message || 'Your profile details could not be saved.');
  if (data?.user?.id !== userId) {
    throw new Error('Your profile details could not be saved. Please sign in again.');
  }

  return getStaffProfileDetails(data.user);
}
