import { createContext, useContext, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { listCustomers } from '../lib/customers'

// The "Select customer" filter in the admin top bar, shared by every admin screen,
// plus the customer list it offers (also used by forms). null means "All customers".
// Call reloadCustomers() after adding, editing or deleting a customer.
const CustomerFilterContext = createContext(null)

export function CustomerFilterProvider({ children }) {
  const [customerId, setCustomerId] = useState(null)
  const { data, error, reload } = useApi(listCustomers, [])
  const customers = data ?? []
  return (
    <CustomerFilterContext.Provider
      value={{ customerId, setCustomerId, customers, customersLoaded: data !== undefined, customersError: error, reloadCustomers: reload }}
    >
      {children}
    </CustomerFilterContext.Provider>
  )
}

export function useCustomerFilter() {
  return useContext(CustomerFilterContext)
}
