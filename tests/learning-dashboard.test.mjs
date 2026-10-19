import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows, summarizeSuccess } from '../src/js/learningStats.mjs';
import { buildCourseCalendar, nextCourseDate } from '../src/js/courseReminder.mjs';
import { summarizeQuizAttempts } from '../src/js/quizAttemptStats.mjs';

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

test('course reminder always finds this or the next Wednesday throughout a year', () => {
  for (let day = 1; day <= 366; day += 1) {
    const from = new Date(2028, 0, day, 23, 59);
    const next = nextCourseDate(from);
    assert.equal(next.getDay(), 3);
    const midnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    assert.ok(next >= midnight);
    const followingWeek = new Date(midnight);
    followingWeek.setDate(followingWeek.getDate() + 7);
    assert.ok(next < followingWeek);
    if (from.getDay() === 3) assert.equal(next.toDateString(), from.toDateString());
  }
});

test('recurring calendar export crosses year boundaries and includes a reminder', () => {
  const content = buildCourseCalendar(new Date(2026, 11, 31, 13));
  assert.ok(content.includes('DTSTART;VALUE=DATE:20270106\r\n'));
  assert.ok(content.includes('DTEND;VALUE=DATE:20270107\r\n'));
  assert.ok(content.includes('RRULE:FREQ=WEEKLY;BYDAY=WE\r\n'));
  assert.ok(content.includes('TRIGGER:-P1D\r\n'));
  assert.ok(content.endsWith('END:VCALENDAR\r\n'));
  assert.ok(content.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  const unfolded = content.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('Class time to be confirmed.'));
});
