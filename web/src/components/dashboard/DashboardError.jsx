import Icon from '../Icons'

export default function DashboardError({ error, onRetry, retrying }) {
  const message = error?.response
    ? 'Le serveur n’a pas pu fournir les indicateurs. Veuillez réessayer dans un instant.'
    : 'Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.'

  return (
    <section className="page">
      <div className="card dashboard-error" role="alert">
        <span className="state-icon state-icon-danger">
          <Icon name="activity" size={30} />
        </span>
        <p className="eyebrow">Tableau de bord</p>
        <h1>Impossible de charger les données</h1>
        <p>{message}</p>
        <button
          type="button"
          className="button button-primary"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying && <span className="spinner" aria-hidden="true" />}
          <span>{retrying ? 'Nouvelle tentative…' : 'Réessayer'}</span>
        </button>
      </div>
    </section>
  )
}
