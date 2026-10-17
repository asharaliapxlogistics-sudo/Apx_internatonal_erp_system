import { api } from '../lib/api'

// Dashboard figures, worked out by the backend from AWBs, shipments, invoices and expenses.
// "In transit", "Customs hold" and "Exceptions" are current counts; "Delivered" is today's deliveries.
export function getDashboard(customerId) {
  return api(`/dashboard${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`)
}
