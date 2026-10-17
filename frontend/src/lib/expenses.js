// Daily operating expenses, stored by the backend. Voucher numbers (EXP-00001…) are issued by the server.
import { api } from './api'

export const EXPENSE_CATEGORIES = [
  'Fuel',
  'Rider / delivery',
  'Transport / freight',
  'Packaging material',
  'Office rent',
  'Utilities',
  'Internet & phone',
  'Salaries & wages',
  'Stationery & printing',
  'Food & tea',
  'Repairs & maintenance',
  'Miscellaneous',
]

export const EXPENSE_METHODS = ['Cash', 'Bank transfer', 'Cheque', 'Card']

const expensePath = (id) => `/expenses/${encodeURIComponent(id)}`
const body = ({ date, category, description, amount, method, paidTo }) => ({
  date,
  category,
  description,
  amount: Number(amount),
  method,
  paidTo,
})

// Optional filters: { from, to } as YYYY-MM-DD, and category.
export function listExpenses(filters = {}) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
  return api(`/expenses${qs ? `?${qs}` : ''}`)
}

export const getExpense = (id) => api(expensePath(id))
export const createExpense = (data) => api('/expenses', { method: 'POST', body: body(data) })
export const updateExpense = (id, data) => api(expensePath(id), { method: 'PUT', body: body(data) })
export const deleteExpense = (id) => api(expensePath(id), { method: 'DELETE' })

export function expensesTotal(list) {
  return list.reduce((s, e) => s + (Number(e.amount) || 0), 0)
}
