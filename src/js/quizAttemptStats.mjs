export const QUIZ_PASSING_PERCENT = 50;
export const MAX_QUIZ_ATTEMPTS = 5;

export function getCountedQuizAttempts(
  rows,
  {
    passingPercent = QUIZ_PASSING_PERCENT,
    maximumAttempts = MAX_QUIZ_ATTEMPTS,
  } = {},
) {
  const attemptsByStudent = new Map();
  for (const row of rows || []) {
    if (row.score == null || row.total_questions == null) continue;
    const score = Number(row.score);
    const total = Number(row.total_questions);
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(total) ||
      total <= 0 ||
      score < 0 ||
      score > total
    )
      continue;
    const studentKey = row.student_id || "__single_student__";
    const attempts = attemptsByStudent.get(studentKey) || [];
    attempts.push(row);
    attemptsByStudent.set(studentKey, attempts);
  }

  return [...attemptsByStudent.values()].flatMap((attempts) => {
    const haveTimestamps = attempts.every((row) =>
      Number.isFinite(Date.parse(row.created_at)),
    );
    const orderedAttempts = haveTimestamps
      ? [...attempts].sort(
          (first, second) =>
            Date.parse(first.created_at) - Date.parse(second.created_at) ||
            String(first.id ?? "").localeCompare(String(second.id ?? "")),
        )
      : attempts;
    return orderedAttempts.slice(-maximumAttempts);
  });
}

export function summarizeQuizAttempts(rows, options = {}) {
  const { passingPercent = QUIZ_PASSING_PERCENT } = options;
  const validAttempts = getCountedQuizAttempts(rows, options);
  const passed = validAttempts.reduce(
    (count, row) =>
      count +
      ((Number(row.score) / Number(row.total_questions)) * 100 >= passingPercent
        ? 1
        : 0),
    0,
  );
  const failed = validAttempts.length - passed;
  return {
    passed,
    failed,
    attempts: validAttempts.length,
    percentage: validAttempts.length
      ? (passed / validAttempts.length) * 100
      : null,
  };
}

export function getQuizChapterBreakdown(rows, options = {}) {
  const chapters = new Map();
  for (const row of getCountedQuizAttempts(rows, options)) {
    const chapter = Number(row.chapter_number);
    const chapterKey =
      Number.isInteger(chapter) && chapter > 0 ? chapter : "other";
    const values = chapters.get(chapterKey) || {
      label: chapterKey === "other" ? "Other" : `Chapter ${chapterKey}`,
      passed: 0,
      failed: 0,
      attempts: 0,
    };
    const passed =
      (Number(row.score) / Number(row.total_questions)) * 100 >=
      (options.passingPercent ?? QUIZ_PASSING_PERCENT);
    values[passed ? "passed" : "failed"] += 1;
    values.attempts += 1;
    chapters.set(chapterKey, values);
  }
  return [...chapters.entries()]
    .sort(
      ([first], [second]) =>
        (first === "other" ? Infinity : first) -
        (second === "other" ? Infinity : second),
    )
    .map(([, values]) => values);
}

export function getGameLevelBreakdown(rows, maximumField = "max_score") {
  const levels = new Map(
    Array.from({ length: 6 }, (_, index) => [
      index + 1,
      {
        label: `Level ${index + 1}`,
        earned: 0,
        missed: 0,
        attempts: 0,
      },
    ]),
  );
  for (const row of rows || []) {
    const score = Number(row.score);
    const maximum = Number(row[maximumField]);
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(maximum) ||
      maximum <= 0 ||
      score < 0 ||
      score > maximum
    )
      continue;
    const level = Number(row.level);
    if (level === 7) continue;
    const levelKey = Number.isInteger(level) && level > 0 ? level : "other";
    const values = levels.get(levelKey) || {
      label: levelKey === "other" ? "Other" : `Level ${levelKey}`,
      earned: 0,
      missed: 0,
      attempts: 0,
    };
    values.earned += score;
    values.missed += maximum - score;
    values.attempts += 1;
    levels.set(levelKey, values);
  }
  return [...levels.entries()]
    .sort(
      ([first], [second]) =>
        (first === "other" ? Infinity : first) -
        (second === "other" ? Infinity : second),
    )
    .map(([, values]) => values);
}
