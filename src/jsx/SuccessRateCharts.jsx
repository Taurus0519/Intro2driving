import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { fetchAllRows, summarizeSuccess } from '../js/learningStats.mjs';
import '../css/SuccessRateCharts.css';

export function SuccessRateCard({ title, rows, maximumField, loading, error, color, quiz = false }) {
  const summary = summarizeSuccess(rows, maximumField);
  const hasData = summary.percentage !== null;
  const percentage = hasData ? summary.percentage.toFixed(1) : null;
  const available = !loading && !error && hasData;
  const earnedLabel = quiz ? 'Correct answers' : 'Points earned';
  const remainingLabel = quiz ? 'Incorrect answers' : 'Points missed';

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
                    ? `${title}: ${percentage}% success. ${earnedLabel}: ${summary.earned}. ${remainingLabel}: ${summary.remaining}.`
                    : `No ${title.toLowerCase()} results recorded yet.`}
                  style={{ background: available
                    ? `conic-gradient(${color} 0% ${summary.percentage}%, #e5edf3 ${summary.percentage}% 100%)`
                    : '#e5edf3' }} />
                <div className="success-rate-summary">
                  <strong>{available ? `${percentage}%` : '—'}</strong>
                  <span>{available ? `${summary.attempts} recorded ${summary.attempts === 1 ? 'attempt' : 'attempts'}` : 'No results yet'}</span>
                </div>
              </div>
              <ul className="success-pie-legend">
                <li><span className="success-swatch" style={{ background: color }} />{earnedLabel}<strong>{summary.earned}</strong></li>
                <li><span className="success-swatch remaining" />{remainingLabel}<strong>{summary.remaining}</strong></li>
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

export default function SuccessRateCharts({ studentId }) {
  const [results, setResults] = useState({ gameRows: [], quizRows: [], loading: true });
  useEffect(() => {
    let active = true;
    let pending = false;
    setResults({ gameRows: [], quizRows: [], loading: true });
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const [gameResult, quizResult] = await Promise.allSettled([
          fetchAllRows(() => {
            let query = supabase.from('game_scores').select('score, max_score').order('recorded_at').order('id');
            if (studentId) query = query.eq('player_id', studentId);
            return query;
          }),
          fetchAllRows(() => {
            let query = supabase.from('quiz_attempts').select('score, total_questions').order('created_at').order('id');
            if (studentId) query = query.eq('student_id', studentId);
            return query;
          }),
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
  }, [studentId]);

  return (
    <section className="dashboard-success" aria-label="Learning success rates">
      <div className="card-heading"><h3>{studentId ? 'Your Success Rates' : 'Student Success Rates'}</h3>
        <span>{studentId ? 'Your recorded results' : 'All students · All recorded results'}</span></div>
      <SuccessRateSummary {...results} />
      <p className="success-rate-caption">Success rate = total points earned ÷ total possible points across all recorded attempts. Updates every 30 seconds.</p>
    </section>
  );
}
