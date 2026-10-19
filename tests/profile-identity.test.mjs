import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getProfileDisplayName, saveProfileNameParts, splitProfileName, updateProfileIdentity } from '../src/js/profileIdentity.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const profile = { id: userId, name: 'Kenjih', username: 'Student', role: 'student' };

function setup({ error, status = 200, returnedId = userId, storedProfile = profile } = {}) {
  const requests = [];
  const client = createClient('https://example.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, options) => {
        const body = JSON.parse(options.body);
        requests.push({ url: new URL(input), method: options.method, body });
        const result = error || { id: returnedId, name: storedProfile.name, username: storedProfile.username, ...body };
        return new Response(JSON.stringify(result), {
          status, headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  const save = (values, overrides = {}) => updateProfileIdentity(client, {
    userId, profile, values: { name: profile.name, username: profile.username, ...values }, ...overrides,
  });
  return { save, requests };
}

test('editing a full name does not send or overwrite the username', async () => {
  const { save, requests } = setup();
  const result = await save({ name: '  Kenjih Reyes  ' });
  assert.deepEqual(result, { name: 'Kenjih Reyes', username: 'Student' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'PATCH');
  assert.equal(requests[0].url.pathname, '/rest/v1/profiles');
  assert.equal(requests[0].url.searchParams.get('id'), `eq.${userId}`);
  assert.deepEqual(requests[0].body, { name: 'Kenjih Reyes' });
});

test('first and last name edits update the combined name without rewriting the username', async () => {
  const { save, requests } = setup();
  await save({ firstName: '  Maria Isabel ', lastName: ' de la Cruz  ' });
  assert.deepEqual(requests[0].body, { name: 'Maria Isabel de la Cruz' });
  await assert.rejects(save({ firstName: '', lastName: 'Reyes' }), /First name is required/);
  await assert.rejects(save({ firstName: 'Maria', lastName: ' ' }), /Last name is required/);
  assert.equal(requests.length, 1);
});

test('existing names are prefilled without losing words and saved compound names retain their boundaries', () => {
  assert.deepEqual(splitProfileName('  Juan Carlos Reyes  '), { firstName: 'Juan Carlos', lastName: 'Reyes' });
  assert.deepEqual(splitProfileName('Kenjih'), { firstName: 'Kenjih', lastName: '' });
  assert.deepEqual(splitProfileName(null), { firstName: '', lastName: '' });
  const saved = { firstName: 'Maria Isabel', lastName: 'de la Cruz' };
  assert.deepEqual(splitProfileName('Maria Isabel de la Cruz', saved), saved);
  assert.deepEqual(splitProfileName('Alex Reyes', saved), { firstName: 'Alex', lastName: 'Reyes' });
});

test('name parts are saved only as personal metadata for the signed-in account', async () => {
  const calls = [];
  const user = { id: userId, user_metadata: {} };
  const client = { auth: { async updateUser(payload) {
    calls.push(payload);
    return { data: { user: { ...user, user_metadata: payload.data } }, error: null };
  } } };
  const values = { firstName: ' Maria Isabel ', lastName: ' de la Cruz ', role: 'superadmin', student_id: 'other' };
  await saveProfileNameParts(client, { user, profile, values });
  assert.deepEqual(calls, [{ data: { profile_name: { firstName: 'Maria Isabel', lastName: 'de la Cruz' } } }]);
  await assert.rejects(saveProfileNameParts(client, { user: { id: 'other' }, profile, values }), /Sign in again/);
  assert.equal(calls.length, 1);
  user.user_metadata = calls[0].data;
  await saveProfileNameParts(client, { user, profile, values });
  assert.equal(calls.length, 1, 'Unchanged name parts do not trigger another auth update');
});

test('failed name-part saves cannot be reported as successful', async () => {
  const options = { user: { id: userId }, profile, values: { firstName: 'Maria', lastName: 'Reyes' } };
  await assert.rejects(saveProfileNameParts({ auth: { updateUser: async () => ({ error: { message: 'Session expired' } }) } }, options), /Session expired/);
  await assert.rejects(saveProfileNameParts({ auth: { updateUser: async () => ({ data: { user: { id: 'other' } } }) } }, options), /sign in again/);
});

test('student, admin, and super admin dashboard greetings prefer usernames over personal names', () => {
  for (const role of ['student', 'admin', 'superadmin']) {
    assert.equal(getProfileDisplayName({ role, name: 'Maria Reyes', username: 'maria_driver' }, 'Account'), 'maria_driver');
  }
  assert.equal(getProfileDisplayName({ name: 'Maria Reyes' }, 'Admin'), 'Maria');
  assert.equal(getProfileDisplayName(null, 'Admin'), 'Admin');
});

test('editing a username does not send or overwrite the full name', async () => {
  const { save, requests } = setup();
  const result = await save({ username: '  kenjih_driver  ' });
  assert.deepEqual(result, { name: 'Kenjih', username: 'kenjih_driver' });
  assert.deepEqual(requests[0].body, { username: 'kenjih_driver' });
});

test('a name-only edit preserves a username changed elsewhere after editing began', async () => {
  const { save, requests } = setup({ storedProfile: { ...profile, username: 'changed_elsewhere' } });
  const result = await save({ name: 'Kenjih Reyes' });
  assert.deepEqual(requests[0].body, { name: 'Kenjih Reyes' });
  assert.equal(result.username, 'changed_elsewhere');
});

test('both fields can change together without allowing other account fields into the update', async () => {
  const { save, requests } = setup();
  await save({ name: 'Kenjih Reyes', username: 'kenjih_driver', role: 'superadmin', email: 'other@example.com', id: 'other-user' });
  assert.deepEqual(requests[0].body, { name: 'Kenjih Reyes', username: 'kenjih_driver' });
  assert.equal(requests[0].url.searchParams.get('id'), `eq.${userId}`);
});

test('editing other profile details does not rewrite either identity field', async () => {
  const { save, requests } = setup();
  assert.deepEqual(await save({ address: 'Caloocan' }), { name: 'Kenjih', username: 'Student' });
  assert.equal(requests.length, 0);
});

test('administrator identity edits target only their own account and preserve account roles', async () => {
  for (const role of ['admin', 'superadmin']) {
    const ownProfile = { ...profile, role };
    const { save, requests } = setup({ storedProfile: ownProfile });
    await save({ name: 'Updated Admin', role: 'student' }, { profile: ownProfile });
    assert.deepEqual(requests[0].body, { name: 'Updated Admin' });
    assert.equal(requests[0].url.searchParams.get('id'), `eq.${userId}`);
  }
});

test('blank names and usernames are rejected before writing', async () => {
  const { save, requests } = setup();
  await assert.rejects(save({ name: '  ' }), /Full name is required/);
  await assert.rejects(save({ username: '  ' }), /Username is required/);
  assert.equal(requests.length, 0);
});

test('a profile belonging to another user cannot be used as the update target', async () => {
  const { save, requests } = setup();
  await assert.rejects(save({ name: 'Changed' }, { userId: 'other-user' }), /Sign in again/);
  assert.equal(requests.length, 0);
});

test('database username conflicts return a clear error instead of reporting success', async () => {
  const { save } = setup({ error: { code: '23505', message: 'duplicate key value violates unique constraint' }, status: 409 });
  await assert.rejects(save({ username: 'taken' }), /username is already in use/);
});

test('an update blocked by database permissions is not reported as saved', async () => {
  const { save } = setup({ error: { code: 'PGRST116', message: 'The result contains 0 rows' }, status: 406 });
  await assert.rejects(save({ name: 'Changed' }), /0 rows/);
});

test('an unexpected returned account is not accepted as a successful update', async () => {
  const { save } = setup({ returnedId: 'other-user' });
  await assert.rejects(save({ name: 'Changed' }), /profile could not be updated/);
});
