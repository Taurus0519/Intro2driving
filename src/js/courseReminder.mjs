export const COURSE_TITLE = 'Onsite theoretical driving course';

export function nextCourseDate(from = new Date()) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + (3 - date.getDay() + 7) % 7);
  return date;
}

function calendarDate(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function courseDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidCourseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function buildCourseCalendar(from = new Date(), extraDates = []) {
  const start = nextCourseDate(from);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const timestamp = from.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const extraEvents = [...new Set(extraDates)]
    .filter((date) => isValidCourseDate(date) && new Date(`${date}T00:00:00.000Z`).getUTCDay() !== 3)
    .map((date) => {
      const dateValue = date.replace(/-/g, '');
      const nextDay = new Date(`${date}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      return [
        'BEGIN:VEVENT', `UID:extra-theory-course-${dateValue}@riteway`, `DTSTAMP:${timestamp}`,
        `DTSTART;VALUE=DATE:${dateValue}`, `DTEND;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replace(/-/g, '')}`,
        `SUMMARY:${COURSE_TITLE} (additional date)`,
        'LOCATION:Riteway Driving School',
        'DESCRIPTION:Attend your theoretical driving course onsite. Class time to be confirmed.',
        'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
        'DESCRIPTION:Your onsite theoretical driving course is tomorrow.',
        'END:VALARM', 'END:VEVENT',
      ];
    });
  // An all-day event avoids inventing a course time or a timezone.
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Riteway//Student course reminders//EN',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:weekly-theory-course@riteway',
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${calendarDate(start)}`, `DTEND;VALUE=DATE:${calendarDate(end)}`,
    'RRULE:FREQ=WEEKLY;BYDAY=WE', `SUMMARY:${COURSE_TITLE}`,
    'LOCATION:Riteway Driving School',
    'DESCRIPTION:Attend your theoretical driving course onsite every Wednesday. Class time to be confirmed.',
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
    'DESCRIPTION:Your onsite theoretical driving course is tomorrow.',
    'END:VALARM', 'END:VEVENT', ...extraEvents.flat(), 'END:VCALENDAR', '',
  ].map((line) => (line.match(/.{1,75}/g) || ['']).join('\r\n ')).join('\r\n');
}
