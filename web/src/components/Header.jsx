import { SCHOOL_NAME, SCHOOL_TAGLINE } from '../config'
import Icon from './Icons'
import UserMenu from './UserMenu'

function formatToday() {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`
}

export default function Header({ onOpenSidebar }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onOpenSidebar}
          aria-label="Ouvrir le menu"
        >
          <Icon name="menu" size={22} />
        </button>

        <div className="header-school">
          <span className="header-school-label">{SCHOOL_TAGLINE}</span>
          <strong className="header-school-name">{SCHOOL_NAME}</strong>
        </div>
      </div>

      <div className="header-actions">
        <span className="header-date">
          <Icon name="calendar" size={16} />
          {formatToday()}
        </span>
        <UserMenu />
      </div>
    </header>
  )
}
