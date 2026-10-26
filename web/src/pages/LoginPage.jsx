import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../auth/useAuth'
import LoadingScreen from '../components/LoadingScreen'
import Icon from '../components/Icons'
import { SCHOOL_NAME, SCHOOL_TAGLINE } from '../config'

function getLoginError(error) {
  const status = error.response?.status
  const rawMessage = String(error.response?.data?.message ?? '')
  const message = rawMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    ['desactiv', 'inactif', 'suspend', 'bloque'].some((keyword) =>
      message.includes(keyword),
    )
  ) {
    return 'Votre compte est désactivé. Contactez l’administration.'
  }

  if (status === 401 || status === 422) {
    return 'E-mail ou mot de passe incorrect.'
  }

  if (status === 403) {
    return 'Votre compte est désactivé ou n’est pas autorisé à se connecter. Contactez l’administration.'
  }

  if (status === 429) {
    return 'Trop de tentatives. Veuillez réessayer dans quelques instants.'
  }

  if (!error.response) {
    return error.request
      ? 'Impossible de contacter le serveur. Vérifiez votre connexion.'
      : error.message || 'Une erreur est survenue lors de la connexion.'
  }

  return 'Une erreur est survenue lors de la connexion. Veuillez réessayer.'
}

export default function LoginPage() {
  const { login, user, initializing } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (initializing) {
    return <LoadingScreen label="Vérification de votre session…" />
  }

  if (user) {
    return <Navigate to={location.state?.from?.pathname ?? '/'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email.trim(), password)
    } catch (loginError) {
      setError(getLoginError(loginError))
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">
          <span className="brand-mark brand-mark-large">
            <Icon name="professeurs" size={26} />
          </span>
          <span className="brand-text">
            <strong>{SCHOOL_NAME}</strong>
            <small>{SCHOOL_TAGLINE}</small>
          </span>
        </div>

        <div className="login-copy">
          <span className="login-kicker">Plateforme de gestion scolaire</span>
          <h1>Votre école, réunie dans un seul espace.</h1>
          <p>
            Retrouvez les élèves, les professeurs, les classes et le suivi
            administratif dans une interface claire et sécurisée.
          </p>

          <ul className="login-points">
            <li>
              <span className="login-point-icon">
                <Icon name="lock" size={14} />
              </span>
              Un accès sécurisé adapté à chaque rôle
            </li>
            <li>
              <span className="login-point-icon">
                <Icon name="dashboard" size={14} />
              </span>
              Des modules réunis dans un même espace
            </li>
            <li>
              <span className="login-point-icon">
                <Icon name="eleves" size={14} />
              </span>
              Une gestion quotidienne simplifiée
            </li>
          </ul>
        </div>

        <p className="login-visual-footer">
          Gestion sécurisée des données scolaires
        </p>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <p className="eyebrow">Espace personnel</p>
            <h2>Connexion</h2>
            <p>Connectez-vous avec votre compte pour continuer.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login-email">Adresse e-mail</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (error) {
                    setError('')
                  }
                }}
                autoComplete="email"
                placeholder="vous@ecole.fr"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (error) {
                    setError('')
                  }
                }}
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="button button-primary button-block"
              disabled={loading}
            >
              {loading && <span className="spinner" aria-hidden="true" />}
              <span>{loading ? 'Connexion en cours…' : 'Se connecter'}</span>
            </button>
          </form>

          <p className="login-help">
            Un problème de connexion ? Contactez l’administration de l’école.
          </p>
        </div>
      </section>
    </main>
  )
}
