import { useId, useState } from "react";
import { monthlyEnrolments } from "../js/enrolmentStats.mjs";

export default function EnrolmentChart({ students, error, loading }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [example, setExample] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const gradientId = useId();
  const years = [
    ...new Set([
      currentYear,
      year,
      ...students
        .map((student) => new Date(student.created_at).getFullYear())
        .filter(Number.isFinite),
    ]),
  ].sort((a, b) => b - a);
  const months = example
    ? [2, 4, 3, 6, 5, 8, 4, 7, 10, 6, 3, 5].map((count, month) => ({
        month,
        count,
      }))
    : monthlyEnrolments(students, year);
  const maximum = Math.max(
    1,
    Math.ceil(Math.max(...months.map((item) => item.count)) * 1.2),
  );
  const x = (month) => 40 + month * 28;
  const y = (count) => 150 - (count / maximum) * 115;
  const activeMonth = hoveredMonth === null ? null : months[hoveredMonth];
  const tooltipX = activeMonth
    ? Math.min(208, Math.max(40, x(activeMonth.month) - 70))
    : 0;
  const tooltipY = activeMonth ? Math.max(4, y(activeMonth.count) - 48) : 0;
  // Horizontal tangents join the months smoothly without overshooting the
  // observed values or drawing negative enrollments between zero-count months.
  const curve = months
    .map((item, index) => {
      if (!index) return `M ${x(item.month)},${y(item.count)}`;
      const previous = months[index - 1];
      const third = (x(item.month) - x(previous.month)) / 3;
      return `C ${x(previous.month) + third},${y(previous.count)} ${x(item.month) - third},${y(item.count)} ${x(item.month)},${y(item.count)}`;
    })
    .join(" ");
  return (
    <section className="dash-card enrolment-chart">
      <div className="card-heading">
        <h3>Monthly Enrollments</h3>
        <label>
          Year{" "}
          <select
            aria-label="Enrolment year"
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setHoveredMonth(null);
            }}
          >
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="enrollment-preview-toggle">
        <input
          type="checkbox"
          checked={example}
          onChange={(event) => {
            setExample(event.target.checked);
            setHoveredMonth(null);
          }}
        />{" "}
        Preview example: up to 10 students per month
      </label>
      {example && (
        <p className="enrollment-preview-note" role="status">
          Example only: varied monthly counts, with a maximum of 10 students in
          September. Actual student records are unchanged.
        </p>
      )}
      {loading && !example ? (
        <p role="status">Loading enrollments…</p>
      ) : error && !example ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <p className="enrolment-total">
            {months.reduce((sum, item) => sum + item.count, 0)} enrollments in{" "}
            {year}
          </p>
          <svg
            viewBox="0 0 380 190"
            role="group"
            onMouseLeave={() => setHoveredMonth(null)}
            aria-label={`${example ? "Example data. " : ""}Monthly enrollments in ${year}: ${months.map((item) => `${new Date(year, item.month, 1).toLocaleString("en", { month: "short" })}: ${item.count}`).join(", ")}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14947e" stopOpacity="0.23" />
                <stop offset="100%" stopColor="#14947e" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, maximum].map((count) => (
              <g key={count}>
                <line
                  x1="40"
                  x2="350"
                  y1={y(count)}
                  y2={y(count)}
                  stroke="#dce7ed"
                />
                <text x="32" y={y(count) + 4} textAnchor="end" fontSize="11">
                  {count}
                </text>
              </g>
            ))}
            <path
              d={`${curve} L ${x(11)},150 L ${x(0)},150 Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={curve}
              fill="none"
              stroke="#14947e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {activeMonth && (
              <line
                x1={x(activeMonth.month)}
                x2={x(activeMonth.month)}
                y1="25"
                y2="150"
                stroke="#14947e"
                strokeDasharray="3 3"
                opacity="0.5"
              />
            )}
            {months.map((item) => (
              <g
                key={item.month}
                tabIndex={0}
                role="group"
                aria-label={`${new Date(year, item.month, 1).toLocaleString("en", { month: "long" })}: ${item.count} students${example ? ", example data" : ""}`}
                onMouseEnter={() => setHoveredMonth(item.month)}
                onFocus={() => setHoveredMonth(item.month)}
                onBlur={() => setHoveredMonth(null)}
                onClick={() => setHoveredMonth(item.month)}
              >
                <circle
                  cx={x(item.month)}
                  cy={y(item.count)}
                  r={hoveredMonth === item.month ? 5 : 3.5}
                  fill="#fff"
                  stroke="#14947e"
                  strokeWidth="2"
                />
                <text
                  x={x(item.month)}
                  y="176"
                  textAnchor="middle"
                  fontSize="9"
                >
                  {new Date(year, item.month, 1).toLocaleString("en", {
                    month: "short",
                  })}
                </text>
                <rect
                  x={x(item.month) - 13}
                  y="20"
                  width="26"
                  height="160"
                  fill="transparent"
                />
              </g>
            ))}
            {activeMonth && (
              <g pointerEvents="none" aria-hidden="true">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width="140"
                  height="39"
                  rx="5"
                  fill="#183949"
                />
                <text
                  x={tooltipX + 10}
                  y={tooltipY + 15}
                  fontSize="10"
                  fill="#fff"
                >
                  {new Date(year, activeMonth.month, 1).toLocaleString("en", {
                    month: "long",
                  })}{" "}
                  {year}
                </text>
                <text
                  x={tooltipX + 10}
                  y={tooltipY + 29}
                  fontSize="11"
                  fontWeight="700"
                  fill="#83e0d0"
                >
                  {activeMonth.count}{" "}
                  {activeMonth.count === 1 ? "student" : "students"}
                  {example ? " (example)" : ""}
                </text>
              </g>
            )}
          </svg>
          <small>
            {example
              ? "Illustrative data only, with monthly counts ranging from 2 to 10 students."
              : "Based on student account creation dates."}{" "}
            Hover, tap, or focus a month to see its student count.
          </small>
        </>
      )}
    </section>
  );
}
