import Icon from '../Icons'

export default function ChartEmpty({ icon = 'activity', title, message }) {
  return (
    <div className="chart-empty">
      <span className="chart-empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <strong>{title}</strong>
        {message && <p>{message}</p>}
      </div>
    </div>
  )
}
