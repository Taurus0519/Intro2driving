import { useEffect, useState } from 'react';
import { useAuth } from './useAunth';
import { supabase } from './supabase_Client';
import './Quiz.css';

const ATTACHMENT_BUCKET = 'quiz-question-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const emptyForm = {
  id: null,
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  imagePath: null,
  imageFile: null,
  removeImage: false,
};

function getImageUrl(path) {
  return path ? supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path).data.publicUrl : '';
}

export default function Lessons() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const isStudent = profile?.role === 'student';
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [imageAttachmentsEnabled, setImageAttachmentsEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  useEffect(() => {
    if (!form.imageFile) {
      setImagePreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(form.imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [form.imageFile]);

  useEffect(() => {
    async function loadQuestions() {
      setLoadingQuestions(true);
      setQuestionError('');

      let { data, error } = await supabase
        .from('quiz_questions')
        .select('id, question, options, correct_index, image_path')
        .order('created_at', { ascending: true });

      if (error?.code === '42703') {
        setImageAttachmentsEnabled(false);
        const fallback = await supabase
          .from('quiz_questions')
          .select('id, question, options, correct_index')
          .order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      } else if (!error) {
        setImageAttachmentsEnabled(true);
      }

      if (error) {
        setQuestionError(`Quiz questions could not be loaded: ${error.message}`);
      } else {
        setQuestions(data.map(({ correct_index: correctIndex, image_path: imagePath, ...question }) => ({
          ...question,
          correctIndex,
          imagePath,
        })));
      }

      setLoadingQuestions(false);
    }

    loadQuestions();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
    setQuestionError('');
  }

  function handleOptionChange(index, value) {
    setForm((current) => {
      const nextOptions = [...current.options];
      nextOptions[index] = value;
      return { ...current, options: nextOptions };
    });
  }

  async function saveQuestion(e) {
    e.preventDefault();
    const trimmedQuestion = form.question.trim();
    const cleanedOptions = form.options.map((option) => option.trim());

    if (!trimmedQuestion || cleanedOptions.some((option) => !option)) {
      return;
    }
    if (!imageAttachmentsEnabled && (form.imageFile || form.removeImage)) {
      setQuestionError('Run supabase/quiz_question_images.sql in the Supabase SQL Editor to enable quiz image attachments.');
      return;
    }

    setSavingQuestion(true);
    setQuestionError('');

    let uploadedImagePath = null;
    if (form.imageFile) {
      const safeName = form.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      uploadedImagePath = `${profile.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(uploadedImagePath, form.imageFile, {
          contentType: form.imageFile.type,
          upsert: false,
        });

      if (uploadError) {
        setQuestionError(`Image could not be uploaded: ${uploadError.message}`);
        setSavingQuestion(false);
        return;
      }
    }

    const questionData = {
      question: trimmedQuestion,
      options: cleanedOptions,
      correct_index: form.correctIndex,
      ...(imageAttachmentsEnabled
        ? { image_path: form.removeImage ? null : uploadedImagePath || form.imagePath }
        : {}),
    };

    const query = form.id
      ? supabase.from('quiz_questions').update(questionData).eq('id', form.id)
      : supabase.from('quiz_questions').insert(questionData);
    const { data, error } = await query
      .select(imageAttachmentsEnabled
        ? 'id, question, options, correct_index, image_path'
        : 'id, question, options, correct_index')
      .single();
    setSavingQuestion(false);

    if (error) {
      let cleanupNote = '';
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove([uploadedImagePath]);
        if (cleanupError) cleanupNote = ` The uploaded image could not be cleaned up: ${cleanupError.message}`;
      }
      setQuestionError(`Question could not be saved: ${error.message}${cleanupNote}`);
      return;
    }

    const oldImagePath = form.imagePath;
    const savedQuestion = {
      ...data,
      correctIndex: data.correct_index,
      imagePath: data.image_path,
    };
    setQuestions((current) => {
      if (form.id) {
        return current.map((question) => (question.id === form.id ? savedQuestion : question));
      }
      return [...current, savedQuestion];
    });
    resetForm();

    if (oldImagePath && oldImagePath !== data.image_path) {
      const { error: cleanupError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([oldImagePath]);
      if (cleanupError) {
        setQuestionError(`Question saved, but its previous image could not be removed: ${cleanupError.message}`);
      }
    }
  }

  function editQuestion(question) {
    setForm({
      id: question.id,
      question: question.question,
      options: [...question.options],
      correctIndex: question.correctIndex,
      imagePath: question.imagePath || null,
      imageFile: null,
      removeImage: false,
    });
    setShowForm(true);
  }

  async function deleteQuestion(id) {
    setQuestionError('');
    const question = questions.find((item) => item.id === id);
    const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
    if (error) {
      setQuestionError(`Question could not be deleted: ${error.message}`);
      return;
    }

    setQuestions((current) => current.filter((question) => question.id !== id));
    if (question?.imagePath) {
      const { error: attachmentError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([question.imagePath]);
      if (attachmentError) {
        setQuestionError(`Question deleted, but its image could not be removed: ${attachmentError.message}`);
      }
    }
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
  const nextActionLabel = submitting ? 'Saving…' : currentIndex === questions.length - 1 ? 'Submit' : 'Continue';

  async function moveNext() {
    if (!currentQuestion || selectedAnswer === undefined) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    await submitQuiz();
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h3>Quiz</h3>
          <p>{isAdmin ? 'Manage quiz questions and answer keys.' : 'Take the latest driver safety quiz.'}</p>
        </div>
        {isAdmin && !loadingQuestions && (
          <button type="button" className="button primary small-button" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            {showForm ? 'Cancel' : '+ Add question'}
          </button>
        )}
      </div>

      {questionError && <p role="alert" className="panel">{questionError}</p>}
      {loadingQuestions && <p className="panel">Loading quiz questions...</p>}
      {isAdmin && !loadingQuestions && !imageAttachmentsEnabled && (
        <p className="panel" role="status">
          Run supabase/quiz_question_images.sql in the Supabase SQL Editor to enable image attachments.
        </p>
      )}

      {isAdmin && showForm && (
        <form className="panel" onSubmit={saveQuestion} style={{ marginBottom: 20 }}>
          <label>
            Question{" "}
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              rows={3}
              required
            />
          </label>

          <div className="quiz-image-field">
            <label htmlFor="quiz-image-upload">Image attachment (optional)</label>
            <input
              id="quiz-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={!imageAttachmentsEnabled}
              onChange={(event) => {
                const imageFile = event.target.files?.[0] || null;
                if (!imageFile) return;
                if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
                  event.target.value = '';
                  setQuestionError('Choose a JPEG, PNG, WebP, or GIF image.');
                  return;
                }
                if (imageFile.size > MAX_IMAGE_SIZE) {
                  event.target.value = '';
                  setQuestionError('The image must be 5 MB or smaller.');
                  return;
                }
                setQuestionError('');
                setForm((current) => ({ ...current, imageFile, removeImage: false }));
              }}
            />
            {(imagePreviewUrl || (!form.removeImage && form.imagePath)) && (
              <div className="quiz-image-preview">
                <img src={imagePreviewUrl || getImageUrl(form.imagePath)} alt="Question attachment preview" />
              </div>
            )}
            {form.imagePath && !form.imageFile && (
              <label className="quiz-image-remove">
                <input
                  type="checkbox"
                  checked={form.removeImage}
                  onChange={(event) => setForm((current) => ({ ...current, removeImage: event.target.checked }))}
                />
                Remove current image
              </label>
            )}
          </div>

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
            Correct answer {' '}
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

          <button type="submit" className="button primary" disabled={savingQuestion}>
            {savingQuestion ? 'Saving...' : form.id ? 'Update question' : 'Save question'}
          </button>
        </form>
      )}

      {isAdmin && !loadingQuestions && (
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
              {questions.length ? questions.map((question, index) => (
                  <tr key={question.id}>
                    <td>{index + 1}</td>
                    <td>
                      {question.question}
                      {question.imagePath && <div className="quiz-image-indicator">Image attached</div>}
                    </td>
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
                )) : (
                  <tr><td colSpan="5">No quiz questions yet. Add the first question to publish the quiz.</td></tr>
                )}
            </tbody>
          </table>
        </div>
      )}

      {isStudent && !loadingQuestions && !questionError && !questions.length && (
        <div className="panel">The quiz is not available yet. Please check back later.</div>
      )}

      {isStudent && !loadingQuestions && !questionError && questions.length > 0 && !quizStarted && !result && (
        <section className="quiz-start-card panel">
          <h3>Ready to take the quiz?</h3>
          <p>This quiz has {questions.length} {questions.length === 1 ? 'question' : 'questions'}.</p>
          <button type="button" className="button primary" onClick={() => setQuizStarted(true)}>
            Start Quiz
          </button>
        </section>
      )}

      {isStudent && quizStarted && currentQuestion && !result && (
        <div className="quiz-question-card">
          {currentQuestion.imagePath && (
            <div className="quiz-question-image">
              <img src={getImageUrl(currentQuestion.imagePath)} alt="Quiz question attachment" />
            </div>
          )}
          <div className="quiz-question-text">
            {currentQuestion.question}
            <span aria-label="required">*</span>
          </div>

          <div className="quiz-answer-list">
            {currentQuestion.options.map((option, optionIndex) => {
              return (
                <label
                  key={`${currentQuestion.id}-${optionIndex}`}
                  className={`quiz-answer-option${selectedAnswer === optionIndex ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={selectedAnswer === optionIndex}
                    onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }))}
                  />
                  <span className="quiz-answer-letter">{String.fromCharCode(65 + optionIndex)}</span>
                  <span>{option}</span>
                </label>
              );
            })}
          </div>

          <div className="quiz-answer-actions">
            <button
              type="button"
              onClick={moveNext}
              disabled={selectedAnswer === undefined || submitting}
            >
              {submitting ? 'Saving…' : currentIndex === questions.length - 1 ? 'Submit Answer' : 'Continue'}
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