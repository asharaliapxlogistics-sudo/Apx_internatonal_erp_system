import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, MapPin, Package, Receipt, Search } from 'lucide-react'
import LoadState from '../../components/LoadState'
import { statusInfo } from '../../lib/tracking'
import { usePortalInvoices, usePortalShipments } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Card, PreviewNote, StatusBadge, btnPrimary, inputCls, rs, shortDay } from '../ui'

function Stat({ label, value, tone = 'text-ink-900', to }) {
  return (
    <Link to={to} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${tone}`}>{value}</p>
    </Link>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const { company, preview } = usePortalAccount()
  const [number, setNumber] = useState('')
  const ships = usePortalShipments()
  const bills = usePortalInvoices()
  const shipments = ships.data
  const invoices = bills.data
  if (!shipments || !invoices) {
    const failed = ships.error ? ships : bills
    return <LoadState error={failed.error} onRetry={failed.reload} />
  }

  const count = (g) => shipments.filter((s) => statusInfo(s.status).group === g).length
  const balance = invoices[0]?.balance ?? 0

  return (
    <div className="space-y-6">
      {preview && <PreviewNote />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent-500">Welcome back</p>
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Account {company.accountNo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/portal/today" className={btnPrimary}>
            <ClipboardList size={16} /> Send today's addresses
          </Link>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (number.trim()) navigate(`/portal/track?no=${encodeURIComponent(number.trim())}`)
        }}
        className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white sm:p-6"
      >
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-accent-500/30 blur-3xl" />
        <p className="relative flex items-center gap-2 font-bold">
          <MapPin size={18} className="text-accent-400" /> Track a shipment
        </p>
        <div className="relative mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Enter AWB number, e.g. 10257088"
              className={`${inputCls} border-white/10 py-3 pl-11`}
            />
          </div>
          <button type="submit" className={`${btnPrimary} py-3`}>
            Track <ArrowRight size={16} />
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Booked" value={count('booked')} to="/portal/shipments?group=booked" />
        <Stat label="On the way" value={count('transit')} tone="text-sky-600" to="/portal/shipments?group=transit" />
        <Stat label="Need attention" value={count('customs') + count('exception')} tone="text-amber-600" to="/portal/shipments?group=customs" />
        <Stat label="Balance due" value={rs(balance)} tone="text-accent-500" to="/portal/invoices" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Recent shipments"
          className="lg:col-span-2"
          action={
            <Link to="/portal/shipments" className="text-sm font-semibold text-brand-500 hover:text-accent-500">
              View all
            </Link>
          }
        >
          {shipments.length === 0 && <p className="text-sm text-slate-500">No shipments yet. They show up here once APX books them.</p>}
          <ul className="-mx-5 divide-y divide-slate-100">
            {shipments.slice(0, 5).map((s) => (
              <li key={s.number}>
                <Link to={`/portal/shipments/${s.number}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <Package size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink-900">{s.number}</p>
                    <p className="truncate text-xs text-slate-500">
                      {s.consignee} · {s.city}, {s.country}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Your balance" action={<Receipt size={18} className="text-slate-400" />}>
            <p className="text-3xl font-extrabold text-accent-500">{rs(balance)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {invoices[0] ? `Latest invoice ${invoices[0].number} · issued ${shortDay(invoices[0].issued)}` : 'No invoices yet'}
            </p>
            <Link to="/portal/invoices" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-accent-500">
              View invoices <ArrowRight size={14} />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
