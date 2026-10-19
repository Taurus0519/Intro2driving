import test from 'node:test';
import assert from 'node:assert/strict';
import { getStaffProfileDetails, saveStaffProfileDetails } from '../src/js/staffProfile.mjs';

const userId = '11111111-1111-4111-8111-111111111111';

function setup({ role = 'admin', error, returnedId = userId } = {}) {
  const calls = [];
  const profile = { id: userId, role };
  const client = {
    from() { throw new Error('Staff details must never be written to student tables.'); },
    auth: {
      async updateUser(payload) {
        calls.push(payload);
        return { data: { user: { id: returnedId, user_metadata: payload.data } }, error };
      },
    },
  };
  const save = (values = {}, overrides = {}) => saveStaffProfileDetails(client, {
    userId, profile, values, ...overrides,
  });
  return { save, calls };
}

test('both administrator roles save personal details outside student records', async () => {
  for (const role of ['admin', 'superadmin']) {
    const { save, calls } = setup({ role });
    const values = {
      nickname: '  Alex  ', gender: 'Female', date_of_birth: '1990-06-15',
      address: 'Caloocan', about: 'Driving instructor', goals: 'Help students drive safely',
    };
    const details = await save(values);
    assert.deepEqual(details, { ...values, nickname: 'Alex' });
    assert.deepEqual(calls, [{ data: { staff_profile: details } }]);
    assert.equal(getStaffProfileDetails({ user_metadata: calls[0].data }).date_of_birth, '1990-06-15');
  }
});

test('profile edits cannot assign roles, change account identities, or send student identifiers', async () => {
  const { save, calls } = setup();
  await save({
    nickname: 'Alex', role: 'superadmin', id: 'another-user', student_id: 'another-student',
    age: 20, name: 'Other person', username: 'other', email: 'other@example.com',
    app_metadata: { role: 'superadmin' },
  });
  assert.deepEqual(calls[0], { data: { staff_profile: {
    nickname: 'Alex', gender: null, date_of_birth: null, address: null, about: null, goals: null,
  } } });
});

test('students, missing sessions, and mismatched account targets are rejected before saving', async () => {
  const student = setup({ role: 'student' });
  await assert.rejects(student.save({ nickname: 'Student' }), /administrator account/);
  assert.equal(student.calls.length, 0);
  const staff = setup();
  await assert.rejects(staff.save({}, { userId: null }), /administrator account/);
  await assert.rejects(staff.save({}, { userId: 'another-user' }), /administrator account/);
  assert.equal(staff.calls.length, 0);
});

test('blank personal fields can be cleared and malformed stored values do not become form values', async () => {
  const { save, calls } = setup();
  const details = await save({ nickname: '  ', date_of_birth: '', address: null });
  assert.equal(calls[0].data.staff_profile.nickname, null);
  assert.equal(calls[0].data.staff_profile.date_of_birth, null);
  assert.deepEqual(details, getStaffProfileDetails(null));
  assert.deepEqual(getStaffProfileDetails({ user_metadata: { staff_profile: {
    nickname: { unexpected: true }, date_of_birth: 123, role: 'superadmin', address: 'Caloocan',
  } } }), { nickname: '', gender: '', date_of_birth: '', address: 'Caloocan', about: '', goals: '' });
});

test('failed saves and responses for another account are not reported as successful', async () => {
  const failed = setup({ error: { message: 'Your session has expired.' } });
  await assert.rejects(failed.save({ address: 'Caloocan' }), /session has expired/);
  const wrongAccount = setup({ returnedId: 'another-user' });
  await assert.rejects(wrongAccount.save({ address: 'Caloocan' }), /sign in again/);
});
