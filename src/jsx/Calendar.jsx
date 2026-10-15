import { useState } from 'react';

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Calendar() {
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const monthName = displayMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

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
          const isSelected = selectedDate.getFullYear() === year
            && selectedDate.getMonth() === month
            && selectedDate.getDate() === day;

          return (
            <button
              key={day}
              type="button"
              className={isSelected ? 'selected' : ''}
              aria-label={new Date(year, month, day).toLocaleDateString()}
              aria-pressed={isSelected}
              onClick={() => setSelectedDate(new Date(year, month, day))}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="calendar-note">
        <strong>Selected date</strong>
        <p>{selectedDate.toLocaleDateString()}</p>
      </div>
    </section>
  );
}
