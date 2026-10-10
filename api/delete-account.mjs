import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return respond(res, 500, {
      error: 'Account deletion is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(res, 401, { error: 'Sign in before deleting an account.' });

  const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return respond(res, 400, { error: 'A valid student user ID is required.' });
  }

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
      return respond(res, 403, { error: 'Only an admin can delete student accounts.' });
    }

    const { data: studentProfile, error: studentProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (studentProfileError || studentProfile?.role !== 'student') {
      return respond(res, 404, { error: 'The requested student account was not found.' });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Student account deletion failed:', deleteError);
      return respond(res, 500, { error: `Student account could not be deleted: ${deleteError.message}` });
    }

    return respond(res, 200, { success: true });
  } catch (error) {
    console.error('Student account deletion request failed:', error);
    return respond(res, 500, { error: 'Student account deletion failed due to a server error.' });
  }
}
