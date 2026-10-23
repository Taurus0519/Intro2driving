import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { fetchAllRows, summarizeSuccess } from '../js/learningStats.mjs';
import {
  getGameLevelBreakdown,
  getQuizChapterBreakdown,
  MAX_QUIZ_ATTEMPTS,
  QUIZ_PASSING_PERCENT,
  summarizeQuizAttempts,
} from '../js/quizAttemptStats.mjs';
import StudentPicker from './StudentPicker';
import '../css/SuccessRateCharts.css';

export function SuccessRateCard({
  title,
  rows,
  maximumField,
  loading,
  error,
  color,
  quiz = false,
  headerControl = null,
}) {
  const summary = quiz ? summarizeQuizAttempts(rows) : summarizeSuccess(rows, maximumField);
  const breakdown = quiz ? getQuizChapterBreakdown(rows) : getGameLevelBreakdown(rows, maximumField);
  const hasData = summary.percentage !== null;
  const percentage = hasData ? summary.percentage.toFixed(1) : null;
  const available = !loading && !error && hasData;
  const earnedLabel = quiz ? 'Passed attempts' : 'Points earned';
  const remainingLabel = quiz ? 'Failed attempts' : 'Points missed';
  const earnedCount = quiz ? summary.passed : summary.earned;
  const remainingCount = quiz ? summary.failed : summary.remaining;
  const rateLabel = quiz ? 'pass rate' : 'success';
  const attemptsLabel = `${summary.attempts} recorded ${summary.attempts === 1 ? 'attempt' : 'attempts'}`;
  const maximumBarValue = Math.max(...breakdown.map((item) => (
    quiz ? item.attempts : item.earned + item.missed
  )), 0);

  return (
    <section className="dash-card success-rate-card" aria-label={`${title} success rate`}>
      <div className={`card-heading success-rate-card-heading${headerControl ? ' has-control' : ''}`}>
        <h3>{title} Success Rate</h3>
        {headerControl}
      </div>
      {loading ? <p className="success-rate-message" role="status">Loading results...</p>
        : error ? <p className="quiz-results-error" role="alert">{error}</p>
          : (
            <>
              <div className="success-rate-content">
                <div className="success-rate-summary">
                  <strong>{available ? `${percentage}%` : '—'}</strong>
                  <span>{available ? attemptsLabel : 'No results yet'}</span>
                </div>
              </div>
              {available && breakdown.length > 0 && maximumBarValue > 0 ? (
                <div className="success-chart" role="img"
                  aria-label={`${title} vertical stacked bar chart. ${breakdown.map((item) => (
                    `${item.label}: ${item.attempts} ${item.attempts === 1 ? 'attempt' : 'attempts'}, ${quiz
                      ? `${item.passed} passed and ${item.failed} failed`
                      : `${item.earned} points earned and ${item.missed} points missed`}`
                  )).join('. ')}.`}>
                  <div className="success-chart-columns">
                    {breakdown.map((item) => {
                      const earned = quiz ? item.passed : item.earned;
                      const remaining = quiz ? item.failed : item.missed;
                      const total = quiz ? item.attempts : earned + remaining;
                      return (
                        <div className="success-chart-column" key={item.label}>
                          <span className="success-chart-attempts">
                            {item.attempts} {item.attempts === 1 ? 'attempt' : 'attempts'}
                          </span>
                          <div className="success-chart-plot">
                            {total > 0 && <div className="success-chart-bar" title={`${item.label}: ${item.attempts} attempts`}
                              style={{ height: `${(total / maximumBarValue) * 100}%` }}>
                            <span className="success-chart-segment missed"
                              style={{ height: `${total ? (remaining / total) * 100 : 0}%` }}
                              title={`${remaining} ${remainingLabel.toLowerCase()}`} />
                            <span className="success-chart-segment earned"
                              style={{ height: `${total ? (earned / total) * 100 : 0}%`, backgroundColor: color }}
                              title={`${earned} ${earnedLabel.toLowerCase()}`} />
                            </div>}
                          </div>
                          <span className="success-chart-label">{quiz ? item.label : <strong>{item.label}</strong>}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : !hasData ? (
                <p className="success-rate-caption">Results will appear after a recorded {title.toLowerCase()} attempt.</p>
              ) : null}
              <ul className="success-chart-legend">
                <li><span className="success-swatch" style={{ background: color }} />{earnedLabel}<strong>{earnedCount}</strong></li>
                <li><span className={`success-swatch ${quiz ? 'failed' : 'remaining'}`} />{remainingLabel}<strong>{remainingCount}</strong></li>
              </ul>
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
  const [selectedGameStudentId, setSelectedGameStudentId] = useState('');
  const [selectedQuizStudentId, setSelectedQuizStudentId] = useState('');
  const gameStudentId = studentId || selectedGameStudentId;
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
              .select('student_id, score, total_questions, chapter_number')
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
            let query = supabase.from('game_scores').select('player_id, level, score, max_score').order('recorded_at').order('id');
            if (gameStudentId) query = query.eq('player_id', gameStudentId);
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
  }, [studentId, gameStudentId, selectedQuizStudentId]);

  return (
    <section className="dashboard-success" aria-label="Learning success rates">
      <div className="card-heading"><h3>{studentId ? 'Your Success Rates' : 'Student Success Rates'}</h3>
        <span>{studentId
          ? 'Your recorded results'
          : selectedGameStudentId || selectedQuizStudentId
            ? 'Filtered by selected student'
            : 'All students · All recorded results'}</span></div>
      <div className="success-rate-grid">
        <SuccessRateCard
          title={gameStudentId && !studentId
            ? `${students.find((student) => student.id === gameStudentId)?.name || 'Student'} Game`
            : 'Game'}
          rows={results.gameRows}
          maximumField="max_score"
          loading={results.loading}
          error={results.gameError}
          color="#176ca6"
          headerControl={!studentId && (
            <StudentPicker
              id="game-success-student"
              className="quiz-success-student-picker"
              label="Student"
              students={students}
              value={selectedGameStudentId}
              onChange={setSelectedGameStudentId}
              placeholder="All students"
              itemLabel="student"
            />
          )}
        />
        <SuccessRateCard
          title={quizStudentId && !studentId
            ? `${students.find((student) => student.id === quizStudentId)?.name || 'Student'} Quiz`
            : 'Quiz'}
          rows={results.quizRows}
          loading={results.loading}
          error={results.quizError}
          color="#14947e"
          quiz
          headerControl={!studentId && (
            <StudentPicker
              id="quiz-success-student"
              className="quiz-success-student-picker"
              label="Student"
              students={students}
              value={selectedQuizStudentId}
              onChange={setSelectedQuizStudentId}
              placeholder="All students"
              itemLabel="student"
            />
          )}
        />
      </div>
      <p className="success-rate-caption">
        Quiz pass rate counts attempts scoring at least {QUIZ_PASSING_PERCENT}%; each student can take up to {MAX_QUIZ_ATTEMPTS} attempts across all chapters. Updates every 30 seconds.
      </p>
    </section>
  );
}
