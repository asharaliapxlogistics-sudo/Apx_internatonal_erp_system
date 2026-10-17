// Login through the backend. The session (token + user) is kept in localStorage with
// "Keep me signed in", otherwise in sessionStorage so it ends when the browser closes.
import { api } from './api'

const SESSION_KEY = 'apx_admin_session'

function read() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

// { id, name, username, role, token } of the signed-in user, or null when signed out or expired.
export function getSession() {
  const s = read()
  if (!s?.token || !s.user) return null
  if (new Date(s.expiresAt) <= new Date()) {
    logout()
    return null
  }
  return { ...s.user, token: s.token }
}

export async function login(username, password, remember) {
  const res = await api('/auth/login', { method: 'POST', body: { username, password, remember }, auth: false })
  logout()
  const session = { token: res.token, expiresAt: res.expiresAt, user: res.user }
  ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session))
  return res.user
}

export function changePassword(currentPassword, newPassword) {
  return api('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}
