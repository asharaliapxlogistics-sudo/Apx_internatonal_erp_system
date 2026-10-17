import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  FileWarning,
  MessageSquareWarning,
  PackagePlus,
  Plane,
  Receipt,
  Scale,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useCustomerFilter } from '../../context/CustomerFilter'
import LoadState from '../../components/LoadState'
import { getDashboard } from '../../data/dashboard'
import { useApi } from '../../hooks/useApi'

const pkr = (n) => `Rs ${n.toLocaleString('en-PK')}`

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-xl p-2 ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-ink-900">{value}</p>
    </div>
  )
}

function MoneyCard({ label, amount, icon: Icon, accent, note }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white">
      <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl ${accent}`} />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Icon size={16} />
          {label}
        </div>
        <p className="mt-2 text-2xl font-bold">{pkr(amount)}</p>
        {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { customerId, customers } = useCustomerFilter()
  const customer = customers.find((c) => c.id === customerId) ?? null
  const { data, error, reload } = useApi(() => getDashboard(customerId), [customerId])

  const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  if (!data) return <LoadState error={error} onRetry={reload} />

  const actions = [
    {
      label: 'Missing customs documents',
      hint: 'Shipments without commercial invoice or HS code',
      count: data.actions.missingDocs,
      icon: FileWarning,
    },
    {
      label: 'Weight corrections',
      hint: 'Declared weight differs from actual / volumetric',
      count: data.actions.weightCorrections,
      icon: Scale,
    },
    {
      label: 'Customers with a balance',
      hint: 'Latest invoice not fully paid',
      count: data.actions.unpaidInvoices,
      icon: Receipt,
    },
    {
      label: 'Open complaints',
      hint: 'Customer complaints not yet resolved',
      count: data.actions.openComplaints ?? 0,
      icon: MessageSquareWarning,
      to: '/admin/complaints',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-accent-500">{todayLabel}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {customer ? `Showing ${customer.name} only` : 'Showing all customers'}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Today</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Bookings" value={data.today.bookings} icon={PackagePlus} tone="bg-brand-50 text-brand-500" />
          <StatCard label="In transit" value={data.today.inTransit} icon={Plane} tone="bg-sky-50 text-sky-600" />
          <StatCard label="Customs hold" value={data.today.customsHold} icon={ShieldAlert} tone="bg-amber-50 text-amber-600" />
          <StatCard label="Delivered" value={data.today.delivered} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
          <StatCard label="Exceptions" value={data.today.exceptions} icon={AlertTriangle} tone="bg-red-50 text-accent-500" />
        </div>
      </section>

      {!data.scoped && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Customers</h2>
            <Link to="/admin/customers" className="text-sm font-semibold text-brand-500 hover:text-accent-500">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/admin/customers">
              <StatCard label="Total customers" value={data.customers.total} icon={Building2} tone="bg-brand-50 text-brand-500" />
            </Link>
            <Link to="/admin/customers">
              <StatCard label="New this month" value={data.customers.newThisMonth} icon={UserPlus} tone="bg-sky-50 text-sky-600" />
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">{monthName}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyCard label="Outstanding receivables" amount={data.month.receivables} icon={Wallet} accent="bg-accent-500/40" />
          <MoneyCard label="Revenue this month" amount={data.month.revenue} icon={TrendingUp} accent="bg-emerald-500/40" />
          <MoneyCard
            label="Expenses this month"
            amount={data.month.expenses}
            icon={Banknote}
            accent="bg-brand-400/40"
            note={data.scoped ? 'Company expenses are not tracked per customer' : null}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Action items</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {actions.map(({ label, hint, count, icon: Icon, to }) => {
            const row = (
              <>
                <span className={`rounded-xl p-2.5 ${count ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Icon size={20} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-ink-900">{label}</p>
                  <p className="text-sm text-slate-500">{hint}</p>
                </div>
                <span
                  className={`min-w-9 rounded-full px-2.5 py-1 text-center text-sm font-bold ${
                    count ? 'bg-accent-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {count}
                </span>
                <ArrowRight size={18} className="hidden text-slate-300 sm:block" />
              </>
            )
            return (
              <li key={label}>
                {to ? (
                  <Link to={to} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-4">{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

    </div>
  )
}
