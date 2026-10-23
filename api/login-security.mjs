import { createClient } from '@supabase/supabase-js';
import { SECURITY_QUESTIONS, normalizeAnswer, validPin } from '../src/js/securityConfig.mjs';
import { hashSecret, verifySecret, reserveAttempt, clearAttempts, attemptKey, tokenSessionId, verifiedPortalSession } from '../server/security.mjs';

export function createLoginSecurityHandler({
  url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientFactory = createClient,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Authorization');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
    if (!url || !publishableKey || !serviceRoleKey) return res.status(503).json({ error: 'Portal security is not configured. Contact the school administrator.' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'A JSON object is required.' });
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const auth = clientFactory(url, publishableKey, options);
    const admin = clientFactory(url, serviceRoleKey, options);
    const failAttempt = (attempt, message) => res.status(attempt.attempts_left === 0 ? 429 : 400).json({
      error: attempt.attempts_left === 0 ? 'Three unsuccessful attempts. Try again in 15 minutes.' : `${message} ${attempt.attempts_left} attempt(s) remaining.`,
      attemptsRemaining: attempt.attempts_left,
    });
    const reserve = async (kind, id) => {
      const attempt = await reserveAttempt(admin, kind, id);
      if (!attempt.allowed) {
        res.setHeader('Retry-After', String(attempt.retry_after || 900));
        res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.', attemptsRemaining: 0 });
        return null;
      }
      return attempt;
    };
    try {
      if (body.action === 'sign-in') {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!email || email.length > 254 || typeof body.password !== 'string' || !body.password || body.password.length > 1024) {
          return res.status(400).json({ error: 'Enter your email and password.' });
        }
        const attempt = await reserve('password', email);
        if (!attempt) return;
        const { data, error } = await auth.auth.signInWithPassword({ email, password: body.password });
        if (error || !data?.session) return failAttempt(attempt, 'Incorrect email or password.');
        await clearAttempts(admin, attempt.key);
        // The session cannot read portal data until its PIN has been verified.
        return res.status(200).json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
      }

      const token = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) return res.status(401).json({ error: 'Sign in before continuing.' });
      const { data: { user }, error: authError } = await auth.auth.getUser(token);
      const sessionId = tokenSessionId(token);
      if (authError || !user || !sessionId) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
      const { data: profile, error: profileError } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profileError) throw new Error('Your account profile could not be loaded.');
      if (!profile || !['student', 'admin', 'superadmin'].includes(profile.role) || profile.status === 'Inactive') {
        return res.status(403).json({ error: 'This account cannot access the portal. Contact the school administrator.' });
      }
      const { data: security, error: securityError } = await admin.from('portal_pin_credentials')
        .select('pin_hash, answer_hash, question_id').eq('user_id', user.id).maybeSingle();
      if (securityError) throw new Error('Security controls are unavailable. Ask the school administrator to complete the security database setup.');
      const pinState = { pinRequired: true, needsSetup: !security, questionId: security?.question_id || null };
      const staff = profile.role !== 'student';

      let acceptedPinHash = security?.pin_hash;

      if (body.action === 'lock') {
        const { error } = await admin.from('portal_verified_sessions').delete().eq('user_id', user.id).eq('session_id', sessionId);
        if (error) throw new Error('The portal could not be locked. Please sign out.');
        return res.status(200).json(pinState);
      }
      if (body.action === 'status') return res.status(200).json({ pinRequired: false, profile });
      if (body.action === 'module-status' || body.action === 'touch') {
        if (!security || !await verifiedPortalSession(admin, user.id, token)) return res.status(200).json(pinState);
        if (body.action === 'touch') {
          const { data, error } = await admin.from('portal_verified_sessions').update({ last_activity_at: new Date().toISOString() })
            .eq('user_id', user.id).eq('session_id', sessionId).select('session_id').maybeSingle();
          if (error) throw new Error('Your session could not be refreshed.');
          if (!data) return res.status(200).json(pinState);
        }
        return res.status(200).json({ pinRequired: false, profile });
      }
      if (body.action === 'setup-pin') {
        if (security) return res.status(409).json({ error: 'A PIN is already configured. Use PIN recovery to reset it.' });
        const answer = normalizeAnswer(body.answer);
        if (!validPin(body.pin) || answer.length < 3 || answer.length > 200 || !SECURITY_QUESTIONS.some((q) => q.id === body.questionId)) {
          return res.status(400).json({ error: 'Choose a 6-digit PIN, a security question, and an answer of 3–200 characters.' });
        }
        acceptedPinHash = await hashSecret(body.pin);
        const { error } = await admin.from('portal_pin_credentials').insert({ user_id: user.id,
          pin_hash: acceptedPinHash, answer_hash: await hashSecret(answer), question_id: body.questionId });
        if (error) throw new Error('Your PIN could not be created. Please try again.');
      } else if (body.action === 'verify-pin') {
        if (!security) return res.status(409).json({ error: 'Create your security PIN first.' });
        if (!validPin(body.pin)) return res.status(400).json({ error: 'Enter your 6-digit PIN.' });
        const attempt = await reserve('pin', user.id);
        if (!attempt) return;
        if (!await verifySecret(body.pin, security.pin_hash)) return failAttempt(attempt, 'Incorrect PIN.');
        await clearAttempts(admin, attempt.key);
      } else if (body.action === 'reset-pin' || body.action === 'admin-reset-pin') {
        const adminReset = body.action === 'admin-reset-pin';
        if (adminReset && (!['admin', 'superadmin'].includes(profile.role) || !await verifiedPortalSession(admin, user.id, token))) {
          return res.status(403).json({ error: 'Only an unlocked administrator can reset a student PIN.' });
        }
        if (!validPin(body.pin) || normalizeAnswer(body.answer).length < 3 || normalizeAnswer(body.answer).length > 200
          || typeof body.password !== 'string' || !body.password || body.password.length > 1024) {
          return res.status(400).json({ error: 'Your password, the security answer, and a new 6-digit PIN are required.' });
        }
        const targetId = adminReset ? body.studentId : user.id;
        let target = security;
        if (adminReset) {
          if (typeof targetId !== 'string' || !/^[a-f0-9-]{36}$/i.test(targetId)) return res.status(400).json({ error: 'Choose a student.' });
          const { data: student, error } = await admin.from('profiles').select('role').eq('id', targetId).maybeSingle();
          if (error || student?.role !== 'student') return res.status(403).json({ error: 'Only student PINs can be reset here.' });
          const result = await admin.from('portal_pin_credentials').select('pin_hash, answer_hash, question_id').eq('user_id', targetId).maybeSingle();
          if (result.error) throw new Error('Student PIN recovery could not be loaded.');
          target = result.data;
        }
        if (!target) return res.status(409).json({ error: 'This account has not created a PIN and security question yet.' });
        const attempt = await reserve('recovery', targetId);
        if (!attempt) return;
        const passwordAttempt = await reserve('password', user.email.toLowerCase());
        if (!passwordAttempt) return;
        const passwordResult = await auth.auth.signInWithPassword({ email: user.email, password: body.password });
        if (passwordResult.error || passwordResult.data?.user?.id !== user.id) return failAttempt(passwordAttempt, 'Incorrect password.');
        // Dispose of the extra reauthentication session; keep the original session.
        await auth.auth.signOut({ scope: 'local' });
        await clearAttempts(admin, passwordAttempt.key);
        if (!await verifySecret(normalizeAnswer(body.answer), target.answer_hash)) return failAttempt(attempt, 'Incorrect security answer.');
        const { error } = await admin.rpc('replace_portal_pin', { target_user: targetId, new_pin_hash: await hashSecret(body.pin), expected_pin_hash: target.pin_hash });
        if (error) throw new Error('The PIN changed during recovery. Please try again.');
        await clearAttempts(admin, attempt.key);
        await clearAttempts(admin, attemptKey('pin', targetId));
        if (adminReset) return res.status(200).json({ message: 'Student PIN reset. All of their portal sessions are now locked.' });
        // Recovery also locks the current session. Verify the new PIN to unlock.
        return res.status(200).json(pinState);
      } else if (body.action === 'student-recovery-info') {
        if (!['admin', 'superadmin'].includes(profile.role) || !await verifiedPortalSession(admin, user.id, token)) return res.status(403).json({ error: 'Unlock your administrator account first.' });
        if (typeof body.studentId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.studentId)) return res.status(400).json({ error: 'Choose a student.' });
        const { data: student } = await admin.from('profiles').select('role').eq('id', body.studentId).maybeSingle();
        if (student?.role !== 'student') return res.status(403).json({ error: 'Choose a student account.' });
        const { data, error } = await admin.from('portal_pin_credentials').select('question_id').eq('user_id', body.studentId).maybeSingle();
        if (error) throw new Error('The recovery question could not be loaded.');
        return res.status(200).json({ questionId: data?.question_id || null });
      } else return res.status(400).json({ error: 'Unknown security action.' });

      const { error } = await admin.rpc('unlock_portal_session', {
        target_user: user.id, target_session: sessionId, expected_pin_hash: acceptedPinHash,
      });
      if (error) throw new Error('Your PIN was accepted but the portal could not be unlocked. Please try again.');
      return res.status(200).json({ pinRequired: false, profile });
    } catch (error) {
      console.error('Portal security request failed:', error.message);
      return res.status(503).json({ error: error.message || 'Portal security is temporarily unavailable. Please try again.' });
    }
  };
}

export default createLoginSecurityHandler();
