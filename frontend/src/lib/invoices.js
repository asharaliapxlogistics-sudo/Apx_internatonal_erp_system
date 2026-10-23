// Invoices and payments, stored by the backend. Invoice numbers (INV-00001…) are issued by the server.
import { api } from './api'

export const NATURES = ['WPX', 'DOX'] // WPX = parcel, DOX = documents
export const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Cheque']

const num = (v) => Number(v) || 0
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const invoicePath = (id) => `/invoices/${encodeURIComponent(id)}`

// total = sum of lines; payable = total + previous balance - amount received before issuing;
// outstanding = payable - payments recorded afterwards. Same rule as the backend.
export function invoiceTotals(inv) {
  const total = inv.lines.reduce((s, l) => s + num(l.amount), 0)
  const payable = total + num(inv.prevBalance) - num(inv.received)
  const paid = (inv.payments ?? []).reduce((s, p) => s + num(p.amount), 0)
  const outstanding = payable - paid
  const status = outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'
  return { total, payable, paid, outstanding, status }
}

export function listInvoices({ customerId } = {}) {
  return api(`/invoices${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`)
}

export const getInvoice = (id) => api(invoicePath(id))

export function createInvoice(data) {
  return api('/invoices', {
    method: 'POST',
    body: {
      customerId: data.customerId,
      customerName: data.customerName ?? '',
      month: data.month,
      lines: data.lines.map((l) => ({ ...l, date: l.date || null, weight: numOrNull(l.weight), amount: Number(l.amount) })),
      prevBalance: num(data.prevBalance),
      received: num(data.received),
      preparedBy: data.preparedBy ?? '',
    },
  })
}

export const addPayment = (id, payment) => api(`${invoicePath(id)}/payments`, { method: 'POST', body: payment })

// Manual status change from the invoice list:
// Paid = record a payment for the full outstanding, Unpaid = remove all payments,
// Partial = record a payment for the given amount.
export const setInvoiceStatus = (id, status, amount) =>
  api(`${invoicePath(id)}/status`, { method: 'POST', body: { status, amount: amount ?? null } })

export const deleteInvoice = (id) => api(invoicePath(id), { method: 'DELETE' })

// Outstanding of the customer's most recent invoice becomes the next invoice's previous balance.
export const lastOutstanding = (customerId) =>
  api(`/invoices/last-outstanding?customerId=${encodeURIComponent(customerId)}`)

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
}

// "2026-09-25" -> "25-Sep-26"
export function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  const mon = d.toLocaleString('en-US', { month: 'short' })
  return `${String(d.getDate()).padStart(2, '0')}-${mon}-${String(d.getFullYear()).slice(2)}`
}

export const money = (n) => num(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })
