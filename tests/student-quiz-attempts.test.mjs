import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentQuizAttemptsHandler } from '../api/student-quiz-attempts.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function setup({ role = 'student', validToken = true, unlocked = true } = {}) {
  const attempts = [
    { student_id: studentId, score: 10, total_questions: 10, chapter_number: 1 },
    { student_id: otherId, score: 4, total_questions: 10, chapter_number: 2 },
  ];
  const clientFactory = (_url, key) => {
    if (key === 'publishable') {
      return {
        auth: {
          getUser: async () => ({
            data: { user: validToken ? { id: studentId } : null },
            error: validToken ? null : { message: 'Invalid token' },
          }),
        },
      };
    }
    return {
      from(table) {
        const filters = [];
        let columns = [];
        const query = {
          select(value) { columns = value.split(', '); return query; },
          eq(column, value) { filters.push([column, value]); return query; },
          order() { return query; },
          maybeSingle: async () => ({ data: { role }, error: null }),
          range: async (from, to) => ({
            data: attempts
              .filter((attempt) => filters.every(([column, value]) => attempt[column] === value))
              .slice(from, to + 1)
              .map((attempt) => Object.fromEntries(columns.map((column) => [column, attempt[column]]))),
            error: null,
          }),
        };
        assert.ok(['profiles', 'quiz_attempts'].includes(table));
        return query;
      },
    };
  };
  const handler = createStudentQuizAttemptsHandler({
    url: 'https://example.supabase.co',
    publishableKey: 'publishable',
    serviceRoleKey: 'server-only',
    clientFactory,
    sessionVerifier: async () => unlocked,
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const request = { method: 'GET', headers: { authorization: 'Bearer token' } };
  return { handler, request, response };
}

test('student quiz results return only the authenticated student’s attempts', async () => {
  const { handler, request, response } = setup();
  await handler(request, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.attempts, [{ score: 10, total_questions: 10, chapter_number: 1 }]);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.equal(response.headers.Vary, 'Authorization');
});

test('student quiz results require a valid signed-in student session', async () => {
  const missing = setup();
  missing.request.headers = {};
  await missing.handler(missing.request, missing.response);
  assert.equal(missing.response.statusCode, 401);

  const expired = setup({ validToken: false });
  await expired.handler(expired.request, expired.response);
  assert.equal(expired.response.statusCode, 401);

  const admin = setup({ role: 'admin' });
  await admin.handler(admin.request, admin.response);
  assert.equal(admin.response.statusCode, 403);
});

test('student quiz results reject writes', async () => {
  const { handler, request, response } = setup();
  request.method = 'POST';
  await handler(request, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET');
});

test('locked student sessions cannot read quiz results', async () => {
  const { handler, request, response } = setup({ unlocked: false });
  await handler(request, response);
  assert.equal(response.statusCode, 423);
  assert.equal(response.body.pinRequired, true);
});
