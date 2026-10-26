import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoleLabel } from '../auth/permissions'
import useAuth from '../auth/useAuth'
import { getDisplayName, getInitials } from '../auth/user'
import Icon from './Icons'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  async function handleLogout() {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    setMenuOpen(false)
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
    setLoggingOut(false)
  }

  const displayName = getDisplayName(user)
  const initials = getInitials(user)
  const roleLabel = getRoleLabel(user)

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setMenuOpen((value) => !value)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Ouvrir le menu utilisateur"
      >
        <span className="user-avatar">{initials}</span>
        <span className="user-menu-user">
          <span className="user-menu-name">{displayName}</span>
          <span className="user-menu-role">{roleLabel}</span>
        </span>
        <span
          className={`user-menu-chevron${menuOpen ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          <Icon name="chevron" size={15} />
        </span>
      </button>

      {menuOpen && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-details">
            <span className="user-avatar user-avatar-large">{initials}</span>
            <div className="user-menu-details-text">
              <strong>{displayName}</strong>
              <span>{user?.email}</span>
              <span className="role-badge role-badge-small">{roleLabel}</span>
            </div>
          </div>

          <button
            type="button"
            className="user-menu-logout"
            onClick={handleLogout}
            disabled={loggingOut}
            role="menuitem"
          >
            <Icon name="logout" size={18} />
            <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
