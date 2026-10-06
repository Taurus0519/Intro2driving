import Calendar from './Calendar';
import { useEffect, useState } from 'react';
import './Dashboard.css';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth.jsx';

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

function StudentDashboard({ profile }) {
  const [progress, setProgress] = useState({ quizzes: 0 });

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
            <span>0% complete</span>
          </div>

          <div className="progress-cards">
            <ProgressCard
              icon="✓"
              count={progress.quizzes}
              title="Quizzes Completed"
              hint="Start your first quiz!"
            />
          </div>

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
    'Under 18': 0,
    '18-24': 0,
    '25-34': 0,
    '35+': 0,
  });
  const [quizTakeCount, setQuizTakeCount] = useState(0);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [quizAttemptsError, setQuizAttemptsError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAgeGroups() {
      const [{ data: students }, { data: studentProfiles }] = await Promise.all([
        supabase.from('profiles').select('id').eq('role', 'student'),
        supabase.from('student_profiles').select('student_id, age'),
      ]);
      const counts = { 'Under 18': 0, '18-24': 0, '25-34': 0, '35+': 0 };
      const studentIds = new Set((students || []).map((student) => student.id));

      for (const studentProfile of studentProfiles || []) {
        const age = Number(studentProfile.age);
        if (!studentIds.has(studentProfile.student_id) || studentProfile.age == null || !Number.isFinite(age) || age < 0) continue;
        if (age < 18) counts['Under 18'] += 1;
        else if (age <= 24) counts['18-24'] += 1;
        else if (age <= 34) counts['25-34'] += 1;
        else counts['35+'] += 1;
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
          .select('id, score, total_questions, percentage, created_at, profiles!quiz_attempts_student_id_fkey(name)')
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
          <div className="progress-heading">
            <h3>Student Age Groups</h3>
          </div>

          <div className="progress-cards">
            {Object.entries(ageGroups).map(([group, count]) => (
              <ProgressCard key={group} icon="◷" count={count} title={group} hint="Students" />
            ))}
          </div>

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
                      <th>Score</th>
                      <th>Result</th>
                      <th>Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizAttempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{attempt.profiles?.name || 'Student'}</td>
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