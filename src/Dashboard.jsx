import Calendar from './Calendar';
import { useEffect, useState } from 'react';
import './Dashboard.css';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth.jsx';
import { ACHIEVEMENTS } from './achievementData';
import { Link } from 'react-router-dom';
import { PDC_CHECKLIST_ITEM_COUNT, PDC_CHECKLIST_ITEMS } from './pdcChecklistData';

const PDC_CHECKLIST_ITEM_IDS = new Set(
  PDC_CHECKLIST_ITEMS.filter((item) => !item.optional).map((item) => item.id),
);
const AGE_GROUP_COLORS = {
  '16-17': '#3b82f6',
  '18-24': '#14b8a6',
  '25-34': '#f59e0b',
  '35+': '#8b5cf6',
};

async function fetchAllRows(buildQuery) {
  const pageSize = 1000;
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
    offset += pageSize;
  }
}

function ProgressCard({ icon, count, title, hint }) {
  return (
    <div className="progress-card">
      <div className="progress-icon">{icon}</div>
      <div className="progress-value">{count}</div>
      <div className="progress-title">{title}</div>
      <small>{hint}</small>
    </div>
  );
}

function getAgeGroupGradient(ageGroups) {
  const total = Object.values(ageGroups).reduce((sum, count) => sum + count, 0);
  if (!total) return 'conic-gradient(#e8eef3 0deg 360deg)';

  let currentAngle = 0;
  const slices = Object.entries(ageGroups).map(([group, count]) => {
    const startAngle = currentAngle;
    currentAngle += (count / total) * 360;
    return `${AGE_GROUP_COLORS[group]} ${startAngle}deg ${currentAngle}deg`;
  });

  return `conic-gradient(${slices.join(', ')})`;
}

function StudentDashboard({ profile }) {
  const [progress, setProgress] = useState({ quizzes: 0 });
  const [gameProgress, setGameProgress] = useState(Number(profile?.progress) || 0);
  const [gameProgressError, setGameProgressError] = useState('');
  const [completedAchievements, setCompletedAchievements] = useState([]);
  const [achievementError, setAchievementError] = useState('');
  const [pdcProgress, setPdcProgress] = useState({ answered: 0, complete: false });
  const [pdcError, setPdcError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadGameProgress() {
      const { data, error } = await supabase
        .from('profiles')
        .select('progress')
        .eq('id', profile.id)
        .single();

      if (!active) return;
      if (error) {
        setGameProgressError(`Game progress could not be loaded: ${error.message}`);
        return;
      }

      const value = Number(data.progress);
      if (!Number.isFinite(value)) {
        setGameProgressError('Game progress could not be loaded: the saved value is not a number.');
        return;
      }

      setGameProgress(value);
      setGameProgressError('');
    }

    void loadGameProgress();
    const refreshInterval = window.setInterval(() => void loadGameProgress(), 30000);
    const channel = supabase
      .channel(`student-game-progress-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        () => void loadGameProgress(),
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, [profile.id]);

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      const { count } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', profile.id)
        .eq('status', 'Completed');

      if (active) {
        setProgress({
          quizzes: count ?? 0,
        });
      }
    }

    void loadProgress();
    return () => {
      active = false;
    };
  }, [profile.id]);

  useEffect(() => {
    let active = true;

    async function loadPdcProgress() {
      const { data, error } = await supabase
        .from('pdc_checklist_responses')
        .select('item_id, result')
        .eq('student_id', profile.id);

      if (!active) return;
      if (error) {
        setPdcError(`PDC checklist status could not be loaded: ${error.message}`);
        return;
      }

      const answered = (data || []).filter((item) =>
        PDC_CHECKLIST_ITEM_IDS.has(item.item_id) && (item.result === 'yes' || item.result === 'no')
      ).length;
      setPdcProgress({ answered, complete: answered === PDC_CHECKLIST_ITEM_COUNT });
    }

    void loadPdcProgress();
    return () => {
      active = false;
    };
  }, [profile.id]);

  useEffect(() => {
    let active = true;

    async function loadAchievements() {
      const { data, error } = await supabase
        .from('player_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', profile.id)
        .order('unlocked_at', { ascending: false });

      if (!active) return;
      if (error) {
        setAchievementError(`Achievements could not be loaded: ${error.message}`);
        return;
      }

      setCompletedAchievements(data || []);
    }

    void loadAchievements();
    return () => {
      active = false;
    };
  }, [profile.id]);

  const firstName = profile?.name?.split(' ')[0] || 'Student';

  return (
    <div className="student-dashboard">
      <section className="student-welcome">
        <div>
          <span className="welcome-script">Drive the right way</span>
          <h2>Welcome back, {firstName}!</h2>
          <p>Keep learning and build the confidence to drive safely.</p>
        </div>
        <span className="welcome-stars" aria-hidden="true">★ ✦</span>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <div className="progress-heading">
            <h3>Game Progress</h3>
            <span>{gameProgressError ? 'Progress unavailable' : `${gameProgress}% complete`}</span>
          </div>
          {gameProgressError && <p role="alert" className="quiz-results-error">{gameProgressError}</p>}

          <div className="progress-cards">
            <ProgressCard
              icon="✓"
              count={progress.quizzes}
              title="Quizzes Completed"
              hint="Start your first quiz!"
            />
            <ProgressCard
              icon="★"
              count={completedAchievements.length}
              title="Achievements Completed"
              hint="Keep working toward your next achievement."
            />
            <ProgressCard
              icon="✓"
              count={`${pdcProgress.answered}/${PDC_CHECKLIST_ITEM_COUNT}`}
              title="PDC Checklist"
              hint={pdcError ? 'Status unavailable' : pdcProgress.complete ? 'Completed' : 'In progress'}
            />
          </div>

          <section className="dash-card pdc-dashboard-card">
            <div className="card-heading">
              <h3>PDC Checklist</h3>
              <Link to="/pdc-checklist">View checklist</Link>
            </div>
            {pdcError ? (
              <p role="alert" className="quiz-results-error">{pdcError}</p>
            ) : (
              <p>{pdcProgress.complete
                ? 'Your PDC checklist is complete.'
                : `Your PDC checklist is ${pdcProgress.answered} of ${PDC_CHECKLIST_ITEM_COUNT} items complete.`}</p>
            )}
          </section>

          <section className="dash-card completed-achievements-panel">
            <div className="card-heading">
              <h3>Your Completed Achievements</h3>
              <Link to="/achievements">View all</Link>
            </div>
            {achievementError ? (
              <p role="alert" className="quiz-results-error">{achievementError}</p>
            ) : completedAchievements.length ? (
              <ul className="completed-achievements-list">
                {completedAchievements.map((award) => {
                  const achievement = ACHIEVEMENTS.find((item) => item.id === award.achievement_id);
                  if (!achievement) return null;

                  return (
                    <li key={award.achievement_id}>
                      <span aria-hidden="true">{achievement.icon}</span>
                      <div>
                        <strong>{achievement.title}</strong>
                        <small>Completed {new Date(award.unlocked_at).toLocaleDateString()}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="quiz-results-empty">No achievements completed yet.</p>
            )}
          </section>

        </div>

        <div className="dashboard-aside">
          <Calendar />
          <section className="dash-card aside-card">
            <h3>Upcoming Quiz</h3>
            <p>No quiz scheduled.</p>
          </section>
          <section className="dash-card aside-card">
            <h3>Announcement</h3>
            <p>Keep your progress moving forward and check back for updates from your instructor.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ profile }) {
  const [ageGroups, setAgeGroups] = useState({
    '16-17': 0,
    '18-24': 0,
    '25-34': 0,
    '35+': 0,
  });
  const [ageGroupsError, setAgeGroupsError] = useState('');
  const [agePieHover, setAgePieHover] = useState(null);
  const [quizTakeCount, setQuizTakeCount] = useState(0);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [quizAttemptsError, setQuizAttemptsError] = useState('');
  const [pdcStudentCount, setPdcStudentCount] = useState(0);
  const [pdcCompletedCount, setPdcCompletedCount] = useState(0);
  const [pdcStatsError, setPdcStatsError] = useState('');
  const [studentProgress, setStudentProgress] = useState([]);
  const [studentProgressLoading, setStudentProgressLoading] = useState(true);
  const [studentProgressError, setStudentProgressError] = useState('');
  const [studentAchievements, setStudentAchievements] = useState({});
  const [studentAchievementsLoading, setStudentAchievementsLoading] = useState(true);
  const [studentAchievementsError, setStudentAchievementsError] = useState('');
  const [studentProgressLive, setStudentProgressLive] = useState(false);

  function handleAgePieMouseMove(event) {
    const chart = event.currentTarget;
    const bounds = chart.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const total = Object.values(ageGroups).reduce((sum, count) => sum + count, 0);

    let currentAngle = 0;
    for (const [group, count] of Object.entries(ageGroups)) {
      if (!count) continue;
      currentAngle += (count / total) * 360;
      if (angle < currentAngle) {
        setAgePieHover({
          group,
          count,
          percentage: (count / total) * 100,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });
        return;
      }
    }

    setAgePieHover(null);
  }

  useEffect(() => {
    let active = true;

    async function loadStudentProgress() {
      const [studentsResult, sessionResult] = await Promise.all([
        supabase.from('profiles').select('id, name, progress').eq('role', 'student').order('name'),
        supabase.auth.getSession(),
      ]);
      if (!active) return;

      if (studentsResult.error) {
        setStudentProgressError(`Student progress could not be loaded: ${studentsResult.error.message}`);
      } else {
        setStudentProgress(
          (studentsResult.data || []).filter((student) => Number(student.progress) > 0),
        );
        setStudentProgressError('');
      }
      setStudentProgressLoading(false);

      if (sessionResult.error || !sessionResult.data?.session?.access_token) {
        setStudentAchievementsError(
          sessionResult.error?.message || 'Your session has expired. Sign in again to view achievements.',
        );
        setStudentAchievementsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/achievement-progress', {
          headers: { Authorization: `Bearer ${sessionResult.data.session.access_token}` },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Achievement progress could not be loaded.');

        const knownAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
        const completedByStudent = new Map();
        for (const award of result?.awards || []) {
          if (!knownAchievementIds.has(award.achievement_id)) continue;
          const completed = completedByStudent.get(award.user_id) || new Set();
          completed.add(award.achievement_id);
          completedByStudent.set(award.user_id, completed);
        }
        if (active) {
          setStudentAchievements(
            Object.fromEntries([...completedByStudent].map(([userId, completed]) => [userId, completed.size])),
          );
          setStudentAchievementsError('');
        }
      } catch (error) {
        if (active) setStudentAchievementsError(error.message || 'Achievement progress could not be loaded.');
      } finally {
        if (active) setStudentAchievementsLoading(false);
      }
    }

    void loadStudentProgress();
    const refreshInterval = window.setInterval(() => void loadStudentProgress(), 30000);
    const channel = supabase
      .channel(`dashboard-student-progress-${profile?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void loadStudentProgress();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_achievements' }, () => {
        void loadStudentProgress();
      })
      .subscribe((status) => {
        if (active) setStudentProgressLive(status === 'SUBSCRIBED');
      });

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    let active = true;

    async function loadAgeGroups() {
      const [studentsResult, studentProfilesResult] = await Promise.all([
        fetchAllRows(() => supabase.from('profiles').select('id').eq('role', 'student')),
        fetchAllRows(() => supabase.from('student_profiles').select('student_id, age')),
      ]);
      if (!active) return;
      if (studentsResult.error || studentProfilesResult.error) {
        setAgeGroupsError(
          `Student age groups could not be loaded: ${studentsResult.error?.message || studentProfilesResult.error?.message}`,
        );
        return;
      }
      setAgeGroupsError('');

      const counts = { '16-17': 0, '18-24': 0, '25-34': 0, '35+': 0 };
      const studentIds = new Set((studentsResult.data || []).map((student) => student.id));

      for (const studentProfile of studentProfilesResult.data || []) {
        const age = Number(studentProfile.age);
        if (!studentIds.has(studentProfile.student_id) || studentProfile.age == null || !Number.isFinite(age) || age < 0) continue;
        if (age >= 16 && age < 18) counts['16-17'] += 1;
        else if (age >= 18 && age <= 24) counts['18-24'] += 1;
        else if (age >= 25 && age <= 34) counts['25-34'] += 1;
        else if (age >= 35) counts['35+'] += 1;
      }

      if (active) setAgeGroups(counts);
    }

    void loadAgeGroups();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadQuizAttempts() {
      const [countResult, attemptsResult] = await Promise.all([
        supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }),
        supabase
          .from('quiz_attempts')
          .select('id, score, total_questions, percentage, chapter_number, created_at, profiles!quiz_attempts_student_id_fkey(name)')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (!active) return;

      if (countResult.error || attemptsResult.error) {
        setQuizAttemptsError(
          `Quiz results could not be loaded: ${countResult.error?.message || attemptsResult.error?.message}`,
        );
        return;
      }

      setQuizTakeCount(countResult.count ?? 0);
      setQuizAttempts(attemptsResult.data || []);
    }

    void loadQuizAttempts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPdcStats() {
      const [studentsResult, responsesResult] = await Promise.all([
        fetchAllRows(() => supabase.from('profiles').select('id').eq('role', 'student')),
        fetchAllRows(() => supabase.from('pdc_checklist_responses').select('student_id, item_id, result')),
      ]);

      if (!active) return;
      if (studentsResult.error || responsesResult.error) {
        setPdcStatsError(
          `PDC completion count could not be loaded: ${studentsResult.error?.message || responsesResult.error?.message}`,
        );
        return;
      }

      const studentIds = new Set((studentsResult.data || []).map((student) => student.id));
      const evaluatedItems = new Map();
      for (const response of responsesResult.data || []) {
        if (
          !studentIds.has(response.student_id)
          || !PDC_CHECKLIST_ITEM_IDS.has(response.item_id)
          || !['yes', 'no'].includes(response.result)
        ) continue;
        if (!evaluatedItems.has(response.student_id)) evaluatedItems.set(response.student_id, new Set());
        evaluatedItems.get(response.student_id).add(response.item_id);
      }

      setPdcStudentCount(studentIds.size);
      setPdcCompletedCount(
        [...evaluatedItems.values()].filter((items) => items.size >= PDC_CHECKLIST_ITEM_COUNT).length,
      );
    }

    void loadPdcStats();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="role-dashboard">
      <section className="role-welcome">
        <div>
          <span className="welcome-script">School overview</span>
          <h2>Welcome back, {profile?.name?.split(' ')[0] || 'Admin'}!</h2>
          <p>Manage your driving school from one place.</p>
        </div>
        <span className="welcome-stars" aria-hidden="true">★ ✦</span>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="dash-card student-progress-panel">
            <div className="card-heading">
              <h3>Game Progress &amp; Achievements</h3>
              <span>{studentProgressLive ? 'Live updates on' : 'Refreshes every 30 seconds'}</span>
            </div>
            {studentProgressError ? (
              <p role="alert" className="quiz-results-error">{studentProgressError}</p>
            ) : studentProgressLoading ? (
              <p className="quiz-results-empty">Loading student progress...</p>
            ) : studentProgress.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Progress</th>
                      <th>Achievements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProgress.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name || 'Student'}</td>
                        <td>{student.progress ?? 0}%</td>
                        <td>
                          {studentAchievementsLoading
                            ? 'Loading...'
                            : studentAchievementsError
                              ? 'Unavailable'
                              : `${studentAchievements[student.id] || 0}/${ACHIEVEMENTS.length}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="quiz-results-empty">Game progress will appear here when a student’s progress is recorded.</p>
            )}
            {studentAchievementsError && (
              <p role="alert" className="quiz-results-error">
                Student achievements could not be loaded: {studentAchievementsError}
              </p>
            )}
          </section>

          <div className="progress-cards admin-progress-cards">
            <ProgressCard
              icon="✓"
              count={pdcStatsError ? '—' : pdcCompletedCount}
              title="PDC Checklist Completed"
              hint={pdcStatsError ? 'Count unavailable' : `of ${pdcStudentCount} students`}
            />
          </div>

          <section className="dash-card age-distribution">
            <div className="card-heading">
              <h3>Student Age Distribution</h3>
              <span>{Object.values(ageGroups).reduce((sum, count) => sum + count, 0)} students with age data</span>
            </div>
            {ageGroupsError ? (
              <p role="alert" className="quiz-results-error">{ageGroupsError}</p>
            ) : (
              <div className="age-distribution-content">
                <div className="age-pie-wrap">
                  <div
                    className="age-pie-chart"
                    role="img"
                    aria-label={`Student age groups: ${Object.entries(ageGroups).map(([group, count]) => `${group}: ${count}`).join(', ')}`}
                    aria-describedby={agePieHover ? 'age-pie-tooltip' : undefined}
                    style={{ background: getAgeGroupGradient(ageGroups) }}
                    onMouseMove={handleAgePieMouseMove}
                    onMouseLeave={() => setAgePieHover(null)}
                  />
                  {agePieHover && (
                    <div
                      id="age-pie-tooltip"
                      className="age-pie-tooltip"
                      role="tooltip"
                      style={{ left: agePieHover.x, top: agePieHover.y }}
                    >
                      <span>{agePieHover.group} years</span>
                      <strong>
                        {agePieHover.count} {agePieHover.count === 1 ? 'student' : 'students'} ({agePieHover.percentage.toFixed(1)}%)
                      </strong>
                    </div>
                  )}
                </div>
                <ul className="age-pie-legend">
                  {Object.entries(ageGroups).map(([group, count]) => (
                    <li key={group}>
                      <span className="age-pie-swatch" style={{ background: AGE_GROUP_COLORS[group] }} />
                      <span>{group} years</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          {pdcStatsError && <p role="alert" className="quiz-results-error">{pdcStatsError}</p>}

          <section className="dash-card quiz-results-panel">
            <div className="card-heading">
              <h3>Quiz Results</h3>
              <span>{quizTakeCount} total takes</span>
            </div>
            {quizAttemptsError ? (
              <p role="alert" className="quiz-results-error">{quizAttemptsError}</p>
            ) : quizAttempts.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Chapter</th>
                      <th>Score</th>
                      <th>Result</th>
                      <th>Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizAttempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{attempt.profiles?.name || 'Student'}</td>
                        <td>{attempt.chapter_number ? `Chapter ${attempt.chapter_number}` : '—'}</td>
                        <td>{attempt.score}/{attempt.total_questions}</td>
                        <td>{attempt.percentage}%</td>
                        <td>{new Date(attempt.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="quiz-results-empty">No quiz attempts have been recorded yet.</p>
            )}
          </section>

        </div>

        <div className="dashboard-aside">
          <Calendar />
          <section className="dash-card aside-card">
            <h3>Announcement</h3>
            <p>Keep student accounts and quiz content up to date.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();

  return profile?.role === 'student'
    ? <StudentDashboard profile={profile} />
    : <AdminDashboard profile={profile} />;
}