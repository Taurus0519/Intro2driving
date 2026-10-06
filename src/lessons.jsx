import { useEffect, useState } from 'react';
import { useAuth } from './useAunth';
import { supabase } from './supabase_Client';

const STORAGE_KEY = 'riteway-quiz-questions';

const defaultQuestions = [
  {
    id: 'quiz-1',
    question: 'What is the safest action when driving in wet conditions?',
    options: [
      'Speed up to reach your destination faster',
      'Slow down and increase your following distance',
      'Ignore the road conditions',
      'Brake hard at every turn',
    ],
    correctIndex: 1,
  },
  {
    id: 'quiz-2',
    question: 'What should you do before changing lanes?',
    options: [
      'Signal, check mirrors, and look over your shoulder',
      'Turn without warning',
      'Change lanes immediately without checking',
      'Only check your mirrors',
    ],
    correctIndex: 0,
  },
];

const emptyForm = { id: null, question: '', options: ['', '', '', ''], correctIndex: 0 };

function loadQuestions() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultQuestions;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultQuestions;
  } catch {
    return defaultQuestions;
  }
}

export default function Lessons() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const isStudent = profile?.role === 'student';
  const [questions, setQuestions] = useState(() => loadQuestions());
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  }, [questions]);

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

  function handleOptionChange(index, value) {
    setForm((current) => {
      const nextOptions = [...current.options];
      nextOptions[index] = value;
      return { ...current, options: nextOptions };
    });
  }

  function saveQuestion(e) {
    e.preventDefault();
    const trimmedQuestion = form.question.trim();
    const cleanedOptions = form.options.map((option) => option.trim());

    if (!trimmedQuestion || cleanedOptions.some((option) => !option)) {
      return;
    }

    const nextQuestion = {
      id: form.id || `quiz-${Date.now()}`,
      question: trimmedQuestion,
      options: cleanedOptions,
      correctIndex: form.correctIndex,
    };

    setQuestions((current) => {
      if (form.id) {
        return current.map((question) => (question.id === form.id ? nextQuestion : question));
      }
      return [...current, nextQuestion];
    });

    resetForm();
  }

  function editQuestion(question) {
    setForm({
      id: question.id,
      question: question.question,
      options: [...question.options],
      correctIndex: question.correctIndex,
    });
    setShowForm(true);
  }

  function deleteQuestion(id) {
    setQuestions((current) => current.filter((question) => question.id !== id));
  }

  async function submitQuiz(e) {
    if (e) e.preventDefault();

    if (!questions.length || submitting) {
      return;
    }

    let score = 0;
    questions.forEach((question) => {
      if (answers[question.id] === question.correctIndex) {
        score += 1;
      }
    });

    const attemptResult = {
      score,
      total: questions.length,
      percentage: Math.round((score / questions.length) * 100),
    };

    setSubmitting(true);
    setSubmitError('');
    let errorMessage = '';
    try {
      const { error } = await supabase.from('quiz_attempts').insert({
        student_id: profile.id,
        score: attemptResult.score,
        total_questions: attemptResult.total,
        percentage: attemptResult.percentage,
      });
      errorMessage = error?.message || '';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      setSubmitting(false);
    }

    if (errorMessage) {
      setSubmitError(`Your quiz result could not be saved: ${errorMessage}`);
      return;
    }

    setResult(attemptResult);
  }

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  function moveNext() {
    if (!currentQuestion || selectedAnswer === undefined) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    submitQuiz();
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h3>Quiz</h3>
          <p>{isAdmin ? 'Edit quiz questions and answer keys.' : 'Take the latest driver safety quiz.'}</p>
        </div>
        {isAdmin && (
          <button type="button" className="button primary small-button" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            {showForm ? 'Cancel' : '+ Add question'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form className="panel" onSubmit={saveQuestion} style={{ marginBottom: 20 }}>
          <label>
            Question
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              rows={3}
              required
            />
          </label>

          {form.options.map((option, index) => (
            <label key={`option-${index}`}>
              Option {index + 1}
              <input
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                required
              />
            </label>
          ))}

          <label>
            Correct answer
            <select
              value={form.correctIndex}
              onChange={(e) => setForm({ ...form, correctIndex: Number(e.target.value) })}
            >
              {form.options.map((option, index) => (
                <option key={`answer-${index}`} value={index}>
                  Option {index + 1}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="button primary">
            {form.id ? 'Update question' : 'Save question'}
          </button>
        </form>
      )}

      {isAdmin && (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Options</th>
                <th>Correct answer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question, index) => (
                <tr key={question.id}>
                  <td>{index + 1}</td>
                  <td>{question.question}</td>
                  <td>{question.options.join(' / ')}</td>
                  <td>{question.options[question.correctIndex]}</td>
                  <td>
                    <button type="button" className="button small-button" onClick={() => editQuestion(question)}>
                      Edit
                    </button>
                    <button type="button" className="button small-button" onClick={() => deleteQuestion(question.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isStudent && currentQuestion && !result && (
        <div
          className="panel"
          style={{
            maxWidth: 760,
            margin: '0 auto',
            background: '#fff',
            border: '1px solid #dadce0',
            borderRadius: 8,
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgb(60 64 67 / 15%)',
          }}
        >
          <div style={{ marginBottom: 18, fontSize: 18, lineHeight: 1.5, color: '#202124' }}>
            {currentQuestion.question}
            <span aria-label="required" style={{ color: '#d93025', marginLeft: 4 }}>*</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {currentQuestion.options.map((option, optionIndex) => {
              return (
                <label
                  key={`${currentQuestion.id}-${optionIndex}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    minHeight: 44,
                    padding: '6px 0',
                    color: '#202124',
                    fontSize: 16,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={selectedAnswer === optionIndex}
                    onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }))}
                    style={{
                      width: 20,
                      height: 20,
                      margin: '0 12px 0 0',
                      accentColor: '#1a73e8',
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 18 }}>
            <button
              type="button"
              onClick={moveNext}
              disabled={selectedAnswer === undefined || submitting}
              style={{
                appearance: 'none',
                border: 'none',
                borderRadius: 8,
                background: selectedAnswer === undefined || submitting ? '#9ab8d0' : '#0d7ab8',
                color: '#fff',
                fontSize: 18,
                fontWeight: 700,
                padding: '10px 22px',
                cursor: selectedAnswer === undefined || submitting ? 'not-allowed' : 'pointer',
                minWidth: 150,
              }}
            >
              {submitting ? 'Saving…' : currentIndex === questions.length - 1 ? 'Submit' : 'Continue'} <span aria-hidden="true">›</span>
            </button>
          </div>
          {submitError && <p role="alert" style={{ color: '#b3261e', marginTop: 12 }}>{submitError}</p>}
        </div>
      )}

      {isStudent && result && (
        <div className="panel" style={{ maxWidth: 700, margin: '0 auto', background: '#f6f5f2', border: '1px solid #d9d7d2', borderRadius: 12, padding: 32 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Quiz complete</h3>
          <p style={{ fontSize: 20, margin: '0 0 8px' }}>Your score: <strong>{result.score}/{result.total}</strong></p>
          <p style={{ fontSize: 18, margin: 0 }}>{result.percentage}% correct</p>
        </div>
      )}
    </>
  );
}