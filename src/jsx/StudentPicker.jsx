import { useEffect, useState } from 'react';
import Pagination from './Pagination';
import '../css/StudentPicker.css';

const PAGE_SIZE = 10;
const BROWSE_STUDENTS = '__browse_all_students__';

export default function StudentPicker({
  id,
  label,
  students,
  value,
  onChange,
  placeholder = 'Select a student',
  className = '',
  itemLabel = 'student',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleStudents = students.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  function handleSelectChange(event) {
    const selectedId = event.target.value;
    if (selectedId === BROWSE_STUDENTS) {
      setPage(1);
      setIsOpen(true);
      return;
    }
    onChange(selectedId);
  }

  function chooseStudent(studentId) {
    onChange(studentId);
    setIsOpen(false);
  }

  return (
    <>
      <label className={`student-picker-label ${className}`.trim()} htmlFor={id}>
        {label}
        <select id={id} value={value} onChange={handleSelectChange} disabled={disabled}>
          <option value="">{placeholder}</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>{student.name || `Unknown ${itemLabel}`}</option>
          ))}
          <option value={BROWSE_STUDENTS}>Select all {itemLabel}s…</option>
        </select>
      </label>
      {isOpen && (
        <div className="student-picker-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <section
            className="student-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-dialog-title`}
          >
            <div className="student-picker-heading">
              <h2 id={`${id}-dialog-title`}>Choose a {itemLabel}</h2>
              <button type="button" aria-label="Close student picker" onClick={() => setIsOpen(false)}>×</button>
            </div>
            {students.length ? (
              <>
                <div className="student-picker-options">
                  {visibleStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className={student.id === value ? 'selected' : ''}
                      aria-pressed={student.id === value}
                      onClick={() => chooseStudent(student.id)}
                    >
                      {student.name || `Unknown ${itemLabel}`}
                    </button>
                  ))}
                </div>
                <Pagination
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  totalItems={students.length}
                  onPageChange={setPage}
                />
              </>
            ) : (
              <p className="student-picker-empty">No students are available to select.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
