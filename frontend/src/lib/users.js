// Staff and admin login accounts. Admins only (the server refuses everyone else).
import { api } from './api'

export const ROLES = [
  { value: 'staff', label: 'Staff', hint: 'Daily work: AWBs, tracking, invoices, expenses, customers' },
  { value: 'admin', label: 'Admin', hint: 'Everything, plus managing employee accounts' },
]

const userPath = (id) => `/users/${encodeURIComponent(id)}`

export const listUsers = () => api('/users')
export const createUser = ({ name, username, role, password }) => api('/users', { method: 'POST', body: { name, username, role, password } })

// Customer-portal logins of one customer company.
export const listPortalUsers = (customerId) => api(`/users?customerId=${encodeURIComponent(customerId)}`)
export const createPortalUser = (customerId, { name, username, password }) =>
  api('/users', { method: 'POST', body: { name, username, password, role: 'customer', customerId } })
export const updateUser = (id, changes) => api(userPath(id), { method: 'PATCH', body: changes })
export const resetPassword = (id, newPassword) => api(`${userPath(id)}/reset-password`, { method: 'POST', body: { newPassword } })

// Readable temporary password: no look-alike characters (0/O, 1/l/I).
export function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
