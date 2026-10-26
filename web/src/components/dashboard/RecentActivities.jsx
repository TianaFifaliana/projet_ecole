import Icon from '../Icons'

export default function RecentActivities({ activities }) {
  return (
    <article className="card activities-card">
      <div className="card-heading">
        <div>
          <h2>Dernières activités</h2>
          <p className="card-subtitle">Les dix dernières actions enregistrées</p>
        </div>
      </div>

      {activities.length > 0 ? (
        <ul className="activity-list">
          {activities.map((activity, index) => (
            <li
              className="activity-item"
              key={activity.id ?? `${activity.action}-${index}`}
            >
              <span className="activity-marker" aria-hidden="true" />
              <div className="activity-copy">
                <p className="activity-action">{activity.action}</p>
                <p className="activity-user">{activity.utilisateur}</p>
              </div>
              <time className="activity-time">{activity.heure}</time>
            </li>
          ))}
        </ul>
      ) : (
        <div className="activity-empty">
          <span className="activity-empty-icon">
            <Icon name="activity" size={22} />
          </span>
          <div>
            <strong>Aucune activité récente</strong>
            <p>Les prochaines actions apparaîtront ici.</p>
          </div>
        </div>
      )}
    </article>
  )
}
