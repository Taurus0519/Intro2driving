import { supabase } from './supabase_Client';

export async function createAccount({ email, password, name, username, role, age }) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error('Sign in before creating an account.');

  const apiUrl = (import.meta.env.VITE_ACCOUNT_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  const response = await fetch(`${apiUrl}/api/create-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, password, name, username, role, age }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Account creation failed.');
  return result;
}