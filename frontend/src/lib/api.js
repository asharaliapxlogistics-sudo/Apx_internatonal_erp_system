// Calls the FastAPI backend. Sends the login token and turns error responses into Error(message).
import { getSession, logout } from './auth'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// FastAPI returns { detail: "message" }, or a list of field errors for invalid input.
function messageOf(data, status) {
  const d = data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d[0]?.msg)
    return d
      .map((e) => (/valid email address/.test(e.msg) ? 'Enter a valid email address.' : e.msg.replace(/^Value error, /, '')))
      .join(' ')
  return `Request failed (${status}).`
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? getSession()?.token : null
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection, or that the backend is running.', 0)
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (res.ok) return data

  // Expired or revoked login: clear it and go back to the sign-in page.
  if (res.status === 401 && token) {
    logout()
    window.location.assign('/login')
  }
  throw new ApiError(messageOf(data, res.status), res.status)
}
