export const QUIZ_PASSING_PERCENT = 50;
export const MAX_QUIZ_ATTEMPTS = 5;

export function summarizeQuizAttempts(rows, {
  passingPercent = QUIZ_PASSING_PERCENT,
  maximumAttempts = MAX_QUIZ_ATTEMPTS,
} = {}) {
  const attemptsByStudent = new Map();
  for (const row of rows || []) {
    if (row.score == null || row.total_questions == null) continue;
    const score = Number(row.score);
    const total = Number(row.total_questions);
    if (!Number.isFinite(score) || !Number.isFinite(total)
      || total <= 0 || score < 0 || score > total) continue;
    const studentKey = row.student_id || '__single_student__';
    const attempts = attemptsByStudent.get(studentKey) || [];
    attempts.push(row);
    attemptsByStudent.set(studentKey, attempts);
  }

  const validAttempts = [...attemptsByStudent.values()]
    .flatMap((attempts) => attempts.slice(-maximumAttempts));
  const passed = validAttempts.reduce((count, row) => (
    count + ((Number(row.score) / Number(row.total_questions)) * 100 >= passingPercent ? 1 : 0)
  ), 0);
  const failed = validAttempts.length - passed;
  return {
    passed,
    failed,
    attempts: validAttempts.length,
    percentage: validAttempts.length ? (passed / validAttempts.length) * 100 : null,
  };
}
