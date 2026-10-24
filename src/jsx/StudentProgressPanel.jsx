import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase_Client";
import { fetchAllRows } from "../js/learningStats.mjs";
import { ACHIEVEMENTS } from "../js/achievementData";
import Pagination from "./Pagination";

export default function StudentProgressPanel({
  students,
  studentsLoading,
  studentsError,
}) {
  const [scores, setScores] = useState([]);
  const [awards, setAwards] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Please sign in to view progress.");
        const [gameResult, response] = await Promise.all([
          fetchAllRows(() =>
            supabase
              .from("game_scores")
              .select("player_id, level, score, max_score, recorded_at")
              .order("recorded_at", { ascending: false })
              .order("id"),
          ),
          fetch("/api/achievement-progress", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        const result = await response.json();
        if (gameResult.error || !response.ok)
          throw new Error(
            "Student progress could not be loaded. Please try again.",
          );
        if (active) {
          setScores(gameResult.data || []);
          setAwards(result.awards || []);
          setError("");
        }
      } catch (error) {
        if (active) setError(error.message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, []);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(students.length / 3)),
  );
  return (
    <section className="dash-card student-progress-panel">
      <div className="card-heading">
        <h3>Student Progress &amp; Earned Achievements</h3>
        <span>Updates every 30 seconds</span>
      </div>
      {error || studentsError ? (
        <p className="error" role="alert">
          {error || studentsError}
        </p>
      ) : loading || studentsLoading ? (
        <p role="status">Loading student progress…</p>
      ) : !students.length ? (
        <p>No students registered yet.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Game Scores</th>
                  <th>Earned Achievements</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .slice((currentPage - 1) * 3, currentPage * 3)
                  .map((student) => (
                    <tr key={student.id}>
                      <td>
                        <Link
                          className="student-name-link"
                          to={`/students/${student.id}`}
                        >
                          {student.name || "Student"}
                        </Link>
                      </td>
                      <td>
                        <ul className="student-progress-scores">
                          {Array.from({ length: 6 }, (_, index) => {
                            const level = index + 1;
                            const score = scores
                              .filter(
                                (item) =>
                                  item.player_id === student.id &&
                                  Number(item.level) === level,
                              )
                              .sort(
                                (a, b) =>
                                  (Date.parse(b.recorded_at) || 0) -
                                  (Date.parse(a.recorded_at) || 0),
                              )[0];
                            return (
                              <li key={level}>
                                <strong>Level {level}:</strong>{" "}
                                {score
                                  ? `${score.score}/${score.max_score}`
                                  : "No score yet"}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td>
                        {awards.some(
                          (award) => award.user_id === student.id,
                        ) ? (
                          <ul className="student-earned-achievements">
                            {awards
                              .filter((award) => award.user_id === student.id)
                              .map((award) => {
                                const achievement = ACHIEVEMENTS.find(
                                  (item) => item.id === award.achievement_id,
                                );
                                return achievement ? (
                                  <li key={award.achievement_id}>
                                    <span>
                                      <strong>{achievement.title}</strong>
                                      <small>
                                        Completed{" "}
                                        {new Date(
                                          award.unlocked_at,
                                        ).toLocaleDateString()}
                                      </small>
                                    </span>
                                  </li>
                                ) : null;
                              })}
                          </ul>
                        ) : (
                          "No achievements completed yet"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageSize={3}
            totalItems={students.length}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
