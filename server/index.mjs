import express from 'express';
import { createClient } from '@supabase/supabase-js';
import studentDetailsHandler from '../api/student-details.mjs';
import studentQuizAttemptsHandler from '../api/student-quiz-attempts.mjs';

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3001);
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missingSupabaseConfig = [
  !supabaseUrl && 'SUPABASE_URL or VITE_SUPABASE_URL',
  !publishableKey && 'SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY',
  !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean);
const authClient = supabaseUrl && publishableKey
  ? createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const adminClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...((process.env.ACCOUNT_API_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean))],
);

app.use((request, response, next) => {
  const origin = request.headers.origin;
  const isAllowedOrigin = origin && (allowedOrigins.has(origin) || /^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin));
  if (isAllowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use(express.json({ limit: '16kb' }));
app.get('/api/student-details', studentDetailsHandler);
app.get('/api/student-quiz-attempts', studentQuizAttemptsHandler);

app.get('/health', (_request, response) => {
  response.json({ ok: true, configured: Boolean(authClient && adminClient) });
});

function parseAccountInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, error: 'The request body must be a JSON object.' };
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const { role, age } = body;

  if (!email || !password || !name || !username || (role !== 'student' && role !== 'admin')) {
    return { status: 400, error: 'Name, email, username, password, and a valid account role are required.' };
  }
  if (password.length < 6) return { status: 400, error: 'Password must be at least 6 characters.' };
  if (role === 'student' && (!Number.isInteger(age) || age < 0)) {
    return { status: 400, error: 'A valid student age is required.' };
  }
  return { input: { email, password, name, username, role, age } };
}

function getBearerToken(header = '') {
  const separatorIndex = header.indexOf(' ');
  if (separatorIndex < 0 || header.slice(0, separatorIndex).toLowerCase() !== 'bearer') return null;
  return header.slice(separatorIndex + 1).trim() || null;
}

async function authorizeCaller(token, role) {
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return { status: 401, error: 'Your session is invalid or expired. Sign in again.' };
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || !callerProfile) {
    return { status: 403, error: 'Your account does not have a portal role.' };
  }
  if (role === 'admin' && callerProfile.role !== 'superadmin') {
    return { status: 403, error: 'Only a superadmin can create admin accounts.' };
  }
  if (role === 'student' && !['admin', 'superadmin'].includes(callerProfile.role)) {
    return { status: 403, error: 'Only an admin can create student accounts.' };
  }
  return { client: adminClient };
}

async function createAccountRecord(client, input) {
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, username: input.username },
  });
  if (createError || !created.user) {
    return { status: 400, error: createError?.message || 'Supabase did not return the new user.' };
  }

  const { error: insertError } = await client.from('profiles').upsert({
    id: created.user.id,
    name: input.name,
    email: input.email,
    username: input.username,
    role: input.role,
    status: 'Active',
    progress: 0,
  }, { onConflict: 'id' });

  if (insertError) {
    await client.auth.admin.deleteUser(created.user.id);
    return { status: 500, error: `The auth user was created but its profile could not be saved: ${insertError.message}` };
  }

  if (input.role === 'student') {
    const { error: studentProfileError } = await client.from('student_profiles').upsert({
      student_id: created.user.id,
      age: input.age,
    }, { onConflict: 'student_id' });

    if (studentProfileError) {
      await client.from('profiles').delete().eq('id', created.user.id);
      await client.auth.admin.deleteUser(created.user.id);
      return { status: 500, error: `The student age could not be saved: ${studentProfileError.message}` };
    }
  }

  return { userId: created.user.id };
}

app.post('/api/create-account', async (request, response) => {
  const parsed = parseAccountInput(request.body);
  if ('error' in parsed) return response.status(parsed.status).json({ error: parsed.error });
  if (!authClient || !adminClient) {
    return response.status(500).json({
      error: `The account API is missing required configuration: ${missingSupabaseConfig.join(', ')}. Add it to the root .env file and restart the API.`,
    });
  }

  const token = getBearerToken(request.get('authorization'));
  if (!token) return response.status(401).json({ error: 'Sign in before creating an account.' });

  try {
    const authorization = await authorizeCaller(token, parsed.input.role);
    if ('error' in authorization) return response.status(authorization.status).json({ error: authorization.error });

    const result = await createAccountRecord(authorization.client, parsed.input);
    if ('error' in result) return response.status(result.status).json({ error: result.error });
    return response.status(201).json({ userId: result.userId });
  } catch (error) {
    console.error('Account API request failed:', error);
    return response.status(500).json({ error: 'Account creation failed due to a server error.' });
  }
});

app.get('/api/message-recipients', async (request, response) => {
  if (!authClient || !adminClient) {
    return response.status(500).json({
      error: `The message recipients API is missing required configuration: ${missingSupabaseConfig.join(', ')}. Add it to the root .env file and restart the API.`,
    });
  }

  const token = getBearerToken(request.get('authorization'));
  if (!token) return response.status(401).json({ error: 'Sign in to view message recipients.' });

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return response.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();
    if (callerProfileError || !callerProfile) {
      console.error('Could not verify caller profile for message recipients:', callerProfileError);
      return response.status(403).json({ error: 'Your account does not have a portal profile.' });
    }

    const { data: recipients, error: recipientsError } = await adminClient
      .from('profiles')
      .select('id, name')
      .neq('id', user.id)
      .order('name');
    if (recipientsError) {
      console.error('Message recipients could not be loaded:', recipientsError);
      return response.status(500).json({ error: 'Message recipients could not be loaded.' });
    }

    return response.json({ recipients: recipients || [] });
  } catch (error) {
    console.error('Message recipients request failed:', error);
    return response.status(500).json({ error: 'Message recipients failed due to a server error.' });
  }
});

app.listen(port, () => {
  console.log(`Account API listening on port ${port}`);
});
