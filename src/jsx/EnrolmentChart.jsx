import { useState } from 'react';
import { monthlyEnrolments } from '../js/enrolmentStats.mjs';

export default function EnrolmentChart({ students, error, loading }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showExamples, setShowExamples] = useState(false);
  const years = [...new Set([currentYear, year, ...students.map((student) => new Date(student.created_at).getFullYear()).filter(Number.isFinite)])].sort((a,b) => b-a);
  const months = showExamples
    ? [1, 2, 1, 3, 2, 4, 3, 5, 6, 7, 4, 5].map((count, month) => ({ month, count }))
    : monthlyEnrolments(students, year);
  const maximum = Math.max(1, ...months.map((item) => item.count));
  const x = (month) => 40 + month * 28;
  const y = (count) => 150 - count / maximum * 115;
  return <section className="dash-card enrolment-chart">
    <div className="card-heading"><h3>Monthly Enrollees</h3><label>Year <select aria-label="Enrolment year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <label className="enrolment-example-toggle"><input type="checkbox" checked={showExamples} onChange={(event) => setShowExamples(event.target.checked)} /> Show example data</label>
    {showExamples && <p className="enrolment-example-notice" role="status">Example data only — fictional monthly counts, including 6 enrollees in September. These are not student records.</p>}
    {loading && !showExamples ? <p role="status">Loading enrolments…</p> : error && !showExamples ? <p className="error" role="alert">{error}</p> : <>
      <p className="enrolment-total">{months.reduce((sum,item) => sum+item.count,0)} {showExamples ? 'example enrollees' : 'enrollees'} in {year}</p>
      <svg viewBox="0 0 380 190" role="img" aria-label={`Monthly enrollees in ${year}: ${months.map((item) => `${new Date(year,item.month,1).toLocaleString('en',{month:'short'})}: ${item.count}`).join(', ')}`}>
        {[0,maximum].map((count) => <g key={count}><line x1="40" x2="350" y1={y(count)} y2={y(count)} stroke="#dce7ed"/><text x="32" y={y(count)+4} textAnchor="end" fontSize="11">{count}</text></g>)}
        <polyline points={months.map((item) => `${x(item.month)},${y(item.count)}`).join(' ')} fill="none" stroke="#176ca6" strokeWidth="2.5"/>
        {months.map((item) => <g key={item.month}><circle cx={x(item.month)} cy={y(item.count)} r="4" fill="#176ca6"><title>{new Date(year,item.month,1).toLocaleString('en',{month:'long'})}: {item.count} enrollees</title></circle><text x={x(item.month)} y="176" textAnchor="middle" fontSize="9">{new Date(year,item.month,1).toLocaleString('en',{month:'short'})}</text></g>)}
      </svg><small>{showExamples ? 'Illustrative data for all 12 months. Turn off Show example data to view actual enrolments.' : 'Based on student account creation dates.'}</small>
    </>}
  </section>;
}
