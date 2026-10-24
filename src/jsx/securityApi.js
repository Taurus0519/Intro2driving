import { supabase } from "./supabase_Client";

export async function securityRequest(action, values = {}, accessToken) {
  let token = accessToken;
  if (!token && action !== "sign-in") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  }
  const response = await fetch("/api/login-security", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...values, action }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      result?.error ||
        "Security verification could not be completed. Please try again.",
    );
    error.attemptsRemaining = result?.attemptsRemaining;
    error.status = response.status;
    throw error;
  }
  return result;
}
