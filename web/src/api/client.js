import axios from 'axios'
import { API_BASE_URL } from '../config'

const TOKEN_KEY = 'ecole.auth.token'

export const AUTH_UNAUTHORIZED_EVENT = 'ecole:auth:unauthorized'

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
    }

    return Promise.reject(error)
  },
)

export default api
