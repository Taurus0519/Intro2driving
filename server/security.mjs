import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { IDLE_LOCK_MS } from '../src/js/securityConfig.mjs';

const scrypt = promisify(scryptCallback);
export async function hashSecret(secret) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(secret, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifySecret(secret, stored) {
  const [algorithm, salt, hex] = String(stored || '').split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  return timingSafeEqual(await scrypt(secret, salt, 64), Buffer.from(hex, 'hex'));
}
// The JWT must have been validated by auth.getUser(token) before reading its session ID.
export function tokenSessionId(token) {
  try {
    const id = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id;
    return typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id) ? id : null;
  } catch { return null; }
}
export function attemptKey(kind, identifier) {
  return createHash('sha256').update(`${kind}:${identifier}`).digest('hex');
}
export async function reserveAttempt(client, kind, identifier) {
  const key = attemptKey(kind, identifier);
  const { data, error } = await client.rpc('reserve_portal_attempt', { attempt_key: key });
  if (error || !data) throw new Error('Security controls are unavailable. Ask the school administrator to complete the security database setup.');
  return { ...data, key };
}
export async function clearAttempts(client, key) {
  const { error } = await client.from('portal_login_attempts').delete().eq('key', key);
  if (error) throw new Error('Security verification could not be completed. Please try again.');
}
export async function verifiedPortalSession(client, userId, token, now = Date.now()) {
  const sessionId = tokenSessionId(token);
  if (!sessionId) return false;
  const { data, error } = await client.from('portal_verified_sessions')
    .select('last_activity_at').eq('user_id', userId).eq('session_id', sessionId).maybeSingle();
  if (error) throw new Error('The portal security database is unavailable.');
  const activity = Date.parse(data?.last_activity_at);
  if (!Number.isFinite(activity) || activity > now + 5000 || now - activity >= IDLE_LOCK_MS) return false;
  const { data: profile, error: profileError } = await client.from('profiles').select('role, status').eq('id', userId).maybeSingle();
  if (profileError) throw new Error('Your portal account could not be verified.');
  return ['student', 'admin', 'superadmin'].includes(profile?.role) && profile.status !== 'Inactive';
}

export async function requirePortalSession(client, userId, token, res) {
  if (await verifiedPortalSession(client, userId, token)) return true;
  res.status(423).json({ error: 'Your portal is locked. Unlock it to continue.', pinRequired: true });
  return false;
}
