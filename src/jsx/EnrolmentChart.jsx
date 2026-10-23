import { useId, useState } from 'react';
import { monthlyEnrolments } from '../js/enrolmentStats.mjs';

export default function EnrolmentChart({ students, error, loading }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const gradientId = useId();
  const years = [...new Set([currentYear, year, ...students.map((student) => new Date(student.created_at).getFullYear()).filter(Number.isFinite)])].sort((a,b) => b-a);
  const months = monthlyEnrolments(students, year);
  const maximum = Math.max(1, ...months.map((item) => item.count));
  const x = (month) => 40 + month * 28;
  const y = (count) => 150 - count / maximum * 115;
  // Horizontal tangents join the months smoothly without overshooting the
  // observed values or drawing negative enrollments between zero-count months.
  const curve = months.map((item, index) => {
    if (!index) return `M ${x(item.month)},${y(item.count)}`;
    const previous = months[index - 1];
    const third = (x(item.month) - x(previous.month)) / 3;
    return `C ${x(previous.month) + third},${y(previous.count)} ${x(item.month) - third},${y(item.count)} ${x(item.month)},${y(item.count)}`;
  }).join(' ');
  return <section className="dash-card enrolment-chart">
    <div className="card-heading"><h3>Monthly Enrollments</h3><label>Year <select aria-label="Enrolment year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    {loading ? <p role="status">Loading enrollments…</p> : error ? <p className="error" role="alert">{error}</p> : <>
      <p className="enrolment-total">{months.reduce((sum,item) => sum+item.count,0)} enrollments in {year}</p>
      <svg viewBox="0 0 380 190" role="img" aria-label={`Monthly enrollments in ${year}: ${months.map((item) => `${new Date(year,item.month,1).toLocaleString('en',{month:'short'})}: ${item.count}`).join(', ')}`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14947e" stopOpacity="0.23" />
          <stop offset="100%" stopColor="#14947e" stopOpacity="0.02" />
        </linearGradient></defs>
        {[0,maximum].map((count) => <g key={count}><line x1="40" x2="350" y1={y(count)} y2={y(count)} stroke="#dce7ed"/><text x="32" y={y(count)+4} textAnchor="end" fontSize="11">{count}</text></g>)}
        <path d={`${curve} L ${x(11)},150 L ${x(0)},150 Z`} fill={`url(#${gradientId})`} />
        <path d={curve} fill="none" stroke="#14947e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {months.map((item) => <g key={item.month}><circle cx={x(item.month)} cy={y(item.count)} r="3.5" fill="#fff" stroke="#14947e" strokeWidth="2"><title>{new Date(year,item.month,1).toLocaleString('en',{month:'long'})}: {item.count} enrollments</title></circle><text x={x(item.month)} y="176" textAnchor="middle" fontSize="9">{new Date(year,item.month,1).toLocaleString('en',{month:'short'})}</text></g>)}
      </svg><small>Based on student account creation dates.</small>
    </>}
  </section>;
}
