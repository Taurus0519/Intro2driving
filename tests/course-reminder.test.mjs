import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCourseCalendar,
  courseDateKey,
  isValidCourseDate,
  upcomingCourseSessions,
} from "../src/js/courseReminder.mjs";

test("courseDateKey uses local calendar date components", () => {
  assert.equal(courseDateKey(new Date(2026, 0, 4)), "2026-01-04");
});
test("course dates reject malformed and impossible dates", () => {
  assert.equal(isValidCourseDate("2026-10-16"), true);
  assert.equal(isValidCourseDate("2026-02-30"), false);
  assert.equal(isValidCourseDate("16-10-2026"), false);
});
test("upcoming schedules include only saved dates and never invent a Wednesday", () => {
  const sessions = [
    { course_date: "2026-10-30", course_type: "onsite" },
    { course_date: "2026-10-15", course_type: "online" },
    { course_date: "2026-10-16", course_type: "additional" },
    { course_date: "invalid", course_type: "onsite" },
  ];
  assert.deepEqual(upcomingCourseSessions(sessions, new Date(2026, 9, 16)), [
    sessions[2],
    sessions[0],
  ]);
  assert.deepEqual(upcomingCourseSessions([], new Date(2026, 9, 21)), []);
});
test("calendar exports all three editable course types with no weekly recurrence", () => {
  const calendar = buildCourseCalendar(new Date(2026, 9, 15), [
    { course_date: "2026-10-17", course_type: "onsite" },
    { course_date: "2026-10-17", course_type: "online" },
    { course_date: "2026-10-21", course_type: "additional" },
    { course_date: "2026-10-17", course_type: "onsite" },
    { course_date: "2026-10-01", course_type: "online" },
  ]).replace(/\r\n /g, "");
  assert.doesNotMatch(calendar, /RRULE|weekly|Wednesday/);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(calendar, /SUMMARY:Onsite theoretical driving course/);
  assert.match(calendar, /SUMMARY:Online theoretical driving course/);
  assert.match(calendar, /SUMMARY:Additional schedule course date/);
  assert.match(calendar, /DTEND;VALUE=DATE:20261018/);
  assert.equal(
    (calendar.match(/LOCATION:Riteway Driving School/g) || []).length,
    1,
  );
  assert.equal((calendar.match(/TRIGGER:-P1D/g) || []).length, 3);
});
test("removing the last schedule produces no exported events", () => {
  assert.doesNotMatch(
    buildCourseCalendar(new Date(), []),
    /BEGIN:VEVENT|RRULE/,
  );
});
