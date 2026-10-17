import { createContext, useContext } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { getSession } from '../lib/auth'
import { account, users } from './sampleData'

// The signed-in customer's company and team. Customer logins load their own from the server;
// APX staff previewing the portal see the sample company instead.
const PortalAccountContext = createContext(null)

const SAMPLE = {
  preview: true,
  user: { id: users[0].id, name: users[0].name, username: users[0].username, isActive: true, lastLogin: users[0].lastLogin },
  company: {
    name: account.company,
    accountNo: account.accountNo,
    type: 'Corporate',
    contactPerson: account.contactPerson,
    phone: account.phone,
    email: account.email,
    address: account.address,
    city: account.city,
    zip: '',
    country: account.country,
    ntn: account.ntn,
  },
  team: users.map((u) => ({ id: u.id, name: u.name, username: u.username, isActive: u.active, lastLogin: u.lastLogin })),
}

export function PortalAccountProvider({ children }) {
  const isCustomer = getSession()?.role === 'customer'
  const { data, error, reload } = useApi(() => (isCustomer ? api('/portal/me') : Promise.resolve(SAMPLE)), [isCustomer])
  return (
    <PortalAccountContext.Provider value={{ ...(data ?? {}), preview: !isCustomer, loaded: data !== undefined, error, reload }}>
      {children}
    </PortalAccountContext.Provider>
  )
}

export function usePortalAccount() {
  return useContext(PortalAccountContext)
}
