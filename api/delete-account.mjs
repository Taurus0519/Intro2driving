import { createClient } from "@supabase/supabase-js";
import { requirePortalSession } from "../server/security.mjs";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respond(res, 405, { error: "Method not allowed." });
  }

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return respond(res, 500, {
      error:
        "Account deletion is not configured. Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
    });
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token)
    return respond(res, 401, { error: "Sign in before deleting an account." });

  const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    return respond(res, 400, { error: "A valid student user ID is required." });
  }

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
    const {
      data: { user: caller },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !caller) {
      return respond(res, 401, {
        error: `Your session could not be verified: ${authError?.message || "sign in again."}`,
      });
    }

    if (!(await requirePortalSession(adminClient, caller.id, token, res)))
      return;
    const { data: callerProfile, error: callerProfileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (callerProfileError || !callerProfile) {
      console.error(
        "Could not verify caller role for student deletion:",
        callerProfileError,
      );
      return respond(res, 500, {
        error: `Could not load your portal role: ${callerProfileError?.message || "profile not found."}`,
      });
    }
    const callerRole = callerProfile.role?.trim().toLowerCase();
    if (!["admin", "superadmin"].includes(callerRole)) {
      return respond(res, 403, {
        error: "Only an admin or superadmin can delete student accounts.",
      });
    }

    const { data: studentProfile, error: studentProfileError } =
      await userClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
    if (studentProfileError) {
      console.error(
        "Could not verify target student role:",
        studentProfileError,
      );
      return respond(res, 500, {
        error: `Could not verify the selected student: ${studentProfileError.message}`,
      });
    }
    if (studentProfile?.role?.trim().toLowerCase() !== "student") {
      return respond(res, 404, {
        error: "The requested student account was not found.",
      });
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Student account deletion failed:", deleteError);
      return respond(res, 500, {
        error: `Student account could not be deleted: ${deleteError.message}. Ensure SUPABASE_SERVICE_ROLE_KEY is the service-role key for the same Supabase project as VITE_SUPABASE_URL.`,
      });
    }

    return respond(res, 200, { success: true });
  } catch (error) {
    console.error("Student account deletion request failed:", error);
    return respond(res, 500, {
      error: "Student account deletion failed due to a server error.",
    });
  }
}
