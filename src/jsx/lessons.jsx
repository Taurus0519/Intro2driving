import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAunth";
import { supabase } from "./supabase_Client";
import {
  MAX_QUIZ_ATTEMPTS,
  QUIZ_PASSING_PERCENT,
} from "../js/quizAttemptStats.mjs";
import "../css/Quiz.css";

const ATTACHMENT_BUCKET = "quiz-question-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const QUESTIONS_PER_QUIZ = 10;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const emptyForm = {
  id: null,
  question: "",
  chapterNumber: 1,
  options: ["", "", "", ""],
  correctIndex: 0,
  imagePath: null,
  imageFile: null,
  removeImage: false,
};

function getImageUrl(path) {
  return path
    ? supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path).data.publicUrl
    : "";
}

function shuffleQuestions(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function countChapterAttempts(attempts, chapterNumber) {
  return attempts.filter(
    (attempt) => Number(attempt.chapter_number) === chapterNumber,
  ).length;
}

export default function Lessons() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isStudent = profile?.role === "student";
  const [questions, setQuestions] = useState([]);
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [completedChapters, setCompletedChapters] = useState([]);
  const [loadingChapterProgress, setLoadingChapterProgress] = useState(true);
  const [chapterProgressError, setChapterProgressError] = useState("");
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [loadingQuizAttemptCount, setLoadingQuizAttemptCount] = useState(true);
  const [quizAttemptCountError, setQuizAttemptCountError] = useState("");
  const [checkingQuizAttemptCount, setCheckingQuizAttemptCount] =
    useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [imageAttachmentsEnabled, setImageAttachmentsEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submissionLocked = useRef(false);
  const submissionId = useRef(null);
  const [submitError, setSubmitError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    if (!form.imageFile) {
      setImagePreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(form.imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [form.imageFile]);

  useEffect(() => {
    async function loadQuestions() {
      setLoadingQuestions(true);
      setQuestionError("");

      let { data, error } = await supabase
        .from("quiz_questions")
        .select(
          "id, question, options, correct_index, image_path, chapter_number",
        )
        .order("created_at", { ascending: true });

      if (error?.code === "42703") {
        setImageAttachmentsEnabled(false);
        const fallback = await supabase
          .from("quiz_questions")
          .select("id, question, options, correct_index, chapter_number")
          .order("created_at", { ascending: true });
        data = fallback.data;
        error = fallback.error;
      } else if (!error) {
        setImageAttachmentsEnabled(true);
      }

      if (error) {
        setQuestionError(
          `Quiz questions could not be loaded: ${error.message}. Confirm that supabase/quiz_chapters.sql has been run.`,
        );
      } else {
        setQuestions(
          data.map(
            ({
              correct_index: correctIndex,
              image_path: imagePath,
              chapter_number: chapterNumber,
              ...question
            }) => ({
              ...question,
              correctIndex,
              imagePath,
              chapterNumber,
            }),
          ),
        );
      }

      setLoadingQuestions(false);
    }

    loadQuestions();
  }, []);

  useEffect(() => {
    if (!isStudent || !profile?.id) {
      setLoadingChapterProgress(false);
      return undefined;
    }

    let active = true;

    async function loadChapterProgress() {
      setLoadingChapterProgress(true);
      setChapterProgressError("");
      const { data, error } = await supabase
        .from("quiz_chapter_progress")
        .select("chapter_number")
        .eq("student_id", profile.id);

      if (!active) return;
      if (error) {
        setChapterProgressError(
          `Chapter progress could not be loaded: ${error.message}. Confirm that supabase/quiz_chapters.sql has been run.`,
        );
      } else {
        setCompletedChapters(
          data.map(({ chapter_number: chapterNumber }) => chapterNumber),
        );
      }
      setLoadingChapterProgress(false);
    }

    void loadChapterProgress();
    return () => {
      active = false;
    };
  }, [isStudent, profile?.id]);

  useEffect(() => {
    if (!isStudent || !profile?.id) {
      setLoadingQuizAttemptCount(false);
      return undefined;
    }

    let active = true;
    async function loadAttemptCount() {
      setLoadingQuizAttemptCount(true);
      setQuizAttemptCountError("");
      let attempts = null;
      let error = null;
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.access_token)
          throw new Error("Your session has expired. Sign in again.");
        const response = await fetch("/api/student-quiz-attempts", {
          headers: {
            Authorization: ["Bearer", session.access_token].join(" "),
          },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            result?.error || "Quiz attempts could not be loaded.",
          );
        if (!Array.isArray(result?.attempts))
          throw new Error("Quiz attempts returned invalid data.");
        attempts = result.attempts;
      } catch (loadError) {
        error = loadError;
      }

      if (!active) return;
      if (error) {
        setQuizAttemptCountError(
          `Quiz attempt limit could not be checked: ${error.message || "Please try again."}`,
        );
      } else {
        setQuizAttempts(attempts);
        setQuizAttemptCountError("");
      }
      setLoadingQuizAttemptCount(false);
    }

    void loadAttemptCount();
    return () => {
      active = false;
    };
  }, [isStudent, profile?.id]);

  async function refreshQuizAttemptCount() {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token)
        throw new Error("Your session has expired. Sign in again.");
      const response = await fetch("/api/student-quiz-attempts", {
        headers: { Authorization: ["Bearer", session.access_token].join(" ") },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.error || "Quiz attempts could not be loaded.");
      if (!Array.isArray(result?.attempts))
        throw new Error("Quiz attempts returned invalid data.");
      setQuizAttempts(result.attempts);
      setQuizAttemptCountError("");
      return result.attempts;
    } catch (error) {
      setQuizAttemptCountError(
        `Quiz attempt limit could not be checked: ${error.message || "Please try again."}`,
      );
      return null;
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
    setQuestionError("");
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
      setQuestionError(
        "Run supabase/quiz_question_images.sql in the Supabase SQL Editor to enable quiz image attachments.",
      );
      return;
    }

    setSavingQuestion(true);
    setQuestionError("");

    let uploadedImagePath = null;
    if (form.imageFile) {
      const safeName = form.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
      chapter_number: form.chapterNumber,
      ...(imageAttachmentsEnabled
        ? {
            image_path: form.removeImage
              ? null
              : uploadedImagePath || form.imagePath,
          }
        : {}),
    };

    const query = form.id
      ? supabase.from("quiz_questions").update(questionData).eq("id", form.id)
      : supabase.from("quiz_questions").insert(questionData);
    const { data, error } = await query
      .select(
        imageAttachmentsEnabled
          ? "id, question, options, correct_index, image_path, chapter_number"
          : "id, question, options, correct_index, chapter_number",
      )
      .single();
    setSavingQuestion(false);

    if (error) {
      let cleanupNote = "";
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove([uploadedImagePath]);
        if (cleanupError)
          cleanupNote = ` The uploaded image could not be cleaned up: ${cleanupError.message}`;
      }
      setQuestionError(
        `Question could not be saved: ${error.message}${cleanupNote}`,
      );
      return;
    }

    const oldImagePath = form.imagePath;
    const savedQuestion = {
      ...data,
      correctIndex: data.correct_index,
      imagePath: data.image_path,
      chapterNumber: data.chapter_number,
    };
    setQuestions((current) => {
      if (form.id) {
        return current.map((question) =>
          question.id === form.id ? savedQuestion : question,
        );
      }
      return [...current, savedQuestion];
    });
    resetForm();

    if (oldImagePath && oldImagePath !== data.image_path) {
      const { error: cleanupError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([oldImagePath]);
      if (cleanupError) {
        setQuestionError(
          `Question saved, but its previous image could not be removed: ${cleanupError.message}`,
        );
      }
    }
  }

  function editQuestion(question) {
    setForm({
      id: question.id,
      question: question.question,
      chapterNumber: question.chapterNumber,
      options: [...question.options],
      correctIndex: question.correctIndex,
      imagePath: question.imagePath || null,
      imageFile: null,
      removeImage: false,
    });
    setShowForm(true);
  }

  async function deleteQuestion(id) {
    setQuestionError("");
    const question = questions.find((item) => item.id === id);
    const { error } = await supabase
      .from("quiz_questions")
      .delete()
      .eq("id", id);
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
        setQuestionError(
          `Question deleted, but its image could not be removed: ${attachmentError.message}`,
        );
      }
    }
  }

  async function submitQuiz(e) {
    if (e) e.preventDefault();

    if (
      activeQuestions.length !== QUESTIONS_PER_QUIZ ||
      submitting ||
      submissionLocked.current ||
      !submissionId.current
    ) {
      return;
    }

    submissionLocked.current = true;
    setSubmitting(true);
    setSubmitError("");
    const currentSubmissionId = submissionId.current;
    let submitted = false;
    try {
      const attempts = await refreshQuizAttemptCount();
      if (attempts === null) {
        setSubmitError(
          "Your quiz result could not be saved because the attempt limit could not be verified. Please try again.",
        );
        return;
      }

      const { data, error } = await supabase.rpc("complete_quiz_chapter", {
        p_chapter_number: selectedChapter,
        p_answers: answers,
        p_submission_id: currentSubmissionId,
      });
      if (error) throw error;

      const savedAttempt = Array.isArray(data) ? data[0] : null;
      if (!savedAttempt) {
        throw new Error(
          "The chapter was submitted, but its result could not be returned. Refresh the page to check your progress.",
        );
      }

      setResult({
        score: savedAttempt.score,
        total: savedAttempt.total_questions,
        percentage: savedAttempt.percentage,
      });
      setQuizAttempts((current) =>
        current.some((attempt) => attempt.submission_id === currentSubmissionId)
          ? current
          : [
              ...current,
              {
                chapter_number: selectedChapter,
                score: savedAttempt.score,
                total_questions: savedAttempt.total_questions,
                submission_id: currentSubmissionId,
              },
            ],
      );
      setCompletedChapters((current) =>
        current.includes(selectedChapter)
          ? current
          : [...current, selectedChapter],
      );
      submitted = true;
    } catch (error) {
      setSubmitError(
        `Your quiz result could not be saved: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setSubmitting(false);
      if (!submitted) submissionLocked.current = false;
    }
  }

  const chapterCounts = Array.from(
    { length: 7 },
    (_, index) =>
      questions.filter((question) => question.chapterNumber === index + 1)
        .length,
  );
  const selectedChapterReady =
    chapterCounts[selectedChapter - 1] >= QUESTIONS_PER_QUIZ;
  const selectedChapterAttemptCount = countChapterAttempts(
    quizAttempts,
    selectedChapter,
  );
  const attemptsRemaining = Math.max(
    0,
    MAX_QUIZ_ATTEMPTS - selectedChapterAttemptCount,
  );
  const currentQuestion = activeQuestions[currentIndex];
  const selectedAnswer = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;
  const nextActionLabel = submitting
    ? "Saving…"
    : currentIndex === activeQuestions.length - 1
      ? "Submit"
      : "Continue";

  function selectChapter(chapterNumber) {
    submissionLocked.current = false;
    submissionId.current = null;
    setSelectedChapter(chapterNumber);
    setActiveQuestions([]);
    setQuizStarted(false);
    setCurrentIndex(0);
    setAnswers({});
    setResult(null);
    setSubmitError("");
  }

  async function startChapterQuiz() {
    if (
      !selectedChapterReady ||
      checkingQuizAttemptCount ||
      loadingQuizAttemptCount
    )
      return;
    setCheckingQuizAttemptCount(true);
    setSubmitError("");
    const currentAttemptCount = await refreshQuizAttemptCount();
    setCheckingQuizAttemptCount(false);
    if (currentAttemptCount === null) return;
    if (
      countChapterAttempts(currentAttemptCount, selectedChapter) >=
      MAX_QUIZ_ATTEMPTS
    ) {
      return;
    }

    const chapterQuestions = questions.filter(
      (question) => question.chapterNumber === selectedChapter,
    );
    if (chapterQuestions.length < QUESTIONS_PER_QUIZ) return;

    setActiveQuestions(
      shuffleQuestions(chapterQuestions).slice(0, QUESTIONS_PER_QUIZ),
    );
    setAnswers({});
    setCurrentIndex(0);
    setSubmitError("");
    submissionLocked.current = false;
    submissionId.current = crypto.randomUUID();
    setQuizStarted(true);
  }

  async function moveNext() {
    if (!currentQuestion || selectedAnswer === undefined) return;

    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    await submitQuiz();
  }

  return (
    <>
      <div className="toolbar">
        {isAdmin && !loadingQuestions && (
          <button
            type="button"
            className="button primary small-button"
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
          >
            {showForm ? "Cancel" : "+ Add question"}
          </button>
        )}
      </div>

      {questionError && (
        <p role="alert" className="panel">
          {questionError}
        </p>
      )}
      {chapterProgressError && (
        <p role="alert" className="panel">
          {chapterProgressError}
        </p>
      )}
      {loadingQuestions && <p className="panel">Loading quiz questions...</p>}
      {isStudent && loadingChapterProgress && (
        <p className="panel">Loading chapter progress...</p>
      )}
      {isAdmin && !loadingQuestions && !imageAttachmentsEnabled && (
        <p className="panel" role="status">
          Run supabase/quiz_question_images.sql in the Supabase SQL Editor to
          enable image attachments.
        </p>
      )}

      {isAdmin && showForm && (
        <form
          className="panel"
          onSubmit={saveQuestion}
          style={{ marginBottom: 20 }}
        >
          <label>
            Question{" "}
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              rows={3}
              required
            />
          </label>

          <label>
            Chapter
            <select
              value={form.chapterNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  chapterNumber: Number(event.target.value),
                }))
              }
            >
              {chapterCounts.map((count, index) => {
                const chapterNumber = index + 1;
                return (
                  <option key={chapterNumber} value={chapterNumber}>
                    Chapter {chapterNumber} ({count}{" "}
                    {count === 1 ? "question" : "questions"})
                  </option>
                );
              })}
            </select>
          </label>

          <div className="quiz-image-field">
            <label htmlFor="quiz-image-upload">
              Image attachment (optional)
            </label>
            <input
              id="quiz-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={!imageAttachmentsEnabled}
              onChange={(event) => {
                const imageFile = event.target.files?.[0] || null;
                if (!imageFile) return;
                if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
                  event.target.value = "";
                  setQuestionError("Choose a JPEG, PNG, WebP, or GIF image.");
                  return;
                }
                if (imageFile.size > MAX_IMAGE_SIZE) {
                  event.target.value = "";
                  setQuestionError("The image must be 5 MB or smaller.");
                  return;
                }
                setQuestionError("");
                setForm((current) => ({
                  ...current,
                  imageFile,
                  removeImage: false,
                }));
              }}
            />
            {(imagePreviewUrl || (!form.removeImage && form.imagePath)) && (
              <div className="quiz-image-preview">
                <img
                  src={imagePreviewUrl || getImageUrl(form.imagePath)}
                  alt="Question attachment preview"
                />
              </div>
            )}
            {form.imagePath && !form.imageFile && (
              <label className="quiz-image-remove">
                <input
                  type="checkbox"
                  checked={form.removeImage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      removeImage: event.target.checked,
                    }))
                  }
                />
                Remove current image
              </label>
            )}
          </div>

          {form.options.map((option, index) => (
            <label key={`option-${index}`}>
              {String.fromCharCode(97 + index).toUpperCase()} option
              <input
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                required
              />
            </label>
          ))}

          <label>
            Correct answer{" "}
            <select
              value={form.correctIndex}
              onChange={(e) =>
                setForm({ ...form, correctIndex: Number(e.target.value) })
              }
            >
              {form.options.map((option, index) => (
                <option key={`answer-${index}`} value={index}>
                  {String.fromCharCode(97 + index).toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="button primary"
            disabled={savingQuestion}
          >
            {savingQuestion
              ? "Saving..."
              : form.id
                ? "Update question"
                : "Save question"}
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
            {Array.from({ length: 7 }, (_, chapterIndex) => {
              const chapterNumber = chapterIndex + 1;
              const chapterQuestions = questions.filter(
                (question) => question.chapterNumber === chapterNumber,
              );
              return (
                <tbody key={chapterNumber}>
                  <tr className="quiz-chapter-heading">
                    <th colSpan="5">
                      Chapter {chapterNumber}{" "}
                      <span>
                        {chapterQuestions.length}{" "}
                        {chapterQuestions.length === 1
                          ? "question"
                          : "questions"}
                      </span>
                    </th>
                  </tr>
                  {chapterQuestions.length ? (
                    chapterQuestions.map((question, index) => (
                      <tr key={question.id}>
                        <td>{index + 1}</td>
                        <td>
                          {question.question}
                          {question.imagePath && (
                            <div className="quiz-image-indicator">
                              Image attached
                            </div>
                          )}
                        </td>
                        <td>{question.options.join(" / ")}</td>
                        <td>{question.options[question.correctIndex]}</td>
                        <td>
                          <button
                            type="button"
                            className="button small-button"
                            onClick={() => editQuestion(question)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button small-button"
                            onClick={() => deleteQuestion(question.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        No questions assigned to this chapter yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {isStudent &&
        !loadingQuestions &&
        !loadingChapterProgress &&
        !questionError &&
        !chapterProgressError && (
          <>
            {quizAttemptCountError && (
              <p className="error" role="alert">
                {quizAttemptCountError}
              </p>
            )}
            <section className="quiz-chapter-list" aria-label="Quiz chapters">
              {chapterCounts.map((count, index) => {
                const chapterNumber = index + 1;
                const completed = completedChapters.includes(chapterNumber);
                const unlocked =
                  chapterNumber === 1 ||
                  completedChapters.includes(chapterNumber - 1);
                const ready = count >= QUESTIONS_PER_QUIZ;
                return (
                  <button
                    key={chapterNumber}
                    type="button"
                    className={`quiz-chapter-option${selectedChapter === chapterNumber ? " selected" : ""}`}
                    disabled={!unlocked || !ready}
                    onClick={() => selectChapter(chapterNumber)}
                    aria-current={
                      selectedChapter === chapterNumber ? "step" : undefined
                    }
                  >
                    <strong>Chapter {chapterNumber}</strong>
                    <span>
                      {completed
                        ? "Completed"
                        : !unlocked
                          ? "Locked"
                          : `${count}/${QUESTIONS_PER_QUIZ} questions`}
                    </span>
                  </button>
                );
              })}
            </section>

            {!quizStarted && !result && (
              <section className="quiz-start-card panel">
                <h3>Chapter {selectedChapter}</h3>
                {loadingQuizAttemptCount ? (
                  <p role="status">Checking quiz attempts...</p>
                ) : (
                  <p>
                    Chapter attempts remaining: {attemptsRemaining} of{" "}
                    {MAX_QUIZ_ATTEMPTS}.
                  </p>
                )}
                <p>
                  {!selectedChapterReady
                    ? `This chapter needs ${QUESTIONS_PER_QUIZ - chapterCounts[selectedChapter - 1]} more ${QUESTIONS_PER_QUIZ - chapterCounts[selectedChapter - 1] === 1 ? "question" : "questions"} before it is available.`
                    : completedChapters.includes(selectedChapter)
                      ? "You have completed this chapter. You can take it again."
                      : `Complete all ${QUESTIONS_PER_QUIZ} questions to finish this chapter${selectedChapter < 7 ? " and unlock the next" : ""}.`}
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => void startChapterQuiz()}
                  disabled={
                    !selectedChapterReady ||
                    loadingQuizAttemptCount ||
                    Boolean(quizAttemptCountError) ||
                    selectedChapterAttemptCount >= MAX_QUIZ_ATTEMPTS ||
                    checkingQuizAttemptCount
                  }
                >
                  {checkingQuizAttemptCount
                    ? "Checking attempts..."
                    : completedChapters.includes(selectedChapter)
                      ? "Retake Chapter"
                      : "Start Chapter"}
                </button>
                {selectedChapterAttemptCount >= MAX_QUIZ_ATTEMPTS && (
                  <p role="status">
                    You have used all {MAX_QUIZ_ATTEMPTS} attempts for this
                    chapter.
                  </p>
                )}
              </section>
            )}
          </>
        )}

      {isStudent && quizStarted && currentQuestion && !result && (
        <div className="quiz-question-card">
          <p className="quiz-question-progress">
            Chapter {selectedChapter} · Question {currentIndex + 1} of{" "}
            {activeQuestions.length}
          </p>
          {currentQuestion.imagePath && (
            <div className="quiz-question-image">
              <img
                src={getImageUrl(currentQuestion.imagePath)}
                alt="Quiz question attachment"
              />
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
                  className={`quiz-answer-option${selectedAnswer === optionIndex ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={selectedAnswer === optionIndex}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [currentQuestion.id]: optionIndex,
                      }))
                    }
                  />
                  <span className="quiz-answer-letter">
                    {String.fromCharCode(97 + optionIndex)}
                  </span>
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
              {nextActionLabel === "Submit"
                ? "Submit Chapter"
                : nextActionLabel === "Continue"
                  ? "Continue"
                  : nextActionLabel}
            </button>
          </div>
          {submitError && (
            <p role="alert" style={{ color: "#b3261e", marginTop: 12 }}>
              {submitError}
            </p>
          )}
        </div>
      )}

      {isStudent && result && (
        <div className="panel quiz-result-card">
          <h3>Chapter {selectedChapter} complete</h3>
          <p style={{ fontSize: 20, margin: "0 0 8px" }}>
            Result:{" "}
            <strong>
              {result.percentage >= QUIZ_PASSING_PERCENT ? "PASS" : "FAIL"}
            </strong>
          </p>
          <p style={{ margin: "0 0 12px" }}>
            Passing score: {QUIZ_PASSING_PERCENT}%.
          </p>
          <button
            type="button"
            className="button primary"
            onClick={() =>
              selectChapter(
                selectedChapter < 7 ? selectedChapter + 1 : selectedChapter,
              )
            }
          >
            {selectedChapter < 7 ? "Continue to chapters" : "Back to chapters"}
          </button>
        </div>
      )}
    </>
  );
}
