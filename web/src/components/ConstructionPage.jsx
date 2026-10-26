import { Link } from 'react-router-dom'
import Icon from './Icons'

export default function ConstructionPage({ title, description }) {
  return (
    <section className="page">
      <header className="page-heading">
        <p className="eyebrow">Module</p>
        <h1>{title}</h1>
      </header>

      <div className="card construction-card">
        <span className="state-icon">
          <Icon name="construction" size={36} />
        </span>
        <h2>En construction</h2>
        <p>{description}</p>
        <Link to="/" className="button button-secondary">
          Retour au tableau de bord
        </Link>
      </div>
    </section>
  )
}
