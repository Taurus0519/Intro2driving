import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return respond(res, 500, {
      error: 'Achievement progress is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(res, 401, { error: 'Sign in before viewing achievement progress.' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return respond(res, 401, { error: 'Your session is invalid or expired. Sign in again.' });
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfileError || !['admin', 'superadmin'].includes(callerProfile?.role)) {
      return respond(res, 403, { error: 'Only an admin can view student achievement progress.' });
    }

    const { data: awards, error: awardsError } = await supabase
      .from('player_achievements')
      .select('user_id, achievement_id');
    if (awardsError) {
      console.error('Student achievement progress could not be loaded:', awardsError);
      return respond(res, 500, { error: `Achievement progress could not be loaded: ${awardsError.message}` });
    }

    return respond(res, 200, { awards: awards || [] });
  } catch (error) {
    console.error('Student achievement progress request failed:', error);
    return respond(res, 500, { error: 'Achievement progress failed due to a server error.' });
  }
}
