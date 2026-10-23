import { useEffect, useState } from 'react';
import { buildCourseCalendar, COURSE_TYPES, courseTitle, courseDateKey, isValidCourseDate, upcomingCourseSessions } from '../js/courseReminder.mjs';
import { fetchAllRows } from '../js/learningStats.mjs';
import { supabase } from './supabase_Client';
import '../css/CourseCalendar.css';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const dateLabel = (date) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function Calendar({ isStaff = false }) {
  const [today, setToday] = useState(() => new Date());
  const [displayMonth, setDisplayMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dateValue, setDateValue] = useState(() => courseDateKey(new Date()));
  const [courseType, setCourseType] = useState('onsite');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await fetchAllRows(() => supabase.from('onsite_course_sessions')
        .select('id, course_date, course_type').order('course_date').order('id'));
      if (!active) return;
      setLoading(false);
      if (error) { setLoadError('Course schedules could not be loaded. Please contact the school administrator.'); return; }
      setSessions(data || []); setLoadError('');
    }
    void load();
    const interval = window.setInterval(() => { setToday(new Date()); void load(); }, 30000);
    const channel = supabase.channel('dashboard-course-schedules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onsite_course_sessions' }, () => void load()).subscribe();
    return () => { active = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, []);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const selectedKey = courseDateKey(selectedDate);
  const selectedSessions = sessions.filter((session) => session.course_date === selectedKey);
  const upcoming = upcomingCourseSessions(sessions, today);

  function selectDate(date) {
    if (saving) return;
    setSelectedDate(date); setDateValue(courseDateKey(date)); setEditingId(null); setError(''); setNotice('');
  }
  function changeMonth(offset) {
    const date = new Date(year, month + offset, 1);
    setDisplayMonth(date); selectDate(date);
  }
  async function save(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!isStaff || saving) return;
    if (!isValidCourseDate(dateValue)) { setError('Choose a valid course date.'); return; }
    if (sessions.some((item) => item.id !== editingId && item.course_date === dateValue && item.course_type === courseType)) {
      setError('This course type is already scheduled on that date.'); return;
    }
    setSaving(true);
    try {
      const values = { course_date: dateValue, course_type: courseType };
      const result = editingId
        ? await supabase.from('onsite_course_sessions').update(values).eq('id', editingId).select('id, course_date, course_type').single()
        : await supabase.from('onsite_course_sessions').insert(values).select('id, course_date, course_type').single();
      if (result.error || !result.data) throw new Error(result.error?.code === '23505'
        ? 'This course type is already scheduled on that date.' : 'The schedule could not be saved. Please try again.');
      setSessions((current) => [...current.filter((item) => item.id !== result.data.id), result.data]);
      const date = new Date(`${dateValue}T00:00:00`);
      setSelectedDate(date); setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setEditingId(null); setNotice('Course schedule saved.');
    } catch (error) { setError(error.message); } finally { setSaving(false); }
  }
  async function remove(session) {
    if (!isStaff || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const { data, error } = await supabase.from('onsite_course_sessions').delete().eq('id', session.id).select('id').single();
      if (error || !data) throw new Error('The schedule could not be removed. Please try again.');
      setSessions((current) => current.filter((item) => item.id !== session.id));
      if (editingId === session.id) setEditingId(null);
      setNotice('Course schedule removed.');
    } catch (error) { setError(error.message); } finally { setSaving(false); }
  }

  return <section className="dash-card calendar-card" aria-label="Course calendar">
    <div className="calendar-heading">
      <button type="button" aria-label="Previous month" disabled={saving} onClick={() => changeMonth(-1)}>‹</button>
      <strong>{displayMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
      <button type="button" aria-label="Next month" disabled={saving} onClick={() => changeMonth(1)}>›</button>
    </div>
    <div className="calendar-grid">
      {weekdays.map((day) => <b key={day}>{day}</b>)}
      {Array.from({ length: new Date(year, month, 1).getDay() }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
      {Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => {
        const date = new Date(year, month, index + 1);
        const key = courseDateKey(date);
        const daySessions = sessions.filter((session) => session.course_date === key);
        return <button key={key} type="button" disabled={saving}
          className={`${key === selectedKey ? 'selected' : ''} ${daySessions.length ? `course-day ${daySessions[0].course_type}-course-day` : ''}`.trim()}
          aria-label={`${dateLabel(date)}${daySessions.length ? `: ${daySessions.map((item) => courseTitle(item.course_type)).join('; ')}` : ''}`}
          aria-pressed={key === selectedKey} aria-current={key === courseDateKey(today) ? 'date' : undefined}
          onClick={() => selectDate(date)}>{index + 1}</button>;
      })}
    </div>
    {COURSE_TYPES.map((type) => <p key={type.value} className={`calendar-course-legend calendar-${type.value}-legend`}><span aria-hidden="true" />{type.label}</p>)}
    <div className="calendar-note" aria-live="polite">
      <strong>Selected date</strong><p>{dateLabel(selectedDate)}</p>
      {loading ? <p>Loading schedules...</p> : loadError ? <p role="alert">{loadError}</p> : selectedSessions.length
        ? selectedSessions.map((session) => <div key={session.id} className="calendar-scheduled-course">
          <p><strong>{courseTitle(session.course_type)}</strong></p><p>Time to be confirmed.</p>
          {isStaff && <div className="calendar-session-actions">
            <button type="button" disabled={saving} onClick={() => {
              setEditingId(session.id); setCourseType(session.course_type); setDateValue(session.course_date); setError(''); setNotice('');
            }}>Edit</button>
            <button type="button" disabled={saving} onClick={() => void remove(session)}>Remove</button>
          </div>}
        </div>) : <p>No course scheduled for this date.</p>}
    </div>
    {isStaff && <div className="calendar-staff-controls">
      <h4>{editingId ? 'Edit course schedule' : 'Schedule a course'}</h4>
      <form onSubmit={save}>
        <label htmlFor="calendar-course-type">Course type</label>
        <select id="calendar-course-type" value={courseType} disabled={saving} onChange={(event) => setCourseType(event.target.value)}>
          {COURSE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <label htmlFor="calendar-course-date">Course date</label>
        <input id="calendar-course-date" type="date" required disabled={saving} value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
        <div className="calendar-session-actions">
          <button type="submit" disabled={saving || loading || Boolean(loadError)}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Schedule course'}</button>
          {editingId && <button type="button" disabled={saving} onClick={() => { setEditingId(null); setDateValue(selectedKey); setError(''); }}>Cancel</button>}
        </div>
      </form>
    </div>}
    {error && <p role="alert" className="calendar-session-error">{error}</p>}
    {notice && <p role="status" className="calendar-session-notice">{notice}</p>}
    {!loading && !loadError && <div className="course-reminder">
      <strong>Upcoming course</strong>
      {upcoming.length ? <>
        <p>{courseTitle(upcoming[0].course_type)}</p>
        <p>{dateLabel(new Date(`${upcoming[0].course_date}T00:00:00`))}</p>
        <p className="course-time-note">Class time to be confirmed.</p>
        <a className="course-calendar-download" download="riteway-course-schedules.ics"
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(buildCourseCalendar(today, sessions))}`}>Add course dates to my calendar</a>
        <small>Scheduled dates include a reminder the day before.</small>
      </> : <p>No upcoming courses scheduled yet.</p>}
    </div>}
  </section>;
}
