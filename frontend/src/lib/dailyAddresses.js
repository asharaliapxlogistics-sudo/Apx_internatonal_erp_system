// Addresses customers send from the portal for the day's shipments.
import { api } from './api'

// day = YYYY-MM-DD (office day); customerId narrows to one customer.
export function listCustomerAddresses({ day, customerId } = {}) {
  const qs = new URLSearchParams(Object.entries({ day, customerId }).filter(([, v]) => v)).toString()
  return api(`/daily-addresses${qs ? `?${qs}` : ''}`)
}

// Removes every address of that day (only that customer's when customerId is given).
export function clearCustomerAddresses({ day, customerId }) {
  const qs = new URLSearchParams(Object.entries({ day, customerId }).filter(([, v]) => v)).toString()
  return api(`/daily-addresses?${qs}`, { method: 'DELETE' })
}
