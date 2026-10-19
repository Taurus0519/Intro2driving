import { useEffect, useState } from 'react';
import { buildCourseCalendar, COURSE_TITLE, courseDateKey, isValidCourseDate, nextCourseDate } from '../js/courseReminder.mjs';
import { fetchAllRows } from '../js/learningStats.mjs';
import { supabase } from './supabase_Client';
import '../css/CourseCalendar.css';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Calendar({ isStaff = false }) {
  const [today, setToday] = useState(() => new Date());
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [courseSessions, setCourseSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState('');
  const [dateValue, setDateValue] = useState(() => courseDateKey(new Date()));
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionMutationError, setSessionMutationError] = useState('');

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      setToday((previous) => previous.toDateString() === now.toDateString() ? previous : now);
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCourseSessions() {
      const { data, error } = await fetchAllRows(() => supabase
        .from('onsite_course_sessions')
        .select('id, course_date')
        .order('course_date', { ascending: true }));

      if (!active) return;
      if (error) {
        setSessionsError(`Additional course dates could not be loaded: ${error.message}`);
        return;
      }

      setCourseSessions(data || []);
      setSessionsError('');
    }

    void loadCourseSessions();
    const refreshInterval = window.setInterval(() => void loadCourseSessions(), 30000);
    const channel = supabase
      .channel('onsite-course-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'onsite_course_sessions' },
        () => void loadCourseSessions(),
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, []);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const monthName = displayMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const nextCourse = nextCourseDate(today);
  const extraDates = courseSessions.map((session) => session.course_date);
  const selectedDateKey = courseDateKey(selectedDate);
  const selectedExtraSession = courseSessions.find((session) => session.course_date === selectedDateKey);
  const upcomingExtraDate = extraDates
    .filter((date) => isValidCourseDate(date) && date >= courseDateKey(today))
    .sort()[0];
  const upcomingCourseDate = upcomingExtraDate && upcomingExtraDate < courseDateKey(nextCourse)
    ? new Date(`${upcomingExtraDate}T00:00:00`)
    : nextCourse;
  const courseToday = courseDateKey(upcomingCourseDate) === courseDateKey(today);

  function changeMonth(offset) {
    const nextMonth = new Date(year, month + offset, 1);
    setDisplayMonth(nextMonth);
    setSelectedDate(nextMonth);
    setDateValue(courseDateKey(nextMonth));
    setEditingSessionId(null);
    setSessionMutationError('');
  }

  function selectDate(date) {
    setSelectedDate(date);
    setDateValue(courseDateKey(date));
    setEditingSessionId(null);
    setSessionMutationError('');
  }

  async function saveSession(event) {
    event.preventDefault();
    setSessionMutationError('');
    if (!isValidCourseDate(dateValue)) {
      setSessionMutationError('Choose a valid course date.');
      return;
    }

    const duplicate = courseSessions.some((session) => (
      session.course_date === dateValue && session.id !== editingSessionId
    ));
    if (duplicate) {
      setSessionMutationError('An additional course is already scheduled on that date.');
      return;
    }

    setSavingSession(true);
    const result = editingSessionId
      ? await supabase.from('onsite_course_sessions')
        .update({ course_date: dateValue })
        .eq('id', editingSessionId)
        .select('id')
        .maybeSingle()
      : await supabase.from('onsite_course_sessions')
        .insert({ course_date: dateValue })
        .select('id')
        .single();
    setSavingSession(false);
    if (result.error) {
      setSessionMutationError(`The course date could not be saved: ${result.error.message}`);
      return;
    }
    if (!result.data) {
      setSessionMutationError('The course date could not be saved because no schedule row was changed.');
      return;
    }

    const savedDate = new Date(`${dateValue}T00:00:00`);
    setSelectedDate(savedDate);
    setDisplayMonth(new Date(savedDate.getFullYear(), savedDate.getMonth(), 1));
    setEditingSessionId(null);
    const { data, error } = await fetchAllRows(() => supabase
      .from('onsite_course_sessions')
      .select('id, course_date')
      .order('course_date', { ascending: true }));
    if (error) {
      setSessionsError(`Additional course dates could not be refreshed: ${error.message}`);
      return;
    }
    setCourseSessions(data || []);
    setSessionsError('');
  }

  async function deleteSession() {
    if (!selectedExtraSession) return;
    setSessionMutationError('');
    setSavingSession(true);
    const { data, error } = await supabase
      .from('onsite_course_sessions')
      .delete()
      .eq('id', selectedExtraSession.id)
      .select('id')
      .maybeSingle();
    setSavingSession(false);
    if (error) {
      setSessionMutationError(`The course date could not be removed: ${error.message}`);
      return;
    }
    if (!data) {
      setSessionMutationError('The course date could not be removed because no schedule row was changed.');
      return;
    }

    setCourseSessions((current) => current.filter((session) => session.id !== selectedExtraSession.id));
    setEditingSessionId(null);
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
          const hasWeeklyCourse = date.getDay() === 3;
          const hasExtraCourse = extraDates.includes(courseDateKey(date));
          const hasCourse = hasWeeklyCourse || hasExtraCourse;
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = selectedDate.getFullYear() === year
            && selectedDate.getMonth() === month
            && selectedDate.getDate() === day;

          return (
            <button
              key={day}
              type="button"
              className={`${isSelected ? 'selected' : ''} ${hasCourse ? 'course-day' : ''} ${hasExtraCourse ? 'extra-course-day' : ''}`.trim()}
              aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${hasWeeklyCourse ? `: ${COURSE_TITLE}` : ''}${hasExtraCourse ? ': Additional course date' : ''}`}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              title={hasExtraCourse ? `${COURSE_TITLE} (additional date)` : hasCourse ? COURSE_TITLE : undefined}
              onClick={() => selectDate(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="calendar-course-legend"><span aria-hidden="true" />Wednesday · Onsite theoretical driving course</p>
      <p className="calendar-course-legend calendar-extra-legend"><span aria-hidden="true" />Additional scheduled course date</p>
      <div className="calendar-note" aria-live="polite">
        <strong>Selected date</strong>
        <p>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        {selectedDate.getDay() === 3 && <p>{COURSE_TITLE} (weekly Wednesday session)</p>}
        {selectedExtraSession && <p>{COURSE_TITLE} (additional date)</p>}
        {!selectedExtraSession && selectedDate.getDay() !== 3 && <p>No theoretical driving course scheduled for this date.</p>}
        {(selectedExtraSession || selectedDate.getDay() === 3) && <p className="course-time-note">Time to be confirmed.</p>}
      </div>
      {sessionsError && <p role="alert" className="calendar-session-error">{sessionsError}</p>}
      {isStaff && (
        <div className="calendar-staff-controls">
          <h4>Manage additional course dates</h4>
          {selectedExtraSession && editingSessionId !== selectedExtraSession.id && (
            <div className="calendar-session-actions">
              <button type="button" disabled={savingSession} onClick={() => {
                setEditingSessionId(selectedExtraSession.id);
                setDateValue(selectedExtraSession.course_date);
                setSessionMutationError('');
              }}>Edit selected date</button>
              <button type="button" disabled={savingSession} onClick={() => void deleteSession()}>Remove selected date</button>
            </div>
          )}
          <form onSubmit={saveSession}>
            <label htmlFor="calendar-course-date">
              {editingSessionId ? 'Change date' : 'Schedule an additional date'}
            </label>
            <input
              id="calendar-course-date"
              type="date"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
              required
            />
            <div className="calendar-session-actions">
              <button type="submit" disabled={savingSession}>
                {savingSession ? 'Saving…' : editingSessionId ? 'Save date' : 'Schedule date'}
              </button>
              {editingSessionId && (
                <button type="button" disabled={savingSession} onClick={() => {
                  setEditingSessionId(null);
                  setDateValue(selectedDateKey);
                  setSessionMutationError('');
                }}>Cancel</button>
              )}
            </div>
            {sessionMutationError && <p role="alert" className="calendar-session-error">{sessionMutationError}</p>}
          </form>
        </div>
      )}
      <div className={`course-reminder${courseToday ? ' course-reminder-today' : ''}`}>
        <strong>{courseToday ? 'Today: attend your course onsite' : 'Upcoming onsite theoretical driving course'}</strong>
        <p>Attend your theoretical driving course at Riteway Driving School.</p>
        <p>{courseToday ? 'Today' : 'Next class'}: {upcomingCourseDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <p className="course-time-note">Class time to be confirmed.</p>
        <a className="course-calendar-download" download="riteway-wednesday-theory-course.ics"
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(buildCourseCalendar(today, extraDates))}`}>
          Add course dates to my calendar
        </a>
        <small>Wednesday sessions repeat weekly; additional dates include a reminder the day before.</small>
      </div>
    </section>
  );
}
