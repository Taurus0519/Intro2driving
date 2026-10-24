import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../src/js/learningStats.mjs";
import { splitProfileName } from "../src/js/profileIdentity.mjs";
import { verifiedPortalSession } from "../server/security.mjs";

export function createStudentDetailsHandler({
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
        .json({ error: "Sign in to view student details." });
    const studentId = req.query?.studentId;
    if (
      typeof studentId !== "string" ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
        studentId,
      )
    ) {
      return res.status(400).json({ error: "A valid student ID is required." });
    }
    if (!url || !publishableKey || !serviceRoleKey) {
      return res.status(500).json({
        error:
          "Student details are unavailable. The school administrator must configure the account API.",
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
      const userClient = clientFactory(url, publishableKey, {
        ...options,
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: caller, error: roleError } = await userClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (roleError || !["admin", "superadmin"].includes(caller?.role)) {
        return res.status(403).json({
          error: "Only school administrators can view student details.",
        });
      }

      const adminClient = clientFactory(url, serviceRoleKey, options);
      if (!(await sessionVerifier(adminClient, user.id, token)))
        return res.status(423).json({
          error: "Unlock your administrator portal to continue.",
          pinRequired: true,
        });
      const { data: student, error: studentError } = await adminClient
        .from("profiles")
        .select("id, name, email, username, status, progress")
        .eq("id", studentId)
        .eq("role", "student")
        .maybeSingle();
      if (studentError)
        return res
          .status(500)
          .json({ error: "Student information could not be loaded." });
      if (!student)
        return res
          .status(404)
          .json({ error: "This student could not be found." });

      const [identity, ...sections] = await Promise.allSettled([
        adminClient.auth.admin.getUserById(studentId),
        adminClient
          .from("student_profiles")
          .select("nickname, age, gender, date_of_birth, address, about, goals")
          .eq("student_id", studentId)
          .maybeSingle(),
        fetchAllRows(() =>
          adminClient
            .from("game_scores")
            .select("level, score, max_score, recorded_at")
            .eq("player_id", studentId)
            .order("recorded_at", { ascending: false })
            .order("id"),
        ),
        fetchAllRows(() =>
          adminClient
            .from("quiz_attempts")
            .select(
              "id, score, total_questions, percentage, chapter_number, created_at",
            )
            .eq("student_id", studentId)
            .order("created_at", { ascending: false })
            .order("id"),
        ),
        fetchAllRows(() =>
          adminClient
            .from("player_achievements")
            .select("achievement_id, unlocked_at")
            .eq("user_id", studentId)
            .order("achievement_id"),
        ),
        fetchAllRows(() =>
          adminClient
            .from("pdc_checklist_responses")
            .select("item_id, result, remarks")
            .eq("student_id", studentId)
            .order("item_id"),
        ),
      ]);
      const names = [
        "details",
        "gameScores",
        "quizAttempts",
        "achievements",
        "pdcResponses",
      ];
      const savedUser =
        identity.status === "fulfilled" && !identity.value.error
          ? identity.value.data?.user
          : null;
      const nameParts = splitProfileName(
        student.name,
        savedUser?.id === studentId
          ? savedUser.user_metadata?.profile_name
          : null,
      );
      const result = { student: { ...student, ...nameParts }, errors: {} };
      sections.forEach((section, index) => {
        const name = names[index];
        const value =
          section.status === "fulfilled"
            ? section.value
            : { error: section.reason };
        if (value.error)
          result.errors[name] =
            "This information could not be loaded. Please try again later.";
        result[name] = value.data ?? (name === "details" ? {} : []);
      });
      return res.status(200).json(result);
    } catch {
      return res.status(500).json({
        error: "Student details could not be loaded. Please try again.",
      });
    }
  };
}

export default createStudentDetailsHandler();
