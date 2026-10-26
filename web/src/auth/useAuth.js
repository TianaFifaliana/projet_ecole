import { useContext } from 'react'
import { AuthContext } from './context'

export default function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'AuthProvider.")
  }

  return context
}
