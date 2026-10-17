import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Download, FilePlus2, MapPinned, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { clearCustomerAddresses, listCustomerAddresses } from '../../../lib/dailyAddresses'
import { downloadCsv } from '../../../lib/reports'

// Local calendar date as YYYY-MM-DD (toISOString would give the UTC date).
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function shiftDay(day, by) {
  const [y, m, d] = day.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + by))
}

const CSV_COLUMNS = [
  { label: 'Customer', key: 'customerName' },
  { label: 'Account #', key: 'accountNo' },
  { label: 'Address', key: 'address' },
  { label: 'Sent by', key: 'sentBy' },
  { label: 'Sent at', key: 'sentAt' },
]

// Copy one address to the clipboard; the button shows "Copied" for a moment.
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API blocked (no permission / not https): fall back to a hidden textarea.
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      el.remove()
      if (!ok) return window.prompt('Copy this address:', text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100"
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

const time = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

// Consignee addresses customers sent from the portal ("Today's addresses"), by day.
export default function CustomerAddresses() {
  const { customerId, customers } = useCustomerFilter()
  const { confirm } = useDialog()
  const [clearError, setClearError] = useState('')
  const [day, setDay] = useState(localDate)
  const [query, setQuery] = useState('')
  const { data, error, reload } = useApi(() => listCustomerAddresses({ day, customerId }), [day, customerId])
  const today = localDate()

  const q = query.trim().toLowerCase()
  const rows = (data ?? []).filter((a) => !q || [a.customerName, a.accountNo, a.address].join(' ').toLowerCase().includes(q))
  const byCustomer = Object.values(
    rows.reduce((groups, a) => {
      ;(groups[a.customerId] ??= {
        id: a.customerId,
        name: a.customerName,
        accountNo: a.accountNo,
        items: [],
      }).items.push(a)
      return groups
    }, {}),
  )
  const label = new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Once the day's AWBs are booked, the office clears the list in one go.
  async function handleClear() {
    const total = data?.length ?? 0
    const who = customerId ? customers.find((c) => c.id === customerId)?.name : 'all customers'
    const ok = await confirm({
      title: `Remove ${total} ${total === 1 ? 'address' : 'addresses'}?`,
      message: `All addresses of ${label} from ${who} will be removed for good, also from the customers' portal. Download the CSV first if you need a copy.`,
      confirmText: 'Remove all',
      danger: true,
    })
    if (!ok) return
    setClearError('')
    try {
      await clearCustomerAddresses({ day, customerId })
      reload()
    } catch (err) {
      setClearError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Customer Addresses</h1>
          <p className="mt-1 text-sm text-slate-500">Addresses customers sent from their portal for the day's shipments.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                `Customer addresses ${day}.csv`,
                CSV_COLUMNS,
                rows.map((a) => ({ ...a, sentAt: time(a.createdAt) })),
              )
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-slate-100 disabled:opacity-50"
          >
            <Download size={16} /> Download CSV
          </button>
          <button
            type="button"
            disabled={!data?.length}
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-accent-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} /> Clear all
          </button>
        </div>
      </div>

      {clearError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {clearError}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDay(shiftDay(day, -1))}
            aria-label="Previous day"
            className="rounded-xl border border-slate-300 bg-white p-2.5 hover:bg-slate-100"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={day}
            max={today}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            aria-label="Day"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setDay(shiftDay(day, 1))}
            disabled={day >= today}
            aria-label="Next day"
            className="rounded-xl border border-slate-300 bg-white p-2.5 hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
          {day !== today && (
            <button type="button" onClick={() => setDay(today)} className="ml-1 text-sm font-semibold text-brand-500 hover:text-accent-500">
              Today
            </button>
          )}
        </div>
        <div className="relative sm:ml-auto sm:w-80">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, name, city…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
      </div>

      {!data ? (
        <LoadState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <MapPinned size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">{q ? 'No matching addresses' : `No addresses sent for ${label}`}</p>
          {!q && <p className="mt-1 text-sm text-slate-500">Customers send them from “Today's addresses” in their portal.</p>}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {label}: <b className="text-ink-900">{rows.length}</b> {rows.length === 1 ? 'address' : 'addresses'} from{' '}
            <b className="text-ink-900">{byCustomer.length}</b> {byCustomer.length === 1 ? 'customer' : 'customers'}
          </p>
          {byCustomer.map((g) => (
            <section key={g.accountNo} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <h2 className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                <span className="font-bold text-ink-900">
                  {g.name} <span className="font-medium text-slate-500">· {g.accountNo}</span>
                </span>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">{g.items.length}</span>
              </h2>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="w-full px-4 py-2.5">Address</th>
                    <th className="px-4 py-2.5">Sent</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.items.map((a, i) => (
                    <tr key={a.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 text-ink-900">{a.address}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {time(a.createdAt)}
                        <p className="text-xs">{a.sentBy}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <CopyButton text={a.address} />
                          <Link
                            to="/admin/awb/new"
                            state={{ customerId: g.id, address: a.address }}
                            className="inline-flex items-center gap-1 rounded-lg bg-accent-500 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white hover:bg-accent-600"
                          >
                            <FilePlus2 size={14} /> Create AWB
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
