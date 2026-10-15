import { supabase } from './supabase_Client';

export async function createAccount({ email, password, name, username, role, age }) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error('Sign in before creating an account.');

  const apiUrl = import.meta.env.DEV
    ? (import.meta.env.VITE_ACCOUNT_API_URL || 'http://localhost:3001').replace(/\/$/, '')
    : '';
  let response;
  try {
    response = await fetch(`${apiUrl}/api/create-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({ email, password, name, username, role, age }),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Could not reach the account API. Confirm the Vercel deployment is up to date. Locally, start the API with npm run dev.');
    }
    throw error;
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Account creation failed.');
  return result;
}