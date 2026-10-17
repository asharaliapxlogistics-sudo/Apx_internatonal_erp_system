// Customers, stored by the backend. Account numbers (APX-1001…) are issued by the server.
import { api } from './api'

export const CUSTOMER_TYPES = ['Corporate', 'E-commerce', 'Walk-in']

export const emptyCustomer = {
  type: 'Corporate',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  zip: '',
  country: 'Pakistan',
  ntn: '',
  strn: '',
  cnic: '',
  notes: '',
}

const body = (data) => Object.fromEntries(Object.keys(emptyCustomer).map((k) => [k, data[k] ?? emptyCustomer[k]]))

export const listCustomers = () => api('/customers')
export const getCustomer = (id) => api(`/customers/${encodeURIComponent(id)}`)
export const createCustomer = (data) => api('/customers', { method: 'POST', body: body(data) })
export const updateCustomer = (id, data) => api(`/customers/${encodeURIComponent(id)}`, { method: 'PUT', body: body(data) })
export const deleteCustomer = (id) => api(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' })
