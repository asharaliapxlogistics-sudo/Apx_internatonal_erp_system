import { createContext, useContext } from 'react'
import { useApi } from '../hooks/useApi'
import { getSettings } from '../lib/settings'

// Company details and the tracking page address, loaded once for the admin screens.
// Until they arrive (or if loading fails) the printed name falls back to a placeholder.
const AppSettingsContext = createContext(null)

const FALLBACK = { company: { name: 'APX INTERNATIONAL', office: '', phone: '', email: '', ntn: '' }, trackingUrl: '' }

// `load` lets the customer portal read the same details from its own endpoint.
export function AppSettingsProvider({ children, load = getSettings }) {
  const { data, reload } = useApi(load, [])
  return (
    <AppSettingsContext.Provider value={{ ...(data ?? FALLBACK), loaded: data !== undefined, reloadSettings: reload }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  return useContext(AppSettingsContext)
}
