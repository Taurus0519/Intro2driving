import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginSecurityHandler } from '../api/login-security.mjs';
import { hashSecret, verifySecret, tokenSessionId, verifiedPortalSession } from '../server/security.mjs';
import { IDLE_LOCK_MS, normalizeAnswer } from '../src/js/securityConfig.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const token = `header.${Buffer.from(JSON.stringify({ session_id: sessionId })).toString('base64url')}.signature`;
const pinHash = await hashSecret('123456');
const answerHash = await hashSecret('green valley');

function setup({ role = 'student', unlocked = false, configured = true, validToken = true, databaseDown = false, targetRole = 'student' } = {}) {
  const credentials = { user_id: userId, pin_hash: pinHash, answer_hash: answerHash, question_id: 'first-school' };
  const rows = {
    profiles: [{ id: userId, email: 'test@example.com', role, status: 'Active' }, { id: studentId, role: targetRole }],
    portal_pin_credentials: configured ? [credentials, { ...credentials, user_id: studentId }] : [],
    portal_verified_sessions: unlocked ? [{ user_id: userId, session_id: sessionId, last_activity_at: new Date().toISOString() }] : [],
    portal_login_attempts: [],
  };
  const attempts = new Map();
  let passwordCalls = 0;
  let unlocks = 0;
  const clientFactory = (_url, key) => key === 'publishable' ? {
    auth: {
      getUser: async () => ({ data: { user: validToken ? { id: userId, email: 'test@example.com' } : null }, error: null }),
      signInWithPassword: async ({ password }) => {
        passwordCalls++;
        return password === 'correct-password'
          ? { data: { user: { id: userId }, session: { access_token: token, refresh_token: 'refresh' } }, error: null }
          : { data: {}, error: { message: 'Incorrect password' } };
      },
      signOut: async () => ({ error: null }),
    },
  } : {
    from(table) {
      let filters = [];
      let operation = 'select';
      let values;
      const query = {
        select() { return query; }, eq(column, value) { filters.push([column, value]); return query; },
        delete() { operation = 'delete'; return query; }, insert(value) { operation = 'insert'; values = value; return query; },
        upsert(value) { operation = 'upsert'; values = value; return query; },
        update(value) { operation = 'update'; values = value; return query; },
        maybeSingle() { return execute(true); }, single() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      async function execute(single) {
        if (databaseDown) return { data: null, error: { message: 'Database unavailable' } };
        const matched = rows[table].filter((row) => filters.every(([column, value]) => row[column] === value));
        if (operation === 'insert') rows[table].push(values);
        if (operation === 'upsert') { rows[table] = rows[table].filter(row => row.session_id !== values.session_id); rows[table].push(values); }
        if (operation === 'update') matched.forEach((row) => Object.assign(row, values));
        if (operation === 'delete') {
          rows[table] = rows[table].filter((row) => !matched.includes(row));
          if (table === 'portal_login_attempts') for (const [column, value] of filters) if (column === 'key') attempts.delete(value);
        }
        return { data: single ? matched[0] || null : matched, error: null };
      }
      return query;
    },
    async rpc(name, values) {
      if (databaseDown) return { data: null, error: { message: 'Database unavailable' } };
      if (name === 'reserve_portal_attempt') {
        const used = attempts.get(values.attempt_key) || 0;
        if (used >= 3) return { data: { allowed: false, attempts_left: 0, retry_after: 900 }, error: null };
        attempts.set(values.attempt_key, used + 1);
        return { data: { allowed: true, attempts_left: 2 - used }, error: null };
      }
      if (name === 'unlock_portal_session') { unlocks++; return { error: null }; }
      if (name === 'replace_portal_pin') {
        const credential = rows.portal_pin_credentials.find((row) => row.user_id === values.target_user);
        assert.equal(credential.pin_hash, values.expected_pin_hash);
        credential.pin_hash = values.new_pin_hash;
        rows.portal_verified_sessions = rows.portal_verified_sessions.filter((row) => row.user_id !== values.target_user);
        return { error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const handler = createLoginSecurityHandler({ url: 'https://example.supabase.co', publishableKey: 'publishable', serviceRoleKey: 'service', clientFactory });
  async function request(body, { authenticated = true, method = 'POST' } = {}) {
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method, headers: authenticated ? { authorization: `Bearer ${token}` } : {}, body }, response);
    return response;
  }
  return { request, rows, get passwordCalls() { return passwordCalls; }, get unlocks() { return unlocks; } };
}

test('PIN and answer hashes are salted and verify without returning plaintext', async () => {
  assert.notEqual(pinHash, await hashSecret('123456'));
  assert.equal(await verifySecret('123456', pinHash), true);
  assert.equal(await verifySecret('000000', pinHash), false);
  assert.equal(await verifySecret('123456', 'bad hash'), false);
  assert.equal(normalizeAnswer('  GREEN  Valley '), 'green valley');
});

test('three failed passwords lock further attempts before reaching the auth provider', async () => {
  const app = setup();
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await app.request({ action: 'sign-in', email: 'TEST@example.com', password: 'wrong' }, { authenticated: false });
    assert.equal(result.body.attemptsRemaining, 2 - attempt);
  }
  const blocked = await app.request({ action: 'sign-in', email: 'test@example.com', password: 'correct-password' });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '900');
  assert.equal(app.passwordCalls, 3);
});

test('a correct password clears the attempt count but does not unlock portal data', async () => {
  const app = setup();
  await app.request({ action: 'sign-in', email: 'test@example.com', password: 'wrong' });
  const login = await app.request({ action: 'sign-in', email: 'test@example.com', password: 'correct-password' });
  assert.equal(login.statusCode, 200);
  assert.ok(login.body.session);
  assert.equal(app.unlocks, 0);
  const status = await app.request({ action: 'status' });
  assert.equal(status.body.pinRequired, true);
  assert.equal(status.body.profile, undefined);
});

test('student PINs are required and verified on the server', async () => {
  for (const role of ['student']) {
    const app = setup({ role });
    assert.equal((await app.request({ action: 'status' })).body.pinRequired, true);
    const wrong = await app.request({ action: 'verify-pin', pin: '000000' });
    assert.equal(wrong.body.attemptsRemaining, 2);
    assert.equal(app.unlocks, 0);
    const correct = await app.request({ action: 'verify-pin', pin: '123456' });
    assert.equal(correct.body.pinRequired, false);
    assert.equal(correct.body.profile.role, role);
    assert.equal(app.unlocks, 1);
    assert.doesNotMatch(JSON.stringify(correct.body), /pin_hash|answer_hash|scrypt:/);
  }
});

test('staff sign in and unlock with passwords rather than student PINs', async () => {
  for (const role of ['admin','superadmin']) {
    const app=setup({role,configured:false});
    const login=await app.request({action:'sign-in',email:'test@example.com',password:'correct-password'});
    assert.equal(login.statusCode,200);
    assert.equal((await app.request({action:'status'})).body.pinRequired,false);
    const lock=await app.request({action:'lock'});
    assert.equal(lock.body.passwordRequired,true);
    assert.equal((await app.request({action:'verify-pin',pin:'123456'})).statusCode,400);
    const result=await app.request({action:'verify-password',password:'correct-password'});
    assert.equal(result.statusCode,200);
    assert.equal(result.body.pinRequired,false);
  }
});

test('PIN enrollment hashes secrets, validates question and cannot overwrite an existing PIN', async () => {
  const app = setup({ configured: false });
  assert.equal((await app.request({ action: 'status' })).body.needsSetup, true);
  const setupResult = await app.request({ action: 'setup-pin', pin: '654321', questionId: 'first-school', answer: ' Green Valley ' });
  assert.equal(setupResult.statusCode, 200);
  assert.equal(app.rows.portal_pin_credentials.length, 1);
  assert.equal(await verifySecret('654321', app.rows.portal_pin_credentials[0].pin_hash), true);
  assert.equal(await verifySecret('green valley', app.rows.portal_pin_credentials[0].answer_hash), true);
  assert.equal((await app.request({ action: 'setup-pin', pin: '000000' })).statusCode, 409);
});

test('PIN recovery requires a correct password and security answer and locks old sessions', async () => {
  const app = setup({ unlocked: true });
  const input = { action: 'reset-pin', pin: '654321', answer: 'green valley', password: 'wrong' };
  assert.notEqual((await app.request(input)).statusCode, 200);
  assert.equal(app.rows.portal_pin_credentials[0].pin_hash, pinHash);
  input.password = 'correct-password'; input.answer = 'wrong answer';
  assert.notEqual((await app.request(input)).statusCode, 200);
  assert.equal(app.rows.portal_pin_credentials[0].pin_hash, pinHash);
  input.answer = ' GREEN   VALLEY ';
  const reset = await app.request(input);
  assert.equal(reset.statusCode, 200);
  assert.equal(reset.body.pinRequired, true);
  assert.equal(app.rows.portal_verified_sessions.length, 0);
  assert.equal(await verifySecret('654321', app.rows.portal_pin_credentials[0].pin_hash), true);
});

test('admin-assisted reset verifies both admin password and student answer', async () => {
  const app = setup({ role: 'admin', unlocked: true });
  app.rows.portal_verified_sessions.push({ user_id: studentId, session_id: 'other', last_activity_at: new Date().toISOString() });
  const reset = await app.request({ action: 'admin-reset-pin', studentId, pin: '654321', answer: 'Green Valley', password: 'correct-password' });
  assert.equal(reset.statusCode, 200);
  assert.equal(app.rows.portal_verified_sessions.length, 1);
  assert.equal(app.rows.portal_verified_sessions[0].user_id, userId);
  assert.equal(await verifySecret('654321', app.rows.portal_pin_credentials[1].pin_hash), true);
  for (const options of [{ role: 'student', unlocked: true }, { role: 'admin', unlocked: false }, { role: 'admin', unlocked: true, targetRole: 'superadmin' }]) {
    const denied = setup(options);
    assert.equal((await denied.request({ action: 'admin-reset-pin', studentId, pin: '654321', answer: 'Green Valley', password: 'correct-password' })).statusCode, 403);
  }
});

test('locking deletes verification and status never exposes security hashes', async () => {
  const app = setup({ unlocked: true });
  const unlocked = await app.request({ action: 'status' });
  assert.equal(unlocked.body.pinRequired, false);
  const locked = await app.request({ action: 'lock' });
  assert.equal(locked.body.pinRequired, true);
  assert.equal(app.rows.portal_verified_sessions.length, 0);
  assert.doesNotMatch(JSON.stringify(locked.body), /pin_hash|answer_hash|scrypt:/);
});

test('missing authentication, expired sessions and unavailable controls fail closed', async () => {
  assert.equal((await setup().request({ action: 'status' }, { authenticated: false })).statusCode, 401);
  assert.equal((await setup({ validToken: false }).request({ action: 'status' })).statusCode, 401);
  const app = setup({ databaseDown: true });
  assert.equal((await app.request({ action: 'sign-in', email: 'test@example.com', password: 'correct-password' })).statusCode, 503);
  assert.equal(app.passwordCalls, 0);
  assert.equal((await setup().request({}, { method: 'GET' })).statusCode, 405);
});

test('session checks expire at exactly five minutes and reject malformed session IDs', async () => {
  assert.equal(tokenSessionId('invalid'), null);
  assert.equal(tokenSessionId(token), sessionId);
  const now = Date.now();
  const client = (activity, status = 'Active') => ({ from: (table) => {
    const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: table === 'profiles' ? {role: 'student', status} : { last_activity_at: new Date(activity).toISOString() }, error: null }) };
    return query;
  } });
  assert.equal(await verifiedPortalSession(client(now - IDLE_LOCK_MS + 1), userId, token, now), true);
  assert.equal(await verifiedPortalSession(client(now - IDLE_LOCK_MS), userId, token, now), false);
  assert.equal(await verifiedPortalSession(client(now - IDLE_LOCK_MS - 1), userId, token, now), false);
  assert.equal(await verifiedPortalSession(client(now, 'Inactive'), userId, token, now), false);
});
