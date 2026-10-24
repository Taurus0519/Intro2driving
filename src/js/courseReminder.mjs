export const COURSE_TYPES = [
  { value: "onsite", label: "Onsite theoretical driving course" },
  { value: "online", label: "Online theoretical driving course" },
  { value: "additional", label: "Additional schedule course date" },
];

export function courseTitle(type) {
  return (
    COURSE_TYPES.find((item) => item.value === type)?.label ||
    COURSE_TYPES[2].label
  );
}

export function courseDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isValidCourseDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

export function upcomingCourseSessions(sessions, from = new Date()) {
  return sessions
    .filter(
      (session) =>
        isValidCourseDate(session.course_date) &&
        session.course_date >= courseDateKey(from),
    )
    .sort(
      (a, b) =>
        a.course_date.localeCompare(b.course_date) ||
        String(a.course_type).localeCompare(String(b.course_type)),
    );
}

export function buildCourseCalendar(from = new Date(), sessions = []) {
  const timestamp = from
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const seen = new Set();
  const events = upcomingCourseSessions(sessions, from).flatMap((session) => {
    const type = COURSE_TYPES.some((item) => item.value === session.course_type)
      ? session.course_type
      : "additional";
    const key = `${session.course_date}-${type}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const end = new Date(`${session.course_date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return [
      "BEGIN:VEVENT",
      `UID:course-${key}@riteway`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${session.course_date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${courseTitle(type)}`,
      ...(type === "onsite" ? ["LOCATION:Riteway Driving School"] : []),
      "DESCRIPTION:Class time to be confirmed.",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:Your ${courseTitle(type).toLowerCase()} is tomorrow.`,
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Riteway//Course schedules//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ]
    .map((line) => (line.match(/.{1,75}/g) || [""]).join("\r\n "))
    .join("\r\n");
}
