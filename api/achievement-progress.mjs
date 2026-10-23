import { createClient } from '@supabase/supabase-js';
import { requirePortalSession } from '../server/security.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return respond(res, 500, {
      error: 'Achievement progress is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(res, 401, { error: 'Sign in before viewing achievement progress.' });

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
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
    const { data: callerProfile, error: callerProfileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfileError || !callerProfile) {
      console.error('Could not verify caller role for achievement progress:', callerProfileError);
      return respond(res, 500, {
        error: `Could not load your portal role: ${callerProfileError?.message || 'profile not found.'}`,
      });
    }
    const callerRole = callerProfile.role?.trim().toLowerCase();
    if (!['admin', 'superadmin'].includes(callerRole)) {
      return respond(res, 403, { error: 'Only an admin or superadmin can view student achievement progress.' });
    }

    const { data: awards, error: awardsError } = await adminClient
      .from('player_achievements')
      .select('user_id, achievement_id, unlocked_at')
      .order('unlocked_at', { ascending: false });
    if (awardsError) {
      console.error('Student achievement progress could not be loaded:', awardsError);
      return respond(res, 500, {
        error: `Achievement progress could not be loaded: ${awardsError.message}. Check that SUPABASE_SERVICE_ROLE_KEY belongs to the same Supabase project as VITE_SUPABASE_URL.`,
      });
    }

    return respond(res, 200, { awards: awards || [] });
  } catch (error) {
    console.error('Student achievement progress request failed:', error);
    return respond(res, 500, { error: 'Achievement progress failed due to a server error.' });
  }
}
