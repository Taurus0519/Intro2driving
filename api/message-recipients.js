const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(res, status, body) {
  return res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return respond(res, 405, { error: "Method not allowed." });
  }

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return respond(res, 500, {
      error:
        "Message recipients are not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY for the same Supabase project.",
    });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token)
    return respond(res, 401, { error: "Sign in to view message recipients." });

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { requirePortalSession } = await import("../server/security.mjs");
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return respond(res, 401, {
        error: "Your session is invalid or expired. Sign in again.",
      });
    }
    if (!(await requirePortalSession(adminClient, user.id, token, res))) return;

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    if (callerProfileError || !callerProfile) {
      console.error(
        "Could not verify caller profile for message recipients:",
        callerProfileError,
      );
      return respond(res, 403, {
        error: "Your account does not have a portal profile.",
      });
    }

    const { data: recipients, error: recipientsError } = await adminClient
      .from("profiles")
      .select("id, name")
      .neq("id", user.id)
      .order("name");
    if (recipientsError) {
      console.error("Message recipients could not be loaded:", recipientsError);
      return respond(res, 500, {
        error: "Message recipients could not be loaded.",
      });
    }

    return respond(res, 200, { recipients: recipients || [] });
  } catch (error) {
    console.error("Message recipients request failed:", error);
    return respond(res, 500, {
      error: "Message recipients failed due to a server error.",
    });
  }
};
