import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { fetchAllRows, summarizeSuccess } from '../js/learningStats.mjs';
import { MAX_QUIZ_ATTEMPTS, QUIZ_PASSING_PERCENT, summarizeQuizAttempts } from '../js/quizAttemptStats.mjs';
import StudentPicker from './StudentPicker';
import '../css/SuccessRateCharts.css';

export function SuccessRateCard({ title, rows, maximumField, loading, error, color, quiz = false }) {
  const summary = quiz ? summarizeQuizAttempts(rows) : summarizeSuccess(rows, maximumField);
  const hasData = summary.percentage !== null;
  const percentage = hasData ? summary.percentage.toFixed(1) : null;
  const available = !loading && !error && hasData;
  const earnedLabel = quiz ? 'Passed attempts' : 'Points earned';
  const remainingLabel = quiz ? 'Failed attempts' : 'Points missed';
  const earnedCount = quiz ? summary.passed : summary.earned;
  const remainingCount = quiz ? summary.failed : summary.remaining;
  const rateLabel = quiz ? 'pass rate' : 'success';
  const attemptsLabel = `${summary.attempts} recorded ${summary.attempts === 1 ? 'attempt' : 'attempts'}`;

  return (
    <section className="dash-card success-rate-card" aria-label={`${title} success rate`}>
      <div className="card-heading"><h3>{title} Success Rate</h3></div>
      {loading ? <p className="success-rate-message" role="status">Loading results...</p>
        : error ? <p className="quiz-results-error" role="alert">{error}</p>
          : (
            <>
              <div className="success-rate-content">
                <div className="success-pie" role="img"
                  aria-label={available
                    ? `${title}: ${percentage}% ${rateLabel}. ${earnedLabel}: ${earnedCount}. ${remainingLabel}: ${remainingCount}.`
                    : `No ${title.toLowerCase()} results recorded yet.`}
                  style={{ background: available
                    ? `conic-gradient(${color} 0% ${summary.percentage}%, #e5edf3 ${summary.percentage}% 100%)`
                    : '#e5edf3' }} />
                <div className="success-rate-summary">
                  <strong>{available ? `${percentage}%` : '—'}</strong>
                  <span>{available ? attemptsLabel : 'No results yet'}</span>
                </div>
              </div>
              <ul className="success-pie-legend">
                <li><span className="success-swatch" style={{ background: color }} />{earnedLabel}<strong>{earnedCount}</strong></li>
                <li><span className={`success-swatch ${quiz ? 'failed' : 'remaining'}`} />{remainingLabel}<strong>{remainingCount}</strong></li>
              </ul>
              {!hasData && <p className="success-rate-caption">Results will appear after a recorded {title.toLowerCase()} attempt.</p>}
            </>
          )}
    </section>
  );
}

export function SuccessRateSummary({ gameRows, quizRows, loading = false, gameError = '', quizError = '' }) {
  return (
    <div className="success-rate-grid">
      <SuccessRateCard title="Game" rows={gameRows} maximumField="max_score" loading={loading} error={gameError} color="#176ca6" />
      <SuccessRateCard title="Quiz" rows={quizRows} maximumField="total_questions" loading={loading} error={quizError} color="#14947e" quiz />
    </div>
  );
}

export default function SuccessRateCharts({ studentId, students = [] }) {
  const [results, setResults] = useState({ gameRows: [], quizRows: [], loading: true });
  const [selectedQuizStudentId, setSelectedQuizStudentId] = useState('');
  const quizStudentId = studentId || selectedQuizStudentId;

  useEffect(() => {
    let active = true;
    let pending = false;
    setResults({ gameRows: [], quizRows: [], loading: true });
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const quizRequest = async () => {
          if (!studentId) {
            let query = supabase.from('quiz_attempts')
              .select('student_id, score, total_questions')
              .order('created_at')
              .order('id');
            if (selectedQuizStudentId) query = query.eq('student_id', selectedQuizStudentId);
            return fetchAllRows(() => query);
          }

          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

          const response = await fetch('/api/student-quiz-attempts', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const result = await response.json().catch(() => null);
          if (!response.ok) throw new Error(result?.error || 'Quiz results could not be loaded.');
          return { data: result?.attempts || [], error: null };
        };
        const [gameResult, quizResult] = await Promise.allSettled([
          fetchAllRows(() => {
            let query = supabase.from('game_scores').select('score, max_score').order('recorded_at').order('id');
            if (studentId) query = query.eq('player_id', studentId);
            return query;
          }),
          quizRequest(),
        ]);
        const game = gameResult.status === 'fulfilled' ? gameResult.value : { error: gameResult.reason };
        const quiz = quizResult.status === 'fulfilled' ? quizResult.value : { error: quizResult.reason };
        if (active) setResults({
          gameRows: game.data || [], quizRows: quiz.data || [], loading: false,
          gameError: game.error ? 'Game results could not be loaded. Try refreshing the page.' : '',
          quizError: quiz.error ? 'Quiz results could not be loaded. Try refreshing the page.' : '',
        });
      } finally { pending = false; }
    }
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [studentId, selectedQuizStudentId]);

  return (
    <section className="dashboard-success" aria-label="Learning success rates">
      <div className="card-heading"><h3>{studentId ? 'Your Success Rates' : 'Student Success Rates'}</h3>
        <span>{studentId
          ? 'Your recorded results'
          : selectedQuizStudentId
            ? 'Game results are for all students; quiz results are filtered'
            : 'All students · All recorded results'}</span></div>
      {!studentId && (
        <StudentPicker
          id="quiz-success-student"
          className="quiz-success-student-picker"
          label="Quiz success rate for"
          students={students}
          value={selectedQuizStudentId}
          onChange={setSelectedQuizStudentId}
          placeholder="All students"
          itemLabel="student"
        />
      )}
      {!studentId && selectedQuizStudentId && (
        <p className="success-rate-caption">
          Showing quiz pass/fail results for {students.find((student) => student.id === selectedQuizStudentId)?.name || 'selected student'}.
        </p>
      )}
      <div className="success-rate-grid">
        <SuccessRateCard title="Game" rows={results.gameRows} maximumField="max_score" loading={results.loading} error={results.gameError} color="#176ca6" />
        <SuccessRateCard
          title={quizStudentId && !studentId
            ? `${students.find((student) => student.id === quizStudentId)?.name || 'Student'} Quiz`
            : 'Quiz'}
          rows={results.quizRows}
          loading={results.loading}
          error={results.quizError}
          color="#14947e"
          quiz
        />
      </div>
      <p className="success-rate-caption">
        Quiz pass rate counts attempts scoring at least {QUIZ_PASSING_PERCENT}%; each student can take up to {MAX_QUIZ_ATTEMPTS} attempts across all chapters. Updates every 30 seconds.
      </p>
    </section>
  );
}
