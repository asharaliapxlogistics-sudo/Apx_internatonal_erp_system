import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Plus, Receipt, Search } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { invoiceTotals, listInvoices, monthLabel, money, setInvoiceStatus } from '../../../lib/invoices'

const STATUSES = ['All', 'Unpaid', 'Partial', 'Paid']
const statusCls = {
  Paid: 'bg-emerald-50 text-emerald-700',
  Partial: 'bg-amber-50 text-amber-700',
  Unpaid: 'bg-red-50 text-accent-600',
}

function StatusMenu({ invoice, onChange, onError }) {
  // The menu is position: fixed so the table's scroll container can't clip it.
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const open = pos !== null
  const { status, outstanding } = invoice.t
  const { confirm, prompt } = useDialog()

  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setPos(null)
    const dismiss = () => setPos(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', dismiss)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', dismiss)
    }
  }, [open])

  function toggle(e) {
    if (open) return setPos(null)
    const r = e.currentTarget.getBoundingClientRect()
    const MENU_W = 160
    const MENU_H = 130
    const below = r.bottom + 4 + MENU_H <= window.innerHeight
    setPos({
      left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)),
      top: below ? r.bottom + 4 : r.top - 4 - MENU_H,
    })
  }

  async function choose(next) {
    setPos(null)
    if (next === status && next !== 'Partial') return
    if (
      next === 'Unpaid' &&
      !(await confirm({
        title: `Mark ${invoice.number} as unpaid?`,
        message: 'All payments recorded on this invoice will be removed.',
        confirmText: 'Mark unpaid',
        danger: true,
      }))
    )
      return
    let amount
    if (next === 'Partial') {
      const input = await prompt({
        title: `Partial payment for ${invoice.number}`,
        message: `Outstanding: Rs ${money(outstanding)}`,
        label: 'Amount received (PKR)',
        inputType: 'number',
        confirmText: 'Save payment',
      })
      amount = Number(input)
      if (!input || !(amount > 0)) return
      if (amount >= outstanding) next = 'Paid'
    }
    try {
      await setInvoiceStatus(invoice.id, next, amount)
      onChange()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <div ref={ref} className="inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change status"
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-transparent transition hover:ring-current ${statusCls[status]}`}
      >
        {status}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {['Unpaid', 'Partial', 'Paid'].map((s) => (
            <button
              key={s}
              role="menuitem"
              onClick={() => choose(s)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-100"
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${s === 'Paid' ? 'bg-emerald-500' : s === 'Partial' ? 'bg-amber-500' : 'bg-accent-500'}`} />
                {s}
              </span>
              {s === status && <Check size={14} className="text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InvoiceList() {
  const navigate = useNavigate()
  const { customerId } = useCustomerFilter()
  const { data, error: loadError, reload } = useApi(() => listInvoices(), [])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const q = query.trim().toLowerCase()

  const rows = (data ?? [])
    .filter((i) => !customerId || i.customerId === customerId)
    .map((i) => ({ ...i, t: invoiceTotals(i) }))
  const shown = rows.filter(
    (i) =>
      (status === 'All' || i.t.status === status) &&
      (!q || [i.number, i.customerName, i.accountNo, monthLabel(i.month)].join(' ').toLowerCase().includes(q)),
  )
  // Each invoice carries the previous balance forward, so a customer owes their latest invoice's outstanding.
  const latest = Object.values(
    rows.reduce((acc, i) => {
      if (!acc[i.customerId] || i.seq > acc[i.customerId].seq) acc[i.customerId] = i
      return acc
    }, {}),
  )
  const outstanding = latest.reduce((s, i) => s + Math.max(0, i.t.outstanding), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Billing & Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Outstanding: <span className="font-bold text-accent-500">Rs {money(outstanding)}</span>
          </p>
        </div>
        <Link
          to="/admin/billing/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
        >
          <Plus size={18} /> New Invoice
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice #, customer, month…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                status === s ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {!data ? (
        <LoadState error={loadError} onRetry={reload} />
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Receipt size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">{rows.length ? 'No matching invoices' : 'No invoices yet'}</p>
          {!rows.length && (
            <Link to="/admin/billing/new" className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent-500">
              Create the first invoice
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Shipments</th>
                <th className="px-4 py-3 text-right">Invoice amount</th>
                <th className="px-4 py-3 text-right">Payable</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((i) => (
                <tr key={i.id} onClick={() => navigate(`/admin/billing/${i.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/admin/billing/${i.id}`} className="font-bold text-brand-500 hover:text-accent-500">
                      {i.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{i.customerName}</p>
                    <p className="text-xs text-slate-500">{i.accountNo}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{monthLabel(i.month)}</td>
                  <td className="px-4 py-3 text-right">{i.lines.length}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">Rs {money(i.t.total)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">Rs {money(i.t.payable)}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">Rs {money(i.t.outstanding)}</td>
                  <td className="px-4 py-3">
                    <StatusMenu invoice={i} onChange={reload} onError={setError} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
