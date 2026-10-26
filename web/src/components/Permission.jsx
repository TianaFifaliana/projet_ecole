import { hasPermission } from '../auth/permissions'
import useAuth from '../auth/useAuth'
import AccessDenied from './AccessDenied'

export default function Permission({ permission, children }) {
  const { user } = useAuth()

  if (!hasPermission(user, permission)) {
    return <AccessDenied />
  }

  return children
}
