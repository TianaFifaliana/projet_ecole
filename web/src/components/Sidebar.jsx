import { NavLink } from 'react-router-dom'
import { SCHOOL_NAME, SCHOOL_TAGLINE } from '../config'
import { hasPermission } from '../auth/permissions'
import useAuth from '../auth/useAuth'
import Icon from './Icons'
import { NAVIGATION } from './navigation'

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  const visibleItems = NAVIGATION.filter(
    (item) => !item.permission || hasPermission(user, item.permission),
  )

  return (
    <aside
      className={`sidebar${open ? ' is-open' : ''}`}
      aria-label="Navigation principale"
    >
      <button
        type="button"
        className="sidebar-close"
        onClick={onClose}
        aria-label="Fermer le menu"
      >
        <Icon name="close" size={20} />
      </button>

      <NavLink to="/" className="sidebar-brand" onClick={onClose}>
        <span className="brand-mark">
          <Icon name="professeurs" size={22} />
        </span>
        <span className="brand-text">
          <strong>{SCHOOL_NAME}</strong>
          <small>{SCHOOL_TAGLINE}</small>
        </span>
      </NavLink>

      <nav className="sidebar-nav">
        <p className="nav-section-label">Navigation</p>

        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Icon name="lock" size={14} />
        <span>Accès sécurisé</span>
      </div>
    </aside>
  )
}
