export const COURSE_TITLE = 'Onsite theoretical driving course';

export function nextCourseDate(from = new Date()) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + (3 - date.getDay() + 7) % 7);
  return date;
}

function calendarDate(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function buildCourseCalendar(from = new Date()) {
  const start = nextCourseDate(from);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // An all-day event avoids inventing a course time or a timezone.
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Riteway//Student course reminders//EN',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:weekly-theory-course@riteway',
    `DTSTAMP:${from.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART;VALUE=DATE:${calendarDate(start)}`, `DTEND;VALUE=DATE:${calendarDate(end)}`,
    'RRULE:FREQ=WEEKLY;BYDAY=WE', `SUMMARY:${COURSE_TITLE}`,
    'LOCATION:Riteway Driving School',
    'DESCRIPTION:Attend your theoretical driving course onsite every Wednesday. Confirm the class time with the school.',
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
    'DESCRIPTION:Your onsite theoretical driving course is tomorrow.',
    'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', '',
  ].map((line) => (line.match(/.{1,75}/g) || ['']).join('\r\n ')).join('\r\n');
}
