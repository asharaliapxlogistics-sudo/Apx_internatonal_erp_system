import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, Globe2, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import ChangePasswordDialog from '../components/ChangePasswordDialog'
import { allModules, moduleGroups } from '../config/adminModules'
import { WEBSITE_URL } from '../config/site'
import { AppSettingsProvider } from '../context/AppSettings'
import { CustomerFilterProvider, useCustomerFilter } from '../context/CustomerFilter'
import { getSession, logout } from '../lib/auth'

function Sidebar({ collapsed, onNavigate }) {
  const isAdmin = getSession()?.role === 'admin'
  const groups = moduleGroups.map((g) => ({ ...g, modules: g.modules.filter((m) => isAdmin || !m.adminOnly) }))
  return (
    <nav className="flex h-full flex-col bg-ink-950 text-slate-300">
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center' : 'px-5'}`}>
        {collapsed ? (
          <img src="/favicon.svg" alt="APX International" className="h-8 w-8" />
        ) : (
          <img src="/apx-logo-light.svg" alt="APX International" className="h-8" />
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.modules.map(({ path, label, icon: Icon, ready }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    end={path === '/admin'}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition ${
                        collapsed ? 'justify-center px-2' : 'px-3'
                      } ${
                        isActive
                          ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/20'
                          : 'hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{label}</span>
                        {!ready && <span className="text-[10px] font-semibold text-slate-500">Soon</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

function CustomerSelect() {
  const { customerId, setCustomerId, customers } = useCustomerFilter()
  return (
    <label className="relative flex min-w-0 items-center">
      <Building2 size={16} className="pointer-events-none absolute left-3 text-slate-400" />
      <select
        aria-label="Select customer"
        value={customerId ?? ''}
        onChange={(e) => setCustomerId(e.target.value || null)}
        className={`w-full appearance-none rounded-xl border py-2 pr-9 pl-9 text-sm font-medium focus:ring-4 focus:ring-brand-100 focus:outline-none sm:w-60 ${
          customerId
            ? 'border-brand-500 bg-brand-50 text-brand-600'
            : 'border-slate-300 bg-white text-ink-900 focus:border-brand-500'
        }`}
      >
        <option value="">All customers</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.accountNo})
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 text-slate-400" />
    </label>
  )
}

function UserMenu() {
  const navigate = useNavigate()
  const session = getSession()
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const closeChangePassword = useCallback(() => setChangingPassword(false), [setChangingPassword])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = (session?.name ?? 'A').slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-xs font-bold text-white">
          {initials}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-sm leading-tight font-semibold text-ink-900">{session?.name}</span>
          <span className="block text-xs leading-tight text-slate-500 capitalize">{session?.role}</span>
        </span>
        <ChevronDown size={16} className="hidden text-slate-400 md:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">{session?.name}</p>
            <p className="truncate text-xs text-slate-500">{session?.username}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setChangingPassword(true)
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-100"
          >
            <KeyRound size={16} />
            Change password
          </button>
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-100"
          >
            <Globe2 size={16} />
            APX website
          </a>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-accent-600 hover:bg-red-50"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
      {changingPassword && <ChangePasswordDialog onClose={closeChangePassword} />}
    </div>
  )
}

// Data every admin screen shares: company settings and the customer list / filter.
function Providers({ children }) {
  return (
    <AppSettingsProvider>
      <CustomerFilterProvider>{children}</CustomerFilterProvider>
    </AppSettingsProvider>
  )
}

export default function AdminLayout() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const current =
    allModules.find((m) => m.path !== '/admin' && pathname.startsWith(m.path)) ?? allModules[0]

  return (
    <Providers>
      <div className="min-h-screen bg-slate-50">
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block ${
            collapsed ? 'w-20' : 'w-64'
          }`}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/60" onClick={() => setMobileOpen(false)} />
            <aside className="relative h-full w-72 max-w-[85vw]">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="absolute top-4 right-3 rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </aside>
          </div>
        )}

        <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <button
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:block"
              >
                {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              </button>

              <p className="hidden truncate font-semibold text-ink-900 sm:block">{current.label}</p>

              <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
                <CustomerSelect />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </Providers>
  )
}
