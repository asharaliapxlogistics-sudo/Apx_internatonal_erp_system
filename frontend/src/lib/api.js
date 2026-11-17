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

// Fetches a file (e.g. an Excel export) with the login token and saves it in the browser.
// `fileName` wins over the server's name when given.
export async function download(path, fileName) {
  const token = getSession()?.token
  let res
  try {
    res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection, or that the backend is running.', 0)
  }
  if (!res.ok) throw new ApiError(messageOf(await res.json().catch(() => null), res.status), res.status)
  const name = fileName || /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'download'
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  // FormData (file uploads) sets its own multipart Content-Type.
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const token = auth ? getSession()?.token : null
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined || isForm ? body : JSON.stringify(body) })
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
