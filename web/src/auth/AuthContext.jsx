import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api, {
  AUTH_UNAUTHORIZED_EVENT,
  clearToken,
  getToken,
  setToken,
} from '../api/client'
import { AuthContext } from './context'

function extractToken(payload) {
  return (
    payload?.token ??
    payload?.access_token ??
    payload?.data?.token ??
    payload?.data?.access_token ??
    null
  )
}

function extractUser(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (payload.user && typeof payload.user === 'object') {
    return payload.user
  }

  if (payload.data && typeof payload.data === 'object') {
    if (payload.data.user && typeof payload.data.user === 'object') {
      return payload.data.user
    }

    if (payload.data.id || payload.data.email || payload.data.name) {
      return payload.data
    }
  }

  if (payload.id || payload.email || payload.name) {
    return payload
  }

  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(() => Boolean(getToken()))
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    const token = getToken()

    if (!token) {
      return () => {
        active = false
      }
    }

    async function loadUser() {
      try {
        const { data } = await api.get('/me')
        const nextUser = extractUser(data)

        if (active) {
          if (nextUser) {
            setUser(nextUser)
          } else {
            clearToken()
            setUser(null)
          }
        }
      } catch {
        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setInitializing(false)
        }
      }
    }

    loadUser()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setInitializing(false)
      queryClient.clear()

      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true })
      }
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [navigate, queryClient])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/login', { email, password })
    const nextToken = extractToken(data)

    if (!nextToken) {
      throw new Error("Aucun jeton d'authentification n'a été reçu.")
    }

    setToken(nextToken)

    try {
      let nextUser = extractUser(data)

      if (!nextUser) {
        const { data: meData } = await api.get('/me')
        nextUser = extractUser(meData)
      }

      if (!nextUser) {
        throw new Error('Impossible de récupérer votre profil.')
      }

      setUser(nextUser)
      setInitializing(false)

      return nextUser
    } catch (error) {
      clearToken()
      setUser(null)
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    if (getToken()) {
      await api.post('/logout').catch(() => undefined)
    }

    clearToken()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, initializing, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
