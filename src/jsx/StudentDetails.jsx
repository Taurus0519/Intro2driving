import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from './supabase_Client';
import { ACHIEVEMENTS } from '../js/achievementData';
import { PDC_CHECKLIST_ITEMS, PDC_CHECKLIST_ITEM_COUNT } from '../js/pdcChecklistData';
import { QUIZ_PASSING_PERCENT } from '../js/quizAttemptStats.mjs';
import { SuccessRateSummary } from './SuccessRateCharts';
import '../css/StudentDetails.css';

function displayDate(value, includeTime = false) {
  if (!value) return 'Not provided';
  const date = new Date(includeTime ? value : `${String(value).split('T')[0]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

function SectionError({ message }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}

export default function StudentDetails() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    async function load() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch(`/api/student-details?studentId=${encodeURIComponent(studentId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.student) throw new Error(result?.error || 'Student details could not be loaded.');
        if (active) setData(result);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Student details could not be loaded.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [studentId, reload]);

  const { student, details = {}, gameScores = [], quizAttempts = [], achievements = [], pdcResponses = [], errors = {} } = data || {};
  const earned = ACHIEVEMENTS.filter((achievement) => achievements.some((award) => award.achievement_id === achievement.id));
  const requiredItems = PDC_CHECKLIST_ITEMS.filter((item) => !item.optional);
  const answeredItems = requiredItems.filter((item) => pdcResponses.some((response) => response.item_id === item.id && ['yes', 'no'].includes(response.result)));

  return (
    <div className="student-details-page">
      <div className="toolbar">
        <div><Link className="student-name-link" to="/students">← Back to students</Link>
          <h3>{student?.name || 'Student details'}</h3><p>Profile, learning results, and course progress.</p></div>
        <button type="button" className="button small-button" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh details</button>
      </div>
      {loading && <p className="panel" role="status">Loading student details...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {student && !loading && <>
        <section className="panel student-info-panel" aria-label="Student information">
          <div className="student-details-heading"><h3>Student Information</h3>
            <span className={`status ${student.status === 'Active' ? 'active' : 'inactive'}`}>{student.status || 'Unknown'}</span></div>
          <dl className="student-details-grid">
            {[
              ['First Name', student.firstName || null], ['Last Name', student.lastName || null],
              ['Email', student.email], ['Username', student.username],
              ['Nickname', details.nickname], ['Age', details.age], ['Gender', details.gender],
              ['Date of birth', displayDate(details.date_of_birth)], ['Address', details.address],
              ['Game progress', student.progress != null && Number.isFinite(Number(student.progress)) ? `${student.progress}%` : null],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not provided'}</dd></div>)}
          </dl>
          {details.about && <div className="student-details-text"><h4>About</h4><p>{details.about}</p></div>}
          {details.goals && <div className="student-details-text"><h4>Goals</h4><p>{details.goals}</p></div>}
          <SectionError message={errors.details} />
        </section>
        <SuccessRateSummary gameRows={gameScores} quizRows={quizAttempts} gameError={errors.gameScores} quizError={errors.quizAttempts} />
        <p className="success-rate-caption">Success rate = total points earned ÷ total possible points across this student's recorded attempts.</p>
        <div className="student-details-columns">
          <section className="panel">
            <h3>Game Scores</h3>
            <SectionError message={errors.gameScores} />
            {!errors.gameScores && (gameScores.length ? <div className="table-wrap student-detail-history"><table className="data-table">
              <thead><tr><th>Level</th><th>Score</th><th>Recorded</th></tr></thead>
              <tbody>{gameScores.map((score, index) => <tr key={`${score.level}-${score.recorded_at}-${index}`}>
                <td>Level {score.level}</td><td>{score.score}/{score.max_score}</td><td>{displayDate(score.recorded_at, true)}</td>
              </tr>)}</tbody>
            </table></div> : <p className="empty">No game scores recorded yet.</p>)}
          </section>
          <section className="panel">
            <h3>Quiz History</h3>
            <SectionError message={errors.quizAttempts} />
            {!errors.quizAttempts && (quizAttempts.length ? <div className="table-wrap student-detail-history"><table className="data-table">
              <thead><tr><th>Chapter</th><th>Pass / fail</th><th>Taken</th></tr></thead>
              <tbody>{quizAttempts.map((attempt) => <tr key={attempt.id}>
                <td>{attempt.chapter_number ? `Chapter ${attempt.chapter_number}` : '—'}</td>
                <td>{Number(attempt.total_questions) > 0
                  && (Number(attempt.score) / Number(attempt.total_questions)) * 100 >= QUIZ_PASSING_PERCENT
                  ? 'Pass'
                  : 'Fail'}</td>
                <td>{displayDate(attempt.created_at, true)}</td>
              </tr>)}</tbody>
            </table></div> : <p className="empty">No quizzes recorded yet.</p>)}
          </section>
          <section className="panel">
            <h3>Achievements {!errors.achievements && `(${earned.length}/${ACHIEVEMENTS.length})`}</h3>
            <SectionError message={errors.achievements} />
            {!errors.achievements && (earned.length ? <ul className="student-award-list">{earned.map((achievement) => {
              const award = achievements.find((item) => item.achievement_id === achievement.id);
              return <li key={achievement.id}><div><strong>{achievement.title}</strong>
                <small>Completed {displayDate(award.unlocked_at)}</small></div></li>;
            })}</ul> : <p className="empty">No achievements completed yet.</p>)}
          </section>
          <section className="panel">
            <h3>PDC Checklist</h3>
            <SectionError message={errors.pdcResponses} />
            {!errors.pdcResponses && <>
              <p>{answeredItems.length}/{PDC_CHECKLIST_ITEM_COUNT} required items evaluated · {answeredItems.length === PDC_CHECKLIST_ITEM_COUNT ? 'Completed' : 'In progress'}</p>
              <p>{pdcResponses.filter((item) => requiredItems.some((required) => required.id === item.item_id) && item.result === 'yes').length} Yes · {pdcResponses.filter((item) => requiredItems.some((required) => required.id === item.item_id) && item.result === 'no').length} No</p>
              <details className="student-pdc-details"><summary>View checklist results and remarks</summary>
                <div className="table-wrap student-detail-history"><table className="data-table">
                  <thead><tr><th>Item</th><th>Result</th><th>Remarks</th></tr></thead>
                  <tbody>{PDC_CHECKLIST_ITEMS.map((item) => {
                    const response = pdcResponses.find((entry) => entry.item_id === item.id);
                    return <tr key={item.id}><td>{item.label}{item.optional ? ' (optional)' : ''}</td>
                      <td>{response?.result === 'yes' ? 'Yes' : response?.result === 'no' ? 'No' : 'Not evaluated'}</td>
                      <td>{response?.remarks || '—'}</td></tr>;
                  })}</tbody>
                </table></div>
              </details>
              <Link className="student-name-link" to="/pdc-checklist">View PDC checklists →</Link>
            </>}
          </section>
        </div>
      </>}
    </div>
  );
}
