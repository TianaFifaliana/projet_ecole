import { SCHOOL_NAME, SCHOOL_TAGLINE } from '../config'
import useSchoolYear from '../schoolYear/useSchoolYear'
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
  const { years, selectedYearId, setSelectedYearId, isLoading } =
    useSchoolYear()

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
        {years.length > 0 ? (
          <label className="year-picker">
            <span className="year-picker-label">Année scolaire</span>
            <select
              value={selectedYearId ?? ''}
              onChange={(event) => setSelectedYearId(event.target.value)}
              aria-label="Année scolaire"
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.libelle}
                  {year.active ? ' · active' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : isLoading ? (
          <span className="year-picker-loading">Chargement…</span>
        ) : null}

        <span className="header-date">
          <Icon name="calendar" size={16} />
          {formatToday()}
        </span>
        <UserMenu />
      </div>
    </header>
  )
}
