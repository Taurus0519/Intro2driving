const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(res, status, body) {
  return res.status(status).json(body);
}

function parseAccountInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, error: 'The request body must be a JSON object.' };
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const { role, age } = body;

  if (!email || !password || !name || !username || !['student', 'admin'].includes(role)) {
    return { status: 400, error: 'Name, email, username, password, and a valid account role are required.' };
  }
  if (password.length < 6) return { status: 400, error: 'Password must be at least 6 characters.' };
  if (role === 'student' && (!Number.isInteger(age) || age < 0)) {
    return { status: 400, error: 'A valid student age is required.' };
  }
  return { input: { email, password, name, username, role, age } };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  const parsed = parseAccountInput(req.body);
  if ('error' in parsed) return respond(res, parsed.status, { error: parsed.error });

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return respond(res, 500, {
      error: 'Account creation is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel for the same Supabase project.',
    });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(res, 401, { error: 'Sign in before creating an account.' });

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
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return respond(res, 401, { error: 'Your session is invalid or expired. Sign in again.' });
    }

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      return respond(res, 403, { error: `Could not verify your portal role: ${profileError?.message || 'profile not found.'}` });
    }

    const callerRole = profile.role?.trim().toLowerCase();
    if (parsed.input.role === 'admin' && callerRole !== 'superadmin') {
      return respond(res, 403, { error: 'Only a superadmin can create admin accounts.' });
    }
    if (parsed.input.role === 'student' && !['admin', 'superadmin'].includes(callerRole)) {
      return respond(res, 403, { error: 'Only an admin or superadmin can create student accounts.' });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: parsed.input.email,
      password: parsed.input.password,
      email_confirm: true,
      user_metadata: { name: parsed.input.name, username: parsed.input.username },
    });
    if (createError || !created.user) {
      return respond(res, 400, { error: createError?.message || 'Supabase did not return the new user.' });
    }

    const rollbackCreatedUser = async () => {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
      if (rollbackError) {
        console.error('Could not roll back partially created account:', rollbackError);
      }
    };

    const { error: insertError } = await adminClient.from('profiles').upsert({
      id: created.user.id,
      name: parsed.input.name,
      email: parsed.input.email,
      username: parsed.input.username,
      role: parsed.input.role,
      status: 'Active',
      progress: 0,
    }, { onConflict: 'id' });

    if (insertError) {
      await rollbackCreatedUser();
      return respond(res, 500, { error: `The account was created but its profile could not be saved: ${insertError.message}` });
    }

    if (parsed.input.role === 'student') {
      const { error: studentProfileError } = await adminClient.from('student_profiles').upsert({
        student_id: created.user.id,
        age: parsed.input.age,
      }, { onConflict: 'student_id' });

      if (studentProfileError) {
        const { error: profileRollbackError } = await adminClient.from('profiles').delete().eq('id', created.user.id);
        if (profileRollbackError) console.error('Could not roll back partially created student profile:', profileRollbackError);
        await rollbackCreatedUser();
        return respond(res, 500, { error: `The student age could not be saved: ${studentProfileError.message}` });
      }
    }

    return respond(res, 201, { userId: created.user.id });
  } catch (error) {
    console.error('Account API request failed:', error);
    return respond(res, 500, { error: 'Account creation failed due to a server error.' });
  }
};
