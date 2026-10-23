import { useState } from 'react';
import { monthlyEnrolments } from '../js/enrolmentStats.mjs';

export default function EnrolmentChart({ students, error, loading }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = [...new Set([currentYear, year, ...students.map((student) => new Date(student.created_at).getFullYear()).filter(Number.isFinite)])].sort((a,b) => b-a);
  const months = monthlyEnrolments(students, year);
  const isFuture = (month) => year > currentYear || (year === currentYear && month > today.getMonth());
  const maximum = Math.max(1, ...months.filter((item) => !isFuture(item.month)).map((item) => item.count));
  const step = Math.max(1, Math.ceil(maximum / 4));
  const ceiling = Math.ceil(maximum / step) * step;
  const ticks = Array.from({ length: ceiling / step + 1 }, (_, index) => index * step);
  const x = (month) => 40 + month * 28;
  const y = (count) => 150 - count / ceiling * 115;
  return <section className="dash-card enrolment-chart">
    <div className="card-heading"><h3>Monthly Enrollees</h3><label>Year <select aria-label="Enrolment year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    {loading ? <p role="status">Loading enrolments…</p> : error ? <p className="error" role="alert">{error}</p> : <>
      <p className="enrolment-total">{months.reduce((sum,item) => sum+item.count,0)} enrollees in {year}</p>
      <svg viewBox="0 0 380 190" role="img" aria-label={`Monthly enrollees in ${year}: ${months.map((item) => `${new Date(year,item.month,1).toLocaleString('en',{month:'short'})}: ${isFuture(item.month) ? 'upcoming' : item.count}`).join(', ')}`}>
        {ticks.map((count) => <g key={count}><line x1="40" x2="350" y1={y(count)} y2={y(count)} stroke="#dce7ed"/><text x="32" y={y(count)+4} textAnchor="end" fontSize="11">{count}</text></g>)}
        {months.map((item) => <g key={item.month}>
          {!isFuture(item.month) && <>
            <rect x={x(item.month)-9} y={y(item.count)} width="18" height={150-y(item.count)} rx="3" fill={year===currentYear && item.month===today.getMonth() ? '#14947e' : '#176ca6'}>
              <title>{new Date(year,item.month,1).toLocaleString('en',{month:'long'})}: {item.count} enrollees</title>
            </rect>
            <text x={x(item.month)} y={y(item.count)-7} textAnchor="middle" fontSize="10" fontWeight="700" fill="#294b60">{item.count}</text>
          </>}
          <text x={x(item.month)} y="176" textAnchor="middle" fontSize="9" fill={isFuture(item.month) ? '#718392' : '#294b60'}>{new Date(year,item.month,1).toLocaleString('en',{month:'short'})}</text>
        </g>)}
      </svg><small>Based on student account creation dates. Future months are not plotted.</small>
    </>}
  </section>;
}
