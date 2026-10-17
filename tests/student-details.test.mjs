import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentDetailsHandler } from '../api/student-details.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function setup({ role = 'admin', validToken = true, missingStudent = false, failedSection } = {}) {
  const calls = [];
  const rows = {
    profiles: missingStudent ? [] : [{ id: studentId, role: 'student', name: 'Test Student' }],
    student_profiles: [{ student_id: studentId, age: 20 }],
    game_scores: [{ player_id: studentId, level: 1, score: 8, max_score: 10 }, { player_id: otherId, score: 10, max_score: 10 }],
    quiz_attempts: [{ student_id: studentId, id: 'attempt', score: 7, total_questions: 10 }, { student_id: otherId, id: 'other' }],
    player_achievements: [{ user_id: studentId, achievement_id: 'award' }, { user_id: otherId, achievement_id: 'other' }],
    pdc_checklist_responses: [{ student_id: studentId, item_id: 'item', result: 'yes' }, { student_id: otherId, item_id: 'other' }],
  };
  const clientFactory = (_url, key, options) => {
    calls.push({ key });
    return {
      auth: { getUser: async () => ({ data: { user: validToken ? { id: 'caller', user_metadata: { role: 'superadmin' } } : null }, error: null }) },
      from(table) {
        const filters = [];
        const getResult = (single = false, from = 0, to = Infinity) => {
          if (options.global) return { data: { role }, error: null };
          if (failedSection === table) return { data: null, error: { message: 'Unavailable' } };
          const filtered = (rows[table] || []).filter((row) => filters.every(([column, value]) => row[column] === value)).slice(from, to + 1);
          return { data: single ? filtered[0] || null : filtered, error: null };
        };
        const query = {
          select() { return query; }, eq(column, value) { filters.push([column, value]); return query; },
          order() { return query; }, single: async () => getResult(true), maybeSingle: async () => getResult(true),
          range: async (from, to) => getResult(false, from, to),
        };
        return query;
      },
    };
  };
  const handler = createStudentDetailsHandler({ url: 'https://example.supabase.co', publishableKey: 'public', serviceRoleKey: 'server', clientFactory });
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const request = { method: 'GET', headers: { authorization: 'Bearer test-token' }, query: { studentId } };
  return { handler, request, response, calls };
}

test('student details reject missing or expired sessions', async () => {
  const missing = setup();
  missing.request.headers = {};
  await missing.handler(missing.request, missing.response);
  assert.equal(missing.response.statusCode, 401);
  assert.equal(missing.calls.length, 0);
  const expired = setup({ validToken: false });
  await expired.handler(expired.request, expired.response);
  assert.equal(expired.response.statusCode, 401);
  assert.ok(expired.calls.every((call) => call.key !== 'server'));
});

test('students cannot access another student by URL or user-editable role metadata', async () => {
  const { handler, request, response, calls } = setup({ role: 'student' });
  await handler(request, response);
  assert.equal(response.statusCode, 403);
  assert.ok(calls.every((call) => call.key !== 'server'));
});

test('both school administrator roles can load only the selected student records', async () => {
  for (const role of ['admin', 'superadmin']) {
    const { handler, request, response } = setup({ role });
    await handler(request, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.student.id, studentId);
    for (const name of ['gameScores', 'quizAttempts', 'achievements', 'pdcResponses']) assert.equal(response.body[name].length, 1);
    assert.equal(response.body.details.age, 20);
    assert.deepEqual(response.body.errors, {});
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
  }
});

test('missing students return a clear 404', async () => {
  const { handler, request, response } = setup({ missingStudent: true });
  await handler(request, response);
  assert.equal(response.statusCode, 404);
});

test('a missing optional data table leaves the rest of the profile available', async () => {
  const { handler, request, response } = setup({ failedSection: 'game_scores' });
  await handler(request, response);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.errors.gameScores);
  assert.deepEqual(response.body.gameScores, []);
  assert.equal(response.body.quizAttempts.length, 1);
});

test('invalid IDs and write requests are rejected before querying data', async () => {
  const invalid = setup();
  invalid.request.query.studentId = 'invalid';
  await invalid.handler(invalid.request, invalid.response);
  assert.equal(invalid.response.statusCode, 400);
  assert.equal(invalid.calls.length, 0);
  const write = setup();
  write.request.method = 'POST';
  await write.handler(write.request, write.response);
  assert.equal(write.response.statusCode, 405);
  assert.equal(write.response.headers.Allow, 'GET');
  assert.equal(write.calls.length, 0);
});
