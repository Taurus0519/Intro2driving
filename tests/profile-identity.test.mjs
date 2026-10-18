import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { updateProfileIdentity } from '../src/js/profileIdentity.mjs';

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
