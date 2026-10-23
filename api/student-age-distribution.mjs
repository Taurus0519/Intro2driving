import { createClient } from '@supabase/supabase-js';
import { requirePortalSession } from '../server/security.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGE_GROUPS = ['16-17', '18-24', '25-34', '35+'];

function respond(res, status, body) {
  return res.status(status).json(body);
}

async function fetchAllRows(buildQuery) {
  const pageSize = 1000;
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

function getAgeFromDateOfBirth(dateOfBirth) {
  if (typeof dateOfBirth !== 'string') return null;

  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year
    || birthDate.getUTCMonth() + 1 !== month
    || birthDate.getUTCDate() !== day
  ) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  if (
    today.getUTCMonth() + 1 < month
    || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)
  ) age -= 1;

  return age >= 0 ? age : null;
}

function getAgeGroup(age) {
  if (!Number.isInteger(age) || age < 0) return null;
  if (age < 18 && age >= 16) return '16-17';
  if (age <= 24 && age >= 18) return '18-24';
  if (age <= 34 && age >= 25) return '25-34';
  if (age >= 35) return '35+';
  return null;
}

export function getStudentAgeGroups(accounts, personalProfiles) {
  const studentIds = new Set(accounts.filter((account) => account.role === 'student').map((account) => account.id));
  const ageGroups = Object.fromEntries(AGE_GROUPS.map((group) => [group, 0]));

  for (const personalProfile of personalProfiles) {
    if (!studentIds.has(personalProfile.student_id)) continue;
    const ageFromDateOfBirth = getAgeFromDateOfBirth(personalProfile.date_of_birth);
    const age = ageFromDateOfBirth ?? (
      personalProfile.age == null ? null : Number(personalProfile.age)
    );
    const group = getAgeGroup(age);
    if (group) ageGroups[group] += 1;
  }

  return ageGroups;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return respond(res, 500, {
      error: 'Student age distribution is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(res, 401, { error: 'Sign in before viewing student age distribution.' });

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: { user: caller }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !caller) {
      return respond(res, 401, {
        error: `Your session could not be verified: ${authError?.message || 'sign in again.'}`,
      });
    }

    if (!await requirePortalSession(adminClient, caller.id, token, res)) return;
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfileError || !callerProfile) {
      console.error('Could not verify caller role for student age distribution:', callerProfileError);
      return respond(res, 500, {
        error: `Could not load your portal role: ${callerProfileError?.message || 'profile not found.'}`,
      });
    }

    const callerRole = callerProfile.role?.trim().toLowerCase();
    if (!['admin', 'superadmin'].includes(callerRole)) {
      return respond(res, 403, { error: 'Only an admin or superadmin can view student age distribution.' });
    }

    const [studentsResult, studentProfilesResult] = await Promise.all([
      fetchAllRows(() => adminClient.from('profiles').select('id, role').eq('role', 'student')),
      fetchAllRows(() => adminClient.from('student_profiles').select('student_id, age, date_of_birth')),
    ]);

    if (studentsResult.error || studentProfilesResult.error) {
      const error = studentsResult.error || studentProfilesResult.error;
      console.error('Student age distribution could not be loaded:', error);
      return respond(res, 500, { error: `Student age distribution could not be loaded: ${error.message}` });
    }

    const ageGroups = getStudentAgeGroups(studentsResult.data || [], studentProfilesResult.data || []);

    return respond(res, 200, { ageGroups });
  } catch (error) {
    console.error('Student age distribution request failed:', error);
    return respond(res, 500, { error: 'Student age distribution failed due to a server error.' });
  }
}
