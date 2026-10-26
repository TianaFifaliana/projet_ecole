import { Link } from 'react-router-dom'
import Icon from './Icons'

export default function AccessDenied() {
  return (
    <section className="page">
      <div className="card denied-card">
        <span className="state-icon state-icon-danger">
          <Icon name="lock" size={34} />
        </span>
        <p className="eyebrow">Autorisation</p>
        <h1>Accès refusé</h1>
        <p>
          Votre rôle ne vous autorise pas à consulter cette page. Contactez
          l’administration si vous pensez qu’il s’agit d’une erreur.
        </p>
        <Link to="/" className="button button-primary">
          Retour au tableau de bord
        </Link>
      </div>
    </section>
  )
}
