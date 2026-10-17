// Company settings (printed on invoices, vouchers and AWBs) and the audit log.
import { api } from './api'

export const getSettings = () => api('/settings')
export const updateSettings = (body) => api('/settings', { method: 'PUT', body })

// filters: { from, to, userId, entity, q, limit, offset }
export function listAudit(filters = {}) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString()
  return api(`/audit${qs ? `?${qs}` : ''}`)
}
