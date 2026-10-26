import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="page">
      <div className="card denied-card">
        <p className="eyebrow">Erreur 404</p>
        <h1>Page introuvable</h1>
        <p>La page que vous recherchez n’existe pas ou a été déplacée.</p>
        <Link to="/" className="button button-primary">
          Retour au tableau de bord
        </Link>
      </div>
    </section>
  )
}
