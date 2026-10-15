export default function ProgressCard({ icon, count, title, hint }) {
  return (
    <section className="dash-card progress-card">
      <span className="progress-icon" aria-hidden="true">{icon}</span>
      <strong>{count}</strong>
      <b>{title}</b>
      <small>{hint}</small>
    </section>
  );
}
