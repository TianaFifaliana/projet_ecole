import Icon from '../Icons'

export default function MetricCard({ icon, label, value, hint, tone = 'blue' }) {
  return (
    <article className="card metric-card">
      <span className={`metric-icon metric-icon--${tone}`}>
        <Icon name={icon} size={22} />
      </span>

      <div className="metric-content">
        <span className="metric-label">{label}</span>
        <strong className="metric-value">{value}</strong>
        {hint && <span className="metric-hint">{hint}</span>}
      </div>
    </article>
  )
}
