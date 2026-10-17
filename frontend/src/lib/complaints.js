// Customer complaints: raised from the portal, answered by APX staff.
import { api } from './api'

export const COMPLAINT_STATUSES = ['Open', 'In progress', 'Resolved']
export const COMPLAINT_TONE = {
  Open: 'bg-red-50 text-accent-600',
  'In progress': 'bg-amber-50 text-amber-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
}

const path = (id) => `/complaints/${encodeURIComponent(id)}`

// Admin portal
export function listComplaints({ status, customerId } = {}) {
  const qs = new URLSearchParams(Object.entries({ status, customerId }).filter(([, v]) => v)).toString()
  return api(`/complaints${qs ? `?${qs}` : ''}`)
}
export const getComplaint = (id) => api(path(id))
export const replyToComplaint = (id, body) => api(`${path(id)}/messages`, { method: 'POST', body: { body } })
export const setComplaintStatus = (id, status) => api(`${path(id)}/status`, { method: 'PUT', body: { status } })

// Customer portal
export const listMyComplaints = () => api('/portal/complaints')
export const getMyComplaint = (id) => api(`/portal${path(id)}`)
export const raiseComplaint = ({ awbNumber, subject, body }) => api('/portal/complaints', { method: 'POST', body: { awbNumber, subject, body } })
export const replyToMyComplaint = (id, body) => api(`/portal${path(id)}/messages`, { method: 'POST', body: { body } })

export const when = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
