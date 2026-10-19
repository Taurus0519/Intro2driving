import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCourseCalendar,
  courseDateKey,
  isValidCourseDate,
  nextCourseDate,
} from '../src/js/courseReminder.mjs';

test('nextCourseDate returns today when called on Wednesday and otherwise the next Wednesday', () => {
  assert.equal(courseDateKey(nextCourseDate(new Date(2026, 9, 14))), '2026-10-14');
  assert.equal(courseDateKey(nextCourseDate(new Date(2026, 9, 15))), '2026-10-21');
});

test('courseDateKey uses local calendar date components', () => {
  assert.equal(courseDateKey(new Date(2026, 0, 4)), '2026-01-04');
});

test('isValidCourseDate rejects malformed and impossible dates', () => {
  assert.equal(isValidCourseDate('2026-10-16'), true);
  assert.equal(isValidCourseDate('2026-02-30'), false);
  assert.equal(isValidCourseDate('16-10-2026'), false);
});

test('calendar export includes extra all-day dates once and skips weekly Wednesdays', () => {
  const calendar = buildCourseCalendar(
    new Date('2026-10-15T10:00:00.000Z'),
    ['2026-10-17', '2026-10-17', '2026-10-21', 'not-a-date'],
  );
  const unfoldedCalendar = calendar.replace(/\r\n /g, '');

  assert.match(calendar, /RRULE:FREQ=WEEKLY;BYDAY=WE/);
  assert.equal((unfoldedCalendar.match(/UID:extra-theory-course-20261017@riteway/g) || []).length, 1);
  assert.doesNotMatch(unfoldedCalendar, /UID:extra-theory-course-20261021@riteway/);
  assert.match(unfoldedCalendar, /DTEND;VALUE=DATE:20261018/);
  assert.match(unfoldedCalendar, /Class time to be confirmed/);
});
