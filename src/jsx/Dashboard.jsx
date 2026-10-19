import Calendar from './Calendar';
import { useEffect, useState } from 'react';
import '../css/Dashboard.css';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth.jsx';
import { ACHIEVEMENTS } from '../js/achievementData';
import { Link } from 'react-router-dom';
import { PDC_CHECKLIST_ITEM_COUNT, PDC_CHECKLIST_ITEMS } from '../js/pdcChecklistData';
import SuccessRateCharts from './SuccessRateCharts';
import { fetchAllRows } from '../js/learningStats.mjs';
import { getProfileDisplayName } from '../js/profileIdentity.mjs';
import Pagination from './Pagination';
import '../css/StudentDetails.css';

const PDC_CHECKLIST_ITEM_IDS = new Set(
  PDC_CHECKLIST_ITEMS.filter((item) => !item.optional).map((item) => item.id),
);
const STUDENT_PROGRESS_PAGE_SIZE = 10;
const AGE_GROUP_COLORS = {
  '16-17': '#3b82f6',
  '18-24': '#14b8a6',
  '25-34': '#f59e0b',
  '35+': '#8b5cf6',
};

function summarizeGameScores(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const latestByLevel = new Map();
  for (const row of rows) {
    const level = Number(row.level);
    const recordedAt = row.recorded_at ? new Date(row.recorded_at).getTime() : -Infinity;
    if (!Number.isFinite(level)) continue;

    const current = latestByLevel.get(level);
    if (!current || recordedAt > new Date(current.recorded_at || 0).getTime()) {
      latestByLevel.set(level, row);
    }
  }

  return [...latestByLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, row]) => ({ level, score: Number(row.score), maxScore: Number(row.max_score), recordedAt: row.recorded_at }));
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
  const [quizProgressError, setQuizProgressError] = useState('');
  const [gameProgress, setGameProgress] = useState(Number(profile?.progress) || 0);
  const [gameProgressError, setGameProgressError] = useState('');
  const [gameScores, setGameScores] = useState([]);
  const [gameScoresError, setGameScoresError] = useState('');
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
      const { count, error } = await supabase
        .from('quiz_chapter_progress')
        .select('chapter_number', { count: 'exact', head: true })
        .eq('student_id', profile.id);

      if (!active) return;
      if (error) {
        setQuizProgressError(`Quiz completion could not be loaded: ${error.message}`);
        return;
      }

      setProgress({ quizzes: count ?? 0 });
      setQuizProgressError('');
    }

    void loadProgress();
    const refreshInterval = window.setInterval(() => void loadProgress(), 30000);
    const channel = supabase
      .channel(`student-quiz-progress-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_chapter_progress', filter: `student_id=eq.${profile.id}` },
        () => void loadProgress(),
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

    async function loadGameScores() {
      const { data, error } = await supabase
        .from('game_scores')
        .select('level, score, max_score, recorded_at')
        .eq('player_id', profile.id)
        .order('recorded_at', { ascending: false });

      if (!active) return;
      if (error) {
        if (error.code === '42P01') {
          setGameScoresError('Game scores have not been configured in Supabase yet.');
        } else {
          setGameScoresError(`Game scores could not be loaded: ${error.message}`);
        }
        return;
      }

      setGameScores(summarizeGameScores(data || []));
      setGameScoresError('');
    }

    void loadGameScores();
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

  const welcomeName = getProfileDisplayName(profile, 'Student');

  return (
    <div className="student-dashboard">
      <section className="student-welcome">
        <div>
          <span className="welcome-script">Drive the right way</span>
          <h2>Welcome back, {welcomeName}!</h2>
          <p>Keep learning and build the confidence to drive safely.</p>
        </div>
        <span className="welcome-stars" aria-hidden="true">★ ✦</span>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <SuccessRateCharts studentId={profile.id} />
          <div className="progress-heading">
            <h3>Game Scores</h3>
            <span>{gameProgressError ? 'Progress unavailable' : `${gameProgress}% complete`}</span>
          </div>
          {gameProgressError && <p role="alert" className="quiz-results-error">{gameProgressError}</p>}
          {quizProgressError && <p role="alert" className="quiz-results-error">{quizProgressError}</p>}

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

          <section className="dash-card completed-achievements-panel">
            <div className="card-heading">
              <h3>Your Game Scores</h3>
            </div>
            {gameScoresError ? (
              <p role="alert" className="quiz-results-error">{gameScoresError}</p>
            ) : gameScores.length ? (
              <ul className="completed-achievements-list">
                {gameScores.map((item) => (
                  <li key={`level-${item.level}`} className="completed-achievement-item">
                    <div>
                      <strong>Level {item.level}</strong>
                      <small>{item.score}/{item.maxScore}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiz-results-empty">No game scores recorded yet.</p>
            )}
          </section>

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
  const [studentGameScores, setStudentGameScores] = useState({});
  const [studentGameScoresError, setStudentGameScoresError] = useState('');
  const [studentAchievements, setStudentAchievements] = useState({});
  const [studentAchievementsLoading, setStudentAchievementsLoading] = useState(true);
  const [studentAchievementsError, setStudentAchievementsError] = useState('');
  const [studentProgressLive, setStudentProgressLive] = useState(false);
  const [studentProgressPage, setStudentProgressPage] = useState(1);

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
      const [studentsResult, scoresResult, sessionResult] = await Promise.all([
        supabase.from('profiles').select('id, name, progress').eq('role', 'student').order('name'),
        fetchAllRows(() =>
          supabase
            .from('game_scores')
            .select('player_id, level, score, max_score, recorded_at')
            .order('recorded_at', { ascending: false })
        ),
        supabase.auth.getSession(),
      ]);
      if (!active) return;

      if (studentsResult.error) {
        setStudentProgressError(`Student progress could not be loaded: ${studentsResult.error.message}`);
      } else {
        setStudentProgress(studentsResult.data || []);
        setStudentProgressError('');
      }
      setStudentProgressLoading(false);

      if (scoresResult.error) {
        setStudentGameScoresError(
          scoresResult.error.code === '42P01'
            ? 'Game scores have not been configured in Supabase yet.'
            : `Game scores could not be loaded: ${scoresResult.error.message}`,
        );
      } else {
        const scoresByStudent = new Map();
        for (const row of scoresResult.data || []) {
          if (!row?.player_id) continue;
          const rows = scoresByStudent.get(row.player_id) || [];
          rows.push(row);
          scoresByStudent.set(row.player_id, rows);
        }
        setStudentGameScores(
          Object.fromEntries(
            [...scoresByStudent].map(([studentId, rows]) => [studentId, summarizeGameScores(rows)]),
          ),
        );
        setStudentGameScoresError('');
      }

      if (sessionResult.error || !sessionResult.data?.session?.access_token) {
        setStudentAchievementsError(
          sessionResult.error?.message || 'Your session has expired. Sign in again to view achievements.',
        );
        setStudentAchievementsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/achievement-progress', {
          headers: { Authorization: ['Bearer', sessionResult.data.session.access_token].join(' ') },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Achievement progress could not be loaded.');

        const knownAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
        const completedByStudent = new Map();
        for (const award of result?.awards || []) {
          if (!knownAchievementIds.has(award.achievement_id)) continue;
          const completed = completedByStudent.get(award.user_id) || [];
          completed.push(award);
          completedByStudent.set(award.user_id, completed);
        }
        if (active) {
          setStudentAchievements(
            Object.fromEntries([...completedByStudent]),
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_scores' }, () => {
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

  const studentProgressPageCount = Math.max(
    1,
    Math.ceil(studentProgress.length / STUDENT_PROGRESS_PAGE_SIZE),
  );
  const visibleStudentProgress = studentProgress.slice(
    (Math.min(studentProgressPage, studentProgressPageCount) - 1) * STUDENT_PROGRESS_PAGE_SIZE,
    Math.min(studentProgressPage, studentProgressPageCount) * STUDENT_PROGRESS_PAGE_SIZE,
  );

  useEffect(() => {
    let active = true;

    async function loadAgeGroups() {
      if (!active) return;

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

        const response = await fetch('/api/student-age-distribution', {
          headers: { Authorization: ['Bearer', session.access_token].join(' ') },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || 'Student age distribution could not be loaded.');
        }
        if (!result?.ageGroups || !Object.values(result.ageGroups).every(Number.isFinite)) {
          throw new Error('Student age distribution returned invalid data.');
        }

        if (active) {
          setAgeGroups(result.ageGroups);
          setAgeGroupsError('');
        }
      } catch (error) {
        if (active) {
          setAgeGroupsError(error.message || 'Student age distribution could not be loaded.');
        }
      }
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
          .select('id, student_id, score, total_questions, percentage, chapter_number, created_at, profiles!quiz_attempts_student_id_fkey(name)')
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
          <h2>Welcome back, {getProfileDisplayName(profile, 'Admin')}!</h2>
          <p>Manage your driving school from one place.</p>
        </div>
        <span className="welcome-stars" aria-hidden="true">★ ✦</span>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <SuccessRateCharts />
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
          <section className="dash-card student-progress-panel">
            <div className="card-heading">
              <h3>Student Progress &amp; Earned Achievements</h3>
              <span>{studentProgressLive ? 'Live updates on' : 'Refreshes every 30 seconds'}</span>
            </div>
            {studentProgressError ? (
              <p role="alert" className="quiz-results-error">{studentProgressError}</p>
            ) : studentProgressLoading ? (
              <p className="quiz-results-empty">Loading student progress...</p>
            ) : studentProgress.length ? (
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
                      {visibleStudentProgress.map((student) => (
                        <tr key={student.id}>
                          <td><Link className="student-name-link" to={`/students/${student.id}`}>{student.name || 'Student'}</Link></td>
                          <td>
                            {studentGameScoresError
                              ? 'Unavailable'
                              : studentGameScores[student.id]?.length
                                ? studentGameScores[student.id]
                                  .map((score) => `Level ${score.level}: ${score.score}/${score.maxScore}`)
                                  .join(', ')
                                : 'No scores yet'}
                          </td>
                          <td>
                            {studentAchievementsLoading
                              ? 'Loading...'
                              : studentAchievementsError
                                ? 'Unavailable'
                                : studentAchievements[student.id]?.length
                                  ? (
                                    <ul className="student-earned-achievements">
                                      {studentAchievements[student.id].map((award) => {
                                        const achievement = ACHIEVEMENTS.find((item) => item.id === award.achievement_id);
                                        return (
                                          <li key={award.achievement_id}>
                                            <span>
                                              <strong>{achievement.title}</strong>
                                              <small>Completed {new Date(award.unlocked_at).toLocaleDateString()}</small>
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )
                                  : 'No achievements completed yet'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={Math.min(studentProgressPage, studentProgressPageCount)}
                  pageSize={STUDENT_PROGRESS_PAGE_SIZE}
                  totalItems={studentProgress.length}
                  onPageChange={setStudentProgressPage}
                />
              </>
            ) : (
              <p className="quiz-results-empty">No students are registered yet.</p>
            )}
            {studentAchievementsError && (
              <p role="alert" className="quiz-results-error">
                Student achievements could not be loaded: {studentAchievementsError}
              </p>
            )}
            {studentGameScoresError && (
              <p role="alert" className="quiz-results-error">
                {studentGameScoresError}
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
                        <td><Link className="student-name-link" to={`/students/${attempt.student_id}`}>{attempt.profiles?.name || 'Student'}</Link></td>
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
          <Calendar isStaff />
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
