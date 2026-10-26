import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen'
import useAuth from './useAuth'

export default function RequireAuth() {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return <LoadingScreen label="Vérification de votre session…" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
