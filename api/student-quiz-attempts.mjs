import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../src/js/learningStats.mjs";
import { verifiedPortalSession } from "../server/security.mjs";

export function createStudentQuizAttemptsHandler({
  url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientFactory = createClient,
  sessionVerifier = verifiedPortalSession,
} = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Authorization");
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const token = (req.headers.authorization || "").match(
      /^Bearer\s+(.+)$/i,
    )?.[1];
    if (!token)
      return res
        .status(401)
        .json({ error: "Sign in to view your quiz results." });
    if (!url || !publishableKey || !serviceRoleKey) {
      return res.status(500).json({
        error:
          "Quiz results are unavailable. The school administrator must configure the quiz results API.",
      });
    }

    try {
      const options = {
        auth: { autoRefreshToken: false, persistSession: false },
      };
      const authClient = clientFactory(url, publishableKey, options);
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser(token);
      if (authError || !user)
        return res
          .status(401)
          .json({ error: "Your session has expired. Sign in again." });

      const adminClient = clientFactory(url, serviceRoleKey, options);
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) {
        console.error(
          "Could not verify caller role for student quiz results:",
          profileError,
        );
        return res
          .status(500)
          .json({ error: "Your portal role could not be verified." });
      }
      if (profile?.role !== "student") {
        return res.status(403).json({
          error: "Only students can use this endpoint to view quiz results.",
        });
      }

      const { data: attempts, error: attemptsError } = await fetchAllRows(() =>
        adminClient
          .from("quiz_attempts")
          .select("score, total_questions, chapter_number")
          .eq("student_id", user.id)
          .order("created_at")
          .order("id"),
      );
      if (attemptsError) {
        console.error(
          "Student quiz results could not be loaded:",
          attemptsError,
        );
        return res.status(500).json({
          error:
            "Your quiz results could not be loaded. Try refreshing the page.",
        });
      }

      return res.status(200).json({ attempts });
    } catch (error) {
      console.error("Student quiz results request failed:", error);
      return res.status(500).json({
        error: "Your quiz results could not be loaded due to a server error.",
      });
    }
  };
}

export default createStudentQuizAttemptsHandler();
