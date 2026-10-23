import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows, summarizeSuccess } from '../src/js/learningStats.mjs';
import { buildCourseCalendar, upcomingCourseSessions } from '../src/js/courseReminder.mjs';
import {
  getGameLevelBreakdown,
  getQuizChapterBreakdown,
  summarizeQuizAttempts,
} from '../src/js/quizAttemptStats.mjs';

test('success rates weight results by possible points, including repeat attempts', () => {
  const stats = summarizeSuccess([{ score: 1, total: 2 }, { score: 90, total: 100 }], 'total');
  assert.equal(stats.earned, 91);
  assert.equal(stats.possible, 102);
  assert.equal(stats.remaining, 11);
  assert.equal(stats.attempts, 2);
  assert.equal(stats.percentage.toFixed(1), '89.2');
});

test('no results and a recorded zero score are distinct', () => {
  assert.equal(summarizeSuccess([], 'max_score').percentage, null);
  const stats = summarizeSuccess([{ score: 0, max_score: 10 }], 'max_score');
  assert.equal(stats.percentage, 0);
  assert.equal(stats.attempts, 1);
  assert.equal(summarizeSuccess([{ score: 10, max_score: 10 }], 'max_score').percentage, 100);
});

test('invalid scores do not corrupt success percentages', () => {
  const stats = summarizeSuccess([
    { score: 5, max_score: 10 }, { score: null, max_score: 10 },
    { score: -1, max_score: 10 }, { score: 11, max_score: 10 },
    { score: 1, max_score: 0 }, { score: 'invalid', max_score: 10 },
  ], 'max_score');
  assert.equal(stats.percentage, 50);
  assert.equal(stats.attempts, 1);
});

test('quiz rates classify 50 percent as pass and count attempts rather than answers', () => {
  const summary = summarizeQuizAttempts([
    { score: 5, total_questions: 10 },
    { score: 4, total_questions: 10 },
    { score: 10, total_questions: 10 },
    { score: 0, total_questions: 0 },
  ]);
  assert.deepEqual(
    { passed: summary.passed, failed: summary.failed, attempts: summary.attempts },
    { passed: 2, failed: 1, attempts: 3 },
  );
  assert.equal(summary.percentage.toFixed(1), '66.7');
});

test('quiz attempt rate includes at most the latest five attempts per student', () => {
  const rows = [
    { student_id: 'one', score: 10, total_questions: 10 },
    ...Array.from({ length: 5 }, () => ({ student_id: 'one', score: 0, total_questions: 10 })),
    { student_id: 'two', score: 5, total_questions: 10 },
  ];
  const summary = summarizeQuizAttempts(rows);
  assert.deepEqual(
    { passed: summary.passed, failed: summary.failed, attempts: summary.attempts },
    { passed: 1, failed: 5, attempts: 6 },
  );
  assert.equal(summary.percentage.toFixed(1), '16.7');
});

test('quiz chapter bars group passed and failed attempts after applying the course attempt limit', () => {
  const rows = [
    { student_id: 'one', chapter_number: 1, score: 10, total_questions: 10 },
    { student_id: 'one', chapter_number: 1, score: 0, total_questions: 10 },
    ...Array.from({ length: 4 }, () => ({
      student_id: 'one', chapter_number: 2, score: 5, total_questions: 10,
    })),
    { student_id: 'two', chapter_number: 2, score: 0, total_questions: 10 },
  ];
  assert.deepEqual(getQuizChapterBreakdown(rows), [
    { label: 'Chapter 1', passed: 0, failed: 1, attempts: 1 },
    { label: 'Chapter 2', passed: 4, failed: 1, attempts: 5 },
  ]);
});

test('quiz chapter bars count the latest attempts when results arrive newest first', () => {
  const rows = Array.from({ length: 6 }, (_, index) => ({
    id: String(index + 1),
    student_id: 'one',
    chapter_number: index === 0 ? 1 : 2,
    score: index === 0 ? 10 : 0,
    total_questions: 10,
    created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  })).reverse();
  assert.deepEqual(getQuizChapterBreakdown(rows), [
    { label: 'Chapter 2', passed: 0, failed: 5, attempts: 5 },
  ]);
});

test('game level bars show points earned, points missed, and valid attempt totals', () => {
  assert.deepEqual(getGameLevelBreakdown([
    { level: 2, score: 8, max_score: 10 },
    { level: 1, score: 0, max_score: 5 },
    { level: 2, score: 4, max_score: 10 },
    { level: 1, score: 6, max_score: 5 },
    { level: 7, score: 3, max_score: 5 },
  ]), [
    { label: 'Level 1', earned: 0, missed: 5, attempts: 1 },
    { label: 'Level 2', earned: 12, missed: 8, attempts: 2 },
    { label: 'Level 3', earned: 0, missed: 0, attempts: 0 },
    { label: 'Level 4', earned: 0, missed: 0, attempts: 0 },
    { label: 'Level 5', earned: 0, missed: 0, attempts: 0 },
    { label: 'Level 6', earned: 0, missed: 0, attempts: 0 },
  ]);
});

test('dashboard totals include results beyond the default 1000-row page', async () => {
  const rows = Array.from({ length: 2003 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await fetchAllRows(() => ({ range: async (from, to) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  } }));
  assert.deepEqual(result.data, rows);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('a failed page never returns an incomplete total as a successful result', async () => {
  const error = { message: 'Unavailable' };
  const result = await fetchAllRows(() => ({ range: async (from) => from === 0
    ? { data: Array(1000).fill({}), error: null } : { data: null, error } }));
  assert.equal(result.data, null);
  assert.equal(result.error, error);
});

test('course reminder leaves unscheduled dates empty throughout a year', () => {
  for (let day = 1; day <= 366; day += 1) {
    const from = new Date(2028, 0, day, 23, 59);
    assert.deepEqual(upcomingCourseSessions([], from), []);
  }
});

test('saved calendar export crosses year boundaries and includes a reminder', () => {
  const content = buildCourseCalendar(new Date(2026, 11, 31, 13), [{ course_date: '2026-12-31', course_type: 'online' }]);
  assert.ok(content.includes('DTSTART;VALUE=DATE:20261231\r\n'));
  assert.ok(content.includes('DTEND;VALUE=DATE:20270101\r\n'));
  assert.ok(!content.includes('RRULE'));
  assert.ok(content.includes('TRIGGER:-P1D\r\n'));
  assert.ok(content.endsWith('END:VCALENDAR\r\n'));
  assert.ok(content.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  const unfolded = content.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('Class time to be confirmed.'));
});
