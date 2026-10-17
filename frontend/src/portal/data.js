// Portal data. Customer logins load their own company's records from the server;
// APX staff previewing the portal see the sample data instead.
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { usePortalAccount } from './PortalAccount'
import { invoices as sampleInvoices, shipments as sampleShipments } from './sampleData'

const notFoundAsNull = (e) => {
  if (e.status === 404) return null
  throw e
}

export function usePortalShipments() {
  const { preview } = usePortalAccount()
  return useApi(() => (preview ? Promise.resolve(sampleShipments) : api('/portal/shipments')), [preview])
}

// One shipment, or null when it is not found (or belongs to another company).
export function usePortalShipment(number) {
  const { preview } = usePortalAccount()
  return useApi(
    () =>
      preview
        ? Promise.resolve(sampleShipments.find((s) => s.number === number) ?? null)
        : api(`/portal/shipments/${encodeURIComponent(number)}`).catch(notFoundAsNull),
    [preview, number],
  )
}

export function usePortalInvoices() {
  const { preview } = usePortalAccount()
  return useApi(() => (preview ? Promise.resolve(sampleInvoices) : api('/portal/invoices')), [preview])
}

// Full records for printing (customer logins only).
export const getPortalInvoice = (id) => api(`/portal/invoices/${encodeURIComponent(id)}`)
export const getPortalSettings = () => api('/portal/settings')

// Today's addresses: sent to the office for the day's shipments. Staff previewing start with an empty list.
export function useTodayAddresses() {
  const { preview } = usePortalAccount()
  return useApi(() => (preview ? Promise.resolve([]) : api('/portal/daily-addresses')), [preview])
}

export const sendTodayAddresses = (addresses) => api('/portal/daily-addresses', { method: 'POST', body: { addresses } })
export const updateTodayAddress = (id, a) => api(`/portal/daily-addresses/${encodeURIComponent(id)}`, { method: 'PUT', body: a })
export const deleteTodayAddress = (id) => api(`/portal/daily-addresses/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Public tracking: no sign-in. Null when there is no such shipment.
export const trackPublic = (number) => api(`/track/${encodeURIComponent(number)}`, { auth: false }).catch(notFoundAsNull)
