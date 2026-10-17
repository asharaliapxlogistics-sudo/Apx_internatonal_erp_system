import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquareWarning,
  Package,
  Plus,
  Receipt,
  UserCog,
  X,
} from 'lucide-react'
import { getSession, logout } from '../lib/auth'
import LoadState from '../components/LoadState'
import { PortalAccountProvider, usePortalAccount } from './PortalAccount'

export const PORTAL_NAV = [
  { to: '/portal', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/portal/shipments', label: 'Shipments', icon: Package },
  { to: '/portal/today', label: "Today's addresses", icon: ClipboardList },
  { to: '/portal/track', label: 'Track', icon: MapPin },
  { to: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { to: '/portal/complaints', label: 'Complaints', icon: MessageSquareWarning },
]

export const PORTAL_MORE = [
  { to: '/portal/account', label: 'Account & users', icon: UserCog },
]

const linkCls = ({ isActive }) =>
  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
    isActive ? 'bg-ink-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-ink-900'
  }`

function AccountMenu({ session }) {
  const { company } = usePortalAccount()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const initials = (session?.name ?? company.name).slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">{initials}</span>
        <span className="hidden text-left xl:block">
          <span className="block max-w-40 truncate text-sm leading-tight font-semibold text-ink-900">{company.name}</span>
          <span className="block text-xs leading-tight text-slate-500">{company.accountNo}</span>
        </span>
        <ChevronDown size={16} className="hidden text-slate-400 xl:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">{session?.name}</p>
            <p className="truncate text-xs text-slate-500">{company.name}</p>
          </div>
          {PORTAL_MORE.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mt-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-slate-100"
            >
              <Icon size={16} className="text-slate-500" /> {label}
            </Link>
          ))}
          <button
            role="menuitem"
            onClick={() => {
              logout()
              navigate('/portal/login', { replace: true })
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-slate-100 px-3 py-2 text-sm font-medium text-accent-600 hover:bg-red-50"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function PortalLayout() {
  return (
    <PortalAccountProvider>
      <PortalShell />
    </PortalAccountProvider>
  )
}

function PortalShell() {
  const { loaded, error, reload } = usePortalAccount()
  const session = getSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      {session?.role !== 'customer' && (
        <div className="no-print bg-ink-950 px-4 py-1.5 text-center text-xs font-medium text-slate-200">
          Customer portal preview (you are signed in as APX staff).{' '}
          <Link to="/admin" className="font-semibold text-white underline">
            Back to admin
          </Link>
        </div>
      )}

      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 xl:hidden">
            <Menu size={20} />
          </button>
          <Link to="/portal" className="shrink-0">
            <img src="/apx-logo.svg" alt="APX International" className="h-8" />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 xl:flex">
            {PORTAL_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkCls}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/portal/today" className="hidden items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 sm:inline-flex">
              <Plus size={16} /> Send addresses
            </Link>
            {loaded && <AccountMenu session={session} />}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <img src="/apx-logo.svg" alt="APX International" className="h-8" />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <Link to="/portal/today" onClick={() => setMobileOpen(false)} className="mb-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white">
              <Plus size={16} /> Send addresses
            </Link>
            <nav className="flex flex-col gap-1">
              {[...PORTAL_NAV, ...PORTAL_MORE].map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={linkCls} onClick={() => setMobileOpen(false)}>
                  <Icon size={16} /> {label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {loaded ? <Outlet /> : <LoadState error={error} onRetry={reload} />}
      </main>

      <footer className="no-print mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-400 sm:px-6">
        <FileText size={12} className="mr-1 inline" /> APX International · Need help? Call 0345-3177311
      </footer>
    </div>
  )
}
