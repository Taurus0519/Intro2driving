import { useEffect, useState } from 'react';
import { buildCourseCalendar, COURSE_TITLE, nextCourseDate } from '../js/courseReminder.mjs';
import '../css/CourseCalendar.css';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Calendar() {
  const [today, setToday] = useState(() => new Date());
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      setToday((previous) => previous.toDateString() === now.toDateString() ? previous : now);
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const monthName = displayMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const nextCourse = nextCourseDate(today);
  const courseToday = today.getDay() === 3;

  function changeMonth(offset) {
    const nextMonth = new Date(year, month + offset, 1);
    setDisplayMonth(nextMonth);
    setSelectedDate(nextMonth);
  }

  return (
    <section className="dash-card calendar-card" aria-label="Calendar">
      <div className="calendar-heading">
        <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
        <strong>{monthName}</strong>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
      </div>
      <div className="calendar-grid">
        {weekdays.map((day) => <b key={day}>{day}</b>)}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = new Date(year, month, day);
          const hasCourse = date.getDay() === 3;
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = selectedDate.getFullYear() === year
            && selectedDate.getMonth() === month
            && selectedDate.getDate() === day;

          return (
            <button
              key={day}
              type="button"
              className={`${isSelected ? 'selected' : ''} ${hasCourse ? 'course-day' : ''}`.trim()}
              aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${hasCourse ? `: ${COURSE_TITLE}` : ''}`}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              title={hasCourse ? COURSE_TITLE : undefined}
              onClick={() => setSelectedDate(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="calendar-course-legend"><span aria-hidden="true" />Wednesday · Onsite theoretical driving course</p>
      <div className="calendar-note" aria-live="polite">
        <strong>Selected date</strong>
        <p>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <p>{selectedDate.getDay() === 3 ? COURSE_TITLE : 'No theoretical driving course scheduled for this date.'}</p>
      </div>
      <div className={`course-reminder${courseToday ? ' course-reminder-today' : ''}`}>
        <strong>{courseToday ? 'Today: attend your course onsite' : 'Every Wednesday: onsite theoretical driving course'}</strong>
        <p>Attend your theoretical driving course at Riteway Driving School.</p>
        <p>{courseToday ? 'Today' : 'Next class'}: {nextCourse.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <p className="course-time-note">Confirm the class time with the school.</p>
        <a className="course-calendar-download" download="riteway-wednesday-theory-course.ics"
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(buildCourseCalendar(today))}`}>
          Add weekly reminder to my calendar
        </a>
        <small>Weekly event with a reminder the day before.</small>
      </div>
    </section>
  );
}
